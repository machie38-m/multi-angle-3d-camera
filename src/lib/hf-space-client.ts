/**
 * Hugging Face Space Gradio API client.
 *
 * Calls the multimodalart/qwen-image-multiple-angles-3d-camera Space
 * directly via its public Gradio API. No API key required — the Space
 * runs anonymously on Hugging Face's ZeroGPU infrastructure.
 *
 * API docs: https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera/agents.md
 *
 * Flow:
 *   1. POST /gradio_api/upload with the source image → get server-side path
 *   2. POST /gradio_api/queue/join with fn_index=7 (/infer_camera_edit)
 *      → get event_id
 *   3. GET /gradio_api/queue/data?session_hash=<uuid> (SSE stream)
 *      → wait for process_completed event with output image URL
 *   4. Download the output image from /gradio_api/file=<path>
 *
 * Total time: typically 15-30 seconds depending on ZeroGPU queue.
 */

const SPACE_BASE =
  "https://multimodalart-qwen-image-multiple-angles-3d-camera.hf.space";

/** The fn_index for /infer_camera_edit in the Space config. */
const FN_INDEX_INFER_CAMERA_EDIT = 7;

export interface HfSpaceCameraParams {
  azimuth: number; // 0-315 (HF Space uses 0-315 instead of -180 to 180)
  elevation: number; // -30 to 60
  distance: number; // 0.6 to 1.4
}

export interface HfSpaceResult {
  base64: string;
  seed: number;
  prompt: string;
  outputUrl: string;
}

/**
 * Convert our internal CameraParams (azimuth -180 to 180) to HF Space's
 * expected range (0 to 315, in 45-degree steps for LoRA conditioning).
 *
 * The HF Space uses a Qwen-Image-Edit-2511-Multiple-Angles-LoRA which
 * was trained on discrete 45° azimuth steps: 0, 45, 90, 135, 180, 225,
 * 270, 315. We snap to the nearest 45° to match the LoRA's training data.
 *
 * Elevation range is -30 to 60 (also discrete), distance 0.6 to 1.4.
 */
export function convertToHfSpaceParams(params: {
  azimuth: number;
  elevation: number;
  distance: number;
}): HfSpaceCameraParams {
  // Snap azimuth to nearest 45° step in 0-315 range
  // -180 → 180, -135 → 225, -90 → 270, -45 → 315, 0 → 0, 45 → 45, etc.
  let azNormalized = params.azimuth;
  while (azNormalized < 0) azNormalized += 360;
  while (azNormalized >= 360) azNormalized -= 360;

  // Snap to nearest 45° step
  const snappedAz = Math.round(azNormalized / 45) * 45;
  // 360 wraps back to 0
  const finalAz = snappedAz === 360 ? 0 : snappedAz;

  // Clamp elevation to -30..60
  const el = Math.max(-30, Math.min(60, params.elevation));

  // Clamp distance to 0.6..1.4
  const dist = Math.max(0.6, Math.min(1.4, params.distance));

  return {
    azimuth: finalAz,
    elevation: el,
    distance: dist,
  };
}

/**
 * Upload an image to the HF Space and return the server-side path.
 */
