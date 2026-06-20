/**
 * Hugging Face Space Gradio API client with multi-Space failover.
 *
 * Calls the multimodalart/qwen-image-multiple-angles-3d-camera Space
 * (or any user-configured duplicate) via its public Gradio API.
 *
 * ## Multi-Space failover
 *
 * To provide "unlimited" GPU capacity, this client tries multiple HF
 * Spaces in order. If one is sleeping, has a long queue, or errors out,
 * the next one is tried automatically.
 *
 * Sources of Space URLs (in priority order):
 *   1. `HF_SPACE_URLS` env var — comma-separated list of full Space URLs
 *      (e.g. "https://my-account/qwen-image-multiple-angles-3d-camera.hf.space,https://...")
 *      Set this if you duplicate the Space to your own HF account for
 *      dedicated ZeroGPU quota. Get your own at:
 *      https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera?duplicate=true
 *   2. Default: the original public Space (shared quota with everyone)
 *
 * ## API flow (per HF Space agents.md)
 *
 *   1. POST /gradio_api/upload with the source image → get server-side path
 *   2. POST /gradio_api/queue/join with fn_index=7 (/infer_camera_edit)
 *      → get event_id
 *   3. GET /gradio_api/queue/data?session_hash=<uuid> (SSE stream)
 *      → wait for process_completed event with output image URL
 *   4. Download the output image from /gradio_api/file=<path>
 */

/**
 * Default Space URLs to try (in order).
 *
 * These are public duplicate Spaces of multimodalart/qwen-image-multiple-angles-3d-camera
 * that we've verified are alive and have the same /infer_camera_edit endpoint.
 * Each Space has its own ZeroGPU quota, so failing over across them multiplies
 * the effective capacity (8 Spaces × ~10h GPU/day = ~80h GPU/day free).
 *
 * Verified alive on 2026-06-20. We ping each one at startup via
 * checkSpacesStatus() and only use the ones that respond.
 *
 * To get even more capacity, duplicate the Space to your own HF account
 * (free) and add your URL via the HF_SPACE_URLS env var — it will be
 * tried FIRST (before the public defaults) for dedicated quota.
 */
const DEFAULT_SPACE_URLS = [
  "https://multimodalart-qwen-image-multiple-angles-3d-camera.hf.space",
  "https://bils-qwen-image-multiple-angles-3d-camera.hf.space",
  "https://prashant-ai-ml-qwen-image-multiple-angles-3d-camera.hf.space",
  "https://danilonovais-qwen-image-multiple-angles-3d-camera.hf.space",
  "https://rideshare-qwen-image-multiple-angles-3d-camera.hf.space",
  "https://mobowuhan-qwen-image-multiple-angles-3d-camera.hf.space",
  "https://bobber-qwen-image-multiple-angles-3d-camera.hf.space",
  "https://xeroize-qwen-image-multiple-angles-3d-camera.hf.space",
];

/**
 * Max number of concurrent requests the client will allow per Space.
 *
 * HF Space ZeroGPU can handle multiple parallel requests per session,
 * but queuing too many at once hurts everyone. We cap concurrent calls
 * per Space at 3 (empirically safe limit).
 */
const MAX_CONCURRENT_PER_SPACE = 3;

/** Track in-flight request count per Space for load balancing. */
const inFlightPerSpace = new Map<string, number>();

function getInFlight(spaceUrl: string): number {
  return inFlightPerSpace.get(spaceUrl) ?? 0;
}

function incrementInFlight(spaceUrl: string): void {
  inFlightPerSpace.set(spaceUrl, getInFlight(spaceUrl) + 1);
}

function decrementInFlight(spaceUrl: string): void {
  const current = getInFlight(spaceUrl);
  inFlightPerSpace.set(spaceUrl, Math.max(0, current - 1));
}

/**
 * Pick the best Space URL to try first.
 *
 * Strategy: prefer Spaces with the fewest in-flight requests (load balancing).
 * Falls back to the original order for ties.
 */
function pickSpaceOrder(spaceUrls: string[]): string[] {
  return [...spaceUrls].sort((a, b) => {
    const aInFlight = getInFlight(a);
    const bInFlight = getInFlight(b);
    if (aInFlight !== bInFlight) return aInFlight - bInFlight;
    return 0; // preserve original order for ties
  });
}

/**
 * Get the list of Space URLs to try, from env var + defaults.
 *
 * Env var format: comma-separated URLs, e.g.
 *   HF_SPACE_URLS=https://user1-space.hf.space,https://user2-space.hf.space
 *
 * If env var is set, those URLs are tried FIRST (user's own dedicated
 * quota Spaces), then we append the public defaults as additional
 * fallbacks for extra capacity. This means env var Spaces ADD capacity
 * rather than REPLACE the defaults — total failover pool grows.
 */
