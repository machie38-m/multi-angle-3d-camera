import { NextRequest, NextResponse } from "next/server";
import { generateCameraEdit } from "@/lib/hf-space-client";
import type { CameraParams } from "@/lib/camera";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — HF Space ZeroGPU queue can take 30s+

interface GenerateRequest {
  image: string; // data URL (base64)
  params: CameraParams;
  size?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateRequest;
    const { image, params } = body;

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

    // Call HF Space Gradio API (multimodalart/qwen-image-multiple-angles-3d-camera)
    // No API key required — runs anonymously on Hugging Face ZeroGPU.
    let result;
    try {
      result = await generateCameraEdit(image, params);
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      console.error("[/api/generate] HF Space call failed:", msg);
      return NextResponse.json(
        {
          error:
            "Image generation failed. The HF Space may be sleeping or out of GPU capacity. " +
            `Detail: ${msg}`,
        },
        { status: 502 }
      );
    }

    if (!result.base64) {
      return NextResponse.json(
        { error: "HF Space returned no image data." },
        { status: 502 }
      );
    }

    // HF Space returns WebP. Convert data URL mime to image/webp.
    const dataUrl = `data:image/webp;base64,${result.base64}`;

    return NextResponse.json({
      image: dataUrl,
      prompt: result.prompt,
      params,
      seed: result.seed,
      provider: "hf-space",
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
    provider: "hf-space",
    backend: "multimodalart/qwen-image-multiple-angles-3d-camera (Hugging Face Space)",
  });
}