async function uploadImage(dataUrl: string): Promise<{
  path: string;
  size: number;
  mimeType: string;
}> {
  // Parse data URL
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL format");
  }
  const mimeType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");

  // Determine extension
  const ext =
    mimeType === "image/jpeg"
      ? "jpg"
      : mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : "img";
  const filename = `upload-${Date.now()}.${ext}`;

  // Build multipart form
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("files", blob, filename);

  const response = await fetch(`${SPACE_BASE}/gradio_api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `HF Space upload failed: ${response.status} ${errText.slice(0, 200)}`
    );
  }

  const result = (await response.json()) as string[];
  if (!Array.isArray(result) || !result[0]) {
    throw new Error(`HF Space upload returned no path: ${JSON.stringify(result)}`);
  }

  return {
    path: result[0],
    size: buffer.length,
    mimeType,
  };
}

/**
 * Poll the queue stream for completion.
 *
 * Returns the output image URL when process_completed is received.
 */
async function streamUntilComplete(
  sessionHash: string,
  timeoutMs = 280000
): Promise<{ imageUrl: string; seed: number; prompt: string }> {
  const streamUrl = `${SPACE_BASE}/gradio_api/queue/data?session_hash=${encodeURIComponent(
    sessionHash
  )}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(streamUrl, {
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `HF Space stream failed: ${response.status} ${response.statusText}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastRank = 0;
    let lastLog = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages (separated by \n\n)
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";

      for (const msg of messages) {
        const lines = msg.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);

          let data;
          try {
            data = JSON.parse(payload);
          } catch {
            continue;
          }

          const msgType = data.msg || data.type;

          if (msgType === "estimation") {
            lastRank = data.rank ?? 0;
            console.log(
              `[hf-space] Queue rank: ${lastRank}, size: ${data.queue_size}, eta: ${data.rank_eta}s`
            );
          } else if (msgType === "log") {
            lastLog = data.log || "";
            console.log(`[hf-space] ${data.level || "info"}: ${lastLog}`);
          } else if (msgType === "process_starts") {
            console.log("[hf-space] Process starting on GPU...");
          } else if (msgType === "process_generating") {
            console.log("[hf-space] Generating...");
          } else if (msgType === "process_completed") {
            console.log("[hf-space] ✅ Completed!");
            const output = data.output?.data;
            if (!output || !output[0]) {
              throw new Error(
                `HF Space completed but no output: ${JSON.stringify(data.output).slice(0, 300)}`
              );
            }
            const outputImage = output[0];
            const seed = output[1] ?? 0;
            const prompt = output[2] ?? "";

            // Get image URL — HF Space returns both path and url
            const imageUrl =
              outputImage.url ||
              `${SPACE_BASE}/gradio_api/file=${outputImage.path}`;

            return { imageUrl, seed, prompt };
          } else if (msgType === "close_stream") {
            // Stream ended without completion — likely an error
            throw new Error(
              `HF Space stream closed unexpectedly. Last log: ${lastLog}`
            );
          } else if (msgType === "error") {
            throw new Error(
              `HF Space error: ${data.message || JSON.stringify(data).slice(0, 300)}`
            );
          }
        }
      }
    }

    throw new Error("HF Space stream ended without process_completed event");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate a camera-angle edit via the HF Space Gradio API.
 *
 * @param sourceImageDataUrl Data URL of the source image
 * @param params Camera parameters (azimuth, elevation, distance)
 * @returns Result with base64 image + seed + prompt
 */
export async function generateCameraEdit(
  sourceImageDataUrl: string,
  params: { azimuth: number; elevation: number; distance: number },
  options?: {
    seed?: number;
    randomizeSeed?: boolean;
    guidanceScale?: number;
    numInferenceSteps?: number;
    width?: number;
    height?: number;
  }
): Promise<HfSpaceResult> {
  const hfParams = convertToHfSpaceParams(params);
  console.log("[hf-space] Converted params:", params, "→", hfParams);

  // Step 1: Upload image
  const uploaded = await uploadImage(sourceImageDataUrl);
  console.log("[hf-space] Uploaded:", uploaded.path);

  // Step 2: Join queue
  const sessionHash =
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);

  const imageData = {
    path: uploaded.path,
    orig_name: "upload.jpg",
    size: uploaded.size,
    mime_type: uploaded.mimeType,
    is_stream: false,
    meta: { _type: "gradio.FileData" },
  };

  // Order: [image, azimuth, elevation, distance, seed, randomize_seed,
  //         guidance_scale, num_inference_steps, height, width]
  const dataPayload = [
    imageData,
    hfParams.azimuth,
    hfParams.elevation,
    hfParams.distance,
    options?.seed ?? 0,
    options?.randomizeSeed ?? true,
    options?.guidanceScale ?? 1.0,
    options?.numInferenceSteps ?? 4,
    options?.height ?? 1024,
    options?.width ?? 1024,
  ];

  const joinResponse = await fetch(`${SPACE_BASE}/gradio_api/queue/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: dataPayload,
      fn_index: FN_INDEX_INFER_CAMERA_EDIT,
      session_hash: sessionHash,
    }),
  });

  if (!joinResponse.ok) {
    const errText = await joinResponse.text();
    throw new Error(
      `HF Space join failed: ${joinResponse.status} ${errText.slice(0, 200)}`
    );
  }

  const joinResult = (await joinResponse.json()) as { event_id: string };
  console.log("[hf-space] Joined queue:", joinResult.event_id);

  // Step 3: Stream until completion
  const { imageUrl, seed, prompt } = await streamUntilComplete(sessionHash);

  // Step 4: Download the result image
  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) {
    throw new Error(
      `HF Space result download failed: ${imgResponse.status} ${imgResponse.statusText}`
    );
  }

  const arrayBuffer = await imgResponse.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    base64,
    seed,
    prompt,
    outputUrl: imageUrl,
  };
}