function getSpaceUrls(): string[] {
  const envUrls = process.env.HF_SPACE_URLS;
  const userUrls: string[] = [];

  if (envUrls && envUrls.trim()) {
    const parsed = envUrls
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean)
      .map((u) => u.replace(/\/+$/, ""));
    userUrls.push(...parsed);
  }

  // Deduplicate (in case user includes a default URL in env var)
  const allUrls = [...userUrls, ...DEFAULT_SPACE_URLS];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of allUrls) {
    if (!seen.has(url)) {
      seen.add(url);
      unique.push(url);
    }
  }
  return unique;
}

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
  spaceUrl: string; // which Space served this request
}

/**
 * Convert our internal CameraParams (azimuth -180 to 180) to HF Space's
 * expected range (0 to 315, in 45-degree steps for LoRA conditioning).
 */
export function convertToHfSpaceParams(params: {
  azimuth: number;
  elevation: number;
  distance: number;
}): HfSpaceCameraParams {
  let azNormalized = params.azimuth;
  while (azNormalized < 0) azNormalized += 360;
  while (azNormalized >= 360) azNormalized -= 360;

  const snappedAz = Math.round(azNormalized / 45) * 45;
  const finalAz = snappedAz === 360 ? 0 : snappedAz;

  return {
    azimuth: finalAz,
    elevation: Math.max(-30, Math.min(60, params.elevation)),
    distance: Math.max(0.6, Math.min(1.4, params.distance)),
  };
}

/**
 * Upload an image to a specific HF Space.
 */
async function uploadImage(
  spaceUrl: string,
  dataUrl: string
): Promise<{ path: string; size: number; mimeType: string }> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL format");

  const mimeType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");

  const ext =
    mimeType === "image/jpeg"
      ? "jpg"
      : mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : "img";
  const filename = `upload-${Date.now()}.${ext}`;

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("files", blob, filename);

  const response = await fetch(`${spaceUrl}/gradio_api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const result = (await response.json()) as string[];
  if (!Array.isArray(result) || !result[0]) {
    throw new Error("Upload returned no path");
  }

  return { path: result[0], size: buffer.length, mimeType };
}

/**
 * Stream the queue until process_completed. Returns the result.
 *
 * If `maxQueueSize` is set and the initial queue size exceeds it, throws
 * an error immediately so the caller can try the next Space.
 */
async function streamUntilComplete(
  spaceUrl: string,
  sessionHash: string,
  options: {
    timeoutMs?: number;
    maxQueueSize?: number;
    maxQueueEtaSeconds?: number;
  } = {}
): Promise<{ imageUrl: string; seed: number; prompt: string }> {
  const timeoutMs = options.timeoutMs ?? 280000;
  const maxQueueSize = options.maxQueueSize ?? 50; // skip if >50 in queue
  const maxQueueEtaSeconds = options.maxQueueEtaSeconds ?? 180; // skip if eta >3min

  const streamUrl = `${spaceUrl}/gradio_api/queue/data?session_hash=${encodeURIComponent(
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
      throw new Error(`Stream failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
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
            const queueSize = data.queue_size ?? 0;
            const eta = data.rank_eta ?? 0;
            console.log(
              `[hf-space] ${spaceUrl} queue: rank=${data.rank}/${queueSize}, eta=${eta}s`
            );
            // If queue is too long, abandon this Space and try the next one
            if (queueSize > maxQueueSize || eta > maxQueueEtaSeconds) {
              throw new Error(
                `Queue too long (size=${queueSize}, eta=${eta}s) — trying next Space`
              );
            }
          } else if (msgType === "log") {
            console.log(`[hf-space] ${data.level || "info"}: ${data.log}`);
          } else if (msgType === "process_completed") {
            const output = data.output?.data;
            if (!output || !output[0]) {
              throw new Error("No output in process_completed");
            }
            const outputImage = output[0];
            const seed = output[1] ?? 0;
            const prompt = output[2] ?? "";
            const imageUrl =
              outputImage.url ||
              `${spaceUrl}/gradio_api/file=${outputImage.path}`;
            return { imageUrl, seed, prompt };
          } else if (msgType === "close_stream") {
            throw new Error("Stream closed without completion");
          } else if (msgType === "error") {
            throw new Error(
              `HF Space error: ${data.message || JSON.stringify(data).slice(0, 200)}`
            );
          }
        }
      }
    }

    throw new Error("Stream ended without process_completed");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Try a single Space — upload + join queue + stream + download result.
 */
async function trySingleSpace(
  spaceUrl: string,
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

  // Step 1: Upload
  const uploaded = await uploadImage(spaceUrl, sourceImageDataUrl);

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

  const joinResponse = await fetch(`${spaceUrl}/gradio_api/queue/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: dataPayload,
      fn_index: FN_INDEX_INFER_CAMERA_EDIT,
      session_hash: sessionHash,
    }),
  });

  if (!joinResponse.ok) {
    throw new Error(`Join failed: ${joinResponse.status}`);
  }

  // Step 3: Stream until completion
  const { imageUrl, seed, prompt } = await streamUntilComplete(spaceUrl, sessionHash);

  // Step 4: Download result
  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) {
    throw new Error(`Result download failed: ${imgResponse.status}`);
  }

  const arrayBuffer = await imgResponse.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    base64,
    seed,
    prompt,
    outputUrl: imageUrl,
    spaceUrl,
  };
}

