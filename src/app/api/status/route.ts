import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status endpoint. Generation is ALWAYS enabled — we use the public
 * Hugging Face Space (multimodalart/qwen-image-multiple-angles-3d-camera)
 * as the backend, which runs anonymously on Hugging Face ZeroGPU.
 * No API key or setup required.
 */
export async function GET() {
  return NextResponse.json({
    generationEnabled: true,
    provider: "hf-space",
    backend: "multimodalart/qwen-image-multiple-angles-3d-camera",
  });
}
