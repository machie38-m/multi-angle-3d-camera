import { NextRequest, NextResponse } from "next/server";
import { buildCameraPrompt, type CameraParams } from "@/lib/camera";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — generation can take a while

interface GenerateRequest {
  image: string; // data URL (base64)
  params: CameraParams;
  size?: string;
}

const SUPPORTED_SIZES = new Set([
  "1024x1024",
  "768x1344",
  "864x1152",
  "1344x768",
  "1152x864",
  "1440x720",
  "720x1440",
]);

/**
 * Read Z.AI config from env vars, with fallback to the
 * /etc/.z-ai-config file that exists on the Z.ai sandbox.
 *
 * On Vercel/other hosts, the user MUST set:
 *   - ZAI_BASE_URL   e.g. https://api.z.ai/v1
 *   - ZAI_API_KEY    your API key
 *
 * Optional:
 *   - ZAI_CHAT_ID, ZAI_USER_ID, ZAI_TOKEN
 */
async function loadZaiConfig() {
  // 1) Env vars (highest priority, works everywhere)
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
    return {
      baseUrl: process.env.ZAI_BASE_URL.replace(/\/$/, ""),
      apiKey: process.env.ZAI_API_KEY,
      chatId: process.env.ZAI_CHAT_ID ?? "",
      userId: process.env.ZAI_USER_ID ?? "",
      token: process.env.ZAI_TOKEN ?? "",
    };
  }

  // 2) Sandbox: read /etc/.z-ai-config
  try {
    const fs = await import("node:fs");
    const raw = fs.readFileSync("/etc/.z-ai-config", "utf-8");
    const cfg = JSON.parse(raw);
    if (cfg.baseUrl && cfg.apiKey) return cfg;
  } catch {
    /* ignore */
  }

  // 3) Home dir
  try {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const raw = fs.readFileSync(
      path.join(os.homedir(), ".z-ai-config"),
      "utf-8"
    );
    const cfg = JSON.parse(raw);
    if (cfg.baseUrl && cfg.apiKey) return cfg;
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Pick the closest supported size based on the source image's aspect ratio.
 */
function pickSizeFromImage(dataUrl: string): string {
  try {
    const base64 = dataUrl.split(",")[1] ?? "";
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
      const w = buffer.readUInt32BE(16);
      const h = buffer.readUInt32BE(20);
      return matchSize(w, h);
    }
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let i = 2;
      while (i < buffer.length - 8) {
        if (buffer[i] !== 0xff) break;
        const marker = buffer[i + 1];
        const segLen = buffer.readUInt16BE(i + 2);
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        ) {
          const h = buffer.readUInt16BE(i + 5);
          const w = buffer.readUInt16BE(i + 7);
          return matchSize(w, h);
        }
        i += 2 + segLen;
      }
    }
  } catch {
    /* ignore */
  }
  return "1024x1024";
}

function matchSize(w: number, h: number): string {
  const ratio = w / h;
  if (ratio > 1.5) return "1440x720";
  if (ratio > 1.15) return "1344x768";
  if (ratio < 0.6) return "720x1440";
  if (ratio < 0.85) return "768x1344";
  return "1024x1024";
}

/**
 * Call the Z.AI image edit API directly with fetch.
 * Endpoint: POST {baseUrl}/images/generations/edit
 * Headers: Authorization: Bearer {apiKey}, plus optional X-Chat-Id / X-User-Id / X-Token
 * Body: { prompt, images: [{ url }], size }
 */
async function callZaiImageEdit(
  config: NonNullable<Awaited<ReturnType<typeof loadZaiConfig>>>,
  body: {
    prompt: string;
    image: string; // data URL
    size: string;
  }
): Promise<{ base64?: string; raw: unknown }> {
  const url = `${config.baseUrl}/images/generations/edit`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    "X-Z-AI-From": "Z",
  };
  if (config.chatId) headers["X-Chat-Id"] = config.chatId;
  if (config.userId) headers["X-User-Id"] = config.userId;
  if (config.token) headers["X-Token"] = config.token;

  const requestBody = {
    prompt: body.prompt,
    images: [{ url: body.image }],
    size: body.size,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Z.AI API ${response.status}: ${errorText.slice(0, 500)}`
    );
  }

  const result = await response.json();

  // Z.AI may return either base64 directly, or a URL we need to download
  if (result?.data?.[0]?.base64) {
    return { base64: result.data[0].base64, raw: result };
  }

  if (result?.data?.[0]?.url) {
    const imgUrl = result.data[0].url as string;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to download generated image: ${imgRes.status}`);
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { base64, raw: result };
  }

  return { raw: result };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateRequest;
    const { image, params, size } = body;

    if (!image || !image.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Image is required as a data URL (data:image/...;base64,...)." },
        { status: 400 }
      );
    }
    if (
      typeof params?.azimuth !== "number" ||
      typeof params?.elevation !== "number" ||
      typeof params?.distance !== "number"
    ) {
      return NextResponse.json(
        { error: "Camera params (azimuth, elevation, distance) are required numbers." },
        { status: 400 }
      );
    }

    const config = await loadZaiConfig();
    if (!config) {
      return NextResponse.json(
        {
          error:
            "Z.AI config not found. Set ZAI_BASE_URL and ZAI_API_KEY environment variables in your Vercel project settings.",
        },
        { status: 500 }
      );
    }

    const finalSize =
      size && SUPPORTED_SIZES.has(size) ? size : pickSizeFromImage(image);

    const prompt = buildCameraPrompt(params);

    let result;
    try {
      result = await callZaiImageEdit(config, {
        prompt,
        image,
        size: finalSize,
      });
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      console.error("[/api/generate] API call failed:", msg);
      return NextResponse.json(
        {
          error:
            "Image generation API call failed. If you are running outside the Z.ai sandbox, " +
            "make sure ZAI_BASE_URL points to a reachable Z.AI endpoint. " +
            `Detail: ${msg}`,
        },
        { status: 502 }
      );
    }

    if (!result.base64) {
      return NextResponse.json(
        {
          error: "Image edit API returned no image data.",
          raw: JSON.stringify(result.raw).slice(0, 500),
        },
        { status: 502 }
      );
    }

    const dataUrl = `data:image/png;base64,${result.base64}`;

    return NextResponse.json({
      image: dataUrl,
      prompt,
      params,
      size: finalSize,
    });
  } catch (err: unknown) {
    console.error("[/api/generate] error:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error during image generation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "multi-angle-3d-camera",
    description:
      "POST a base64 image and camera params {azimuth, elevation, distance} to generate a new view.",
  });
}