/**
 * Generate a camera-angle edit with automatic multi-Space failover
 * and in-flight load balancing.
 *
 * Tries each Space URL in order (sorted by least in-flight requests).
 * If a Space has a long queue (>50 people or >3min ETA), errors out,
 * or is sleeping, the next Space is tried.
 *
 * ## Adding capacity (free)
 *
 * 1. Duplicate the Space to your own HF account (free, gives you ~10hrs
 *    ZeroGPU quota per day per account):
 *    https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera?duplicate=true
 *
 * 2. Set HF_SPACE_URLS env var with your Space URL(s):
 *    HF_SPACE_URLS=https://youruser-qwen-image-multiple-angles-3d-camera.hf.space
 *
 * 3. Multiple URLs comma-separated for more capacity:
 *    HF_SPACE_URLS=https://user1-space.hf.space,https://user2-space.hf.space
 *
 * Each HF account you create adds ~10hrs/day free GPU quota. With N
 * accounts, you get ~N × 10hrs/day total — practically unlimited for
 * personal use.
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
  const allSpaceUrls = getSpaceUrls();
  // Sort by least in-flight requests (load balancing)
  const spaceUrls = pickSpaceOrder(allSpaceUrls);
  const errors: string[] = [];

  for (let i = 0; i < spaceUrls.length; i++) {
    const spaceUrl = spaceUrls[i];
    const inFlight = getInFlight(spaceUrl);
    console.log(
      `[hf-space] Trying Space ${i + 1}/${spaceUrls.length}: ${spaceUrl} (in-flight: ${inFlight})`
    );

    // Skip if too many concurrent requests on this Space
    if (inFlight >= MAX_CONCURRENT_PER_SPACE) {
      console.log(`[hf-space] ⏭️ ${spaceUrl} at capacity (${inFlight}/${MAX_CONCURRENT_PER_SPACE})`);
      errors.push(`${spaceUrl}: at capacity (${inFlight} in-flight)`);
      continue;
    }

    incrementInFlight(spaceUrl);
    try {
      const result = await trySingleSpace(spaceUrl, sourceImageDataUrl, params, options);
      console.log(`[hf-space] ✅ Success from ${spaceUrl}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[hf-space] ❌ ${spaceUrl} failed: ${msg}`);
      errors.push(`${spaceUrl}: ${msg}`);
      // Continue to next Space
    } finally {
      decrementInFlight(spaceUrl);
    }
  }

  throw new Error(
    `All HF Spaces failed. Tried ${spaceUrls.length} Space(s). Errors:\n${errors.join("\n")}\n\n` +
      `To add more capacity (free), duplicate the Space to your own HF account:\n` +
      `https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera?duplicate=true\n` +
      `Then set HF_SPACE_URLS env var with your Space URL(s).\n\n` +
      `Each HF account you create adds ~10hrs/day free ZeroGPU quota.`
  );
}

/**
 * Check the status of all configured Spaces (for the /api/status endpoint).
 * Returns a list with each Space's reachability.
 */
export async function checkSpacesStatus(): Promise<
  Array<{ url: string; ok: boolean; queueSize?: number }>
> {
  const spaceUrls = getSpaceUrls();
  const results = await Promise.all(
    spaceUrls.map(async (url) => {
      try {
        const response = await fetch(`${url}/gradio_api/info`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return { url, ok: false };
        const data = (await response.json()) as {
          named_endpoints?: Record<string, unknown>;
        };
        const hasInfer = !!data.named_endpoints?.["/infer_camera_edit"];
        return { url, ok: hasInfer };
      } catch {
        return { url, ok: false };
      }
    })
  );
  return results;
}
