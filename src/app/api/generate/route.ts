import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { buildCameraPrompt, type CameraParams } from "@/lib/camera";
import { ensureZaiConfig } from "@/lib/zai-config";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — generation can take a while

// Ensure z-ai config is available before any SDK call.
ensureZaiConfig();

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
 * Estimate whether an image looks more landscape or portrait, then pick
 * the best supported size to preserve its aspect ratio.
 */
function pickSizeFromImage(dataUrl: string): string {
  try {
    const base64 = dataUrl.split(",")[1] ?? "";
    const buffer = Buffer.from(base64, "base64");
    // Read PNG dimensions
    if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
      const w = buffer.readUInt32BE(16);
      const h = buffer.readUInt32BE(20);
      return matchSize(w, h);
    }
    // Read JPEG dimensions (SOFn marker scan)
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

    const finalSize =
      size && SUPPORTED_SIZES.has(size) ? size : pickSizeFromImage(image);

    const prompt = buildCameraPrompt(params);

    let zai;
    try {
      zai = await ZAI.create();
    } catch (configErr) {
      const msg =
        configErr instanceof Error ? configErr.message : String(configErr);
      return NextResponse.json(
        {
          error:
            "Z.AI config not found. Set ZAI_BASE_URL and ZAI_API_KEY environment variables. " +
            `Detail: ${msg}`,
        },
        { status: 500 }
      );
    }

    let response;
    try {
      response = await zai.images.generations.edit({
        prompt,
        images: [{ url: image }],
        size: finalSize as any,
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

    if (!response?.data?.[0]?.base64) {
      return NextResponse.json(
        { error: "Image edit API returned no image." },
        { status: 502 }
      );
    }

    const base64 = response.data[0].base64;
    const dataUrl = `data:image/png;base64,${base64}`;

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
