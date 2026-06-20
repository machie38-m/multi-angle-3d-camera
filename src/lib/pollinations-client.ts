/**
 * Pollinations.ai image-edit provider — free, no auth required.
 *
 * Endpoint: GET https://image.pollinations.ai/prompt/{prompt}?model=flux&image={url}
 *
 * Workflow:
 *   1. User uploads image (base64) to our API route.
 *   2. API route uploads the image to tmpfiles.org (anonymous, no auth).
 *      → receives a public URL like https://tmpfiles.org/dl/xxxxx/file.jpg
 *   3. API route calls Pollinations with that URL as the `image` parameter.
 *   4. Pollinations returns the transformed image as binary.
 *   5. API route encodes the result as base64 and returns to the client.
 *
 * This provider is used when neither Z.AI sandbox config nor Z.AI public
 * API key is available. It's free, no signup, no rate limit (officially),
 * but quality is lower than Z.AI and the img2img behavior is approximate.
 */

const TMPFILES_UPLOAD_URL = "https://tmpfiles.org/api/v1/upload";
const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

export interface PollinationsResult {
  base64: string;
  sourceUrl: string; // the tmpfiles.org URL we generated
  pollinationsUrl: string; // the full pollinations URL (for debugging)
}

/**
 * Upload a base64 data URL to tmpfiles.org and return the direct-download URL.
 *
 * tmpfiles.org returns a wrapper page URL like:
 *   https://tmpfiles.org/abc123/file.jpg
 * We need the direct download URL:
 *   https://tmpfiles.org/dl/abc123/file.jpg
 */
async function uploadToTmpFiles(dataUrl: string): Promise<string> {
  // Decode the data URL into a Blob/Buffer
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL format");
  }
  const mimeType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");

  // Map MIME type to file extension
  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "img";
  const filename = `upload-${Date.now()}.${ext}`;

  // Build multipart form using FormData (Node 18+ has global FormData)
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("file", blob, filename);

  const response = await fetch(TMPFILES_UPLOAD_URL, {
    method: "POST",
    body: formData,
    headers: {
      "User-Agent": "multi-angle-3d-camera/1.0 (https://github.com/machie38-m/multi-angle-3d-camera)",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`tmpfiles.org upload failed: ${response.status} ${errText.slice(0, 200)}`);
  }

  const result = (await response.json()) as {
    status: string;
    data: { url: string };
  };

  if (result.status !== "success" || !result.data?.url) {
    throw new Error(`tmpfiles.org upload failed: ${JSON.stringify(result).slice(0, 200)}`);
  }

  // Convert wrapper URL to direct-download URL:
  // https://tmpfiles.org/abc123/file.jpg → https://tmpfiles.org/dl/abc123/file.jpg
  const wrapperUrl = result.data.url;
  const directUrl = wrapperUrl.replace(
    /^https?:\/\/tmpfiles\.org\/([^/]+\/[^/]+)$/,
    "https://tmpfiles.org/dl/$1"
  );

  if (directUrl === wrapperUrl) {
    // Fallback: insert /dl/ after the domain
    return wrapperUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
  }

  return directUrl;
}

/**
 * Map our internal camera-edit prompt + image size to Pollinations
 * width/height parameters.
 *
 * Pollinations only accepts integer width/height — it doesn't have a
 * fixed list of supported sizes like Z.AI. We pick the closest standard
 * resolution that preserves the source aspect ratio.
 */
function parseSize(size: string): { width: number; height: number } {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return { width: 1024, height: 1024 };
  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
  };
}

/**
 * Call Pollinations image-to-image API.
 *
 * Returns the generated image as base64.
 */
export async function callPollinationsImageEdit(params: {
  prompt: string;
  imageDataUrl: string; // base64 data URL of the source image
  size: string;
}): Promise<PollinationsResult> {
  // Step 1: upload source image to tmpfiles.org to get a public URL
  const sourceUrl = await uploadToTmpFiles(params.imageDataUrl);

  // Step 2: build Pollinations URL
  const { width, height } = parseSize(params.size);
  const encodedPrompt = encodeURIComponent(params.prompt);
  const pollinationsUrl = new URL(`${POLLINATIONS_BASE}/${encodedPrompt}`);
  pollinationsUrl.searchParams.set("model", "flux");
  pollinationsUrl.searchParams.set("image", sourceUrl);
  pollinationsUrl.searchParams.set("width", String(width));
  pollinationsUrl.searchParams.set("height", String(height));
  pollinationsUrl.searchParams.set("nologo", "true");
  pollinationsUrl.searchParams.set("private", "true");
  // Use a deterministic seed based on the prompt + source URL so re-runs
  // of the same prompt produce consistent results (helps with history).
  const seed = Math.abs(
    Array.from(params.prompt + sourceUrl).reduce(
      (acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0,
      7
    )
  ) % 1000000;
  pollinationsUrl.searchParams.set("seed", String(seed));

  // Step 3: fetch the result (Pollinations returns binary image data)
  const response = await fetch(pollinationsUrl.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "multi-angle-3d-camera/1.0",
      Accept: "image/*",
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Pollinations API ${response.status}: ${errText.slice(0, 300)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    base64,
    sourceUrl,
    pollinationsUrl: pollinationsUrl.toString(),
  };
}
