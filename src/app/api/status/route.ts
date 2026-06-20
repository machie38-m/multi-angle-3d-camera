import { NextResponse } from "next/server";
import { checkSpacesStatus } from "@/lib/hf-space-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status endpoint. Generation is ALWAYS enabled — we use the public
 * Hugging Face Space (multimodalart/qwen-image-multiple-angles-3d-camera)
 * as the backend, which runs anonymously on Hugging Face ZeroGPU.
 *
 * Multi-Space failover: if HF_SPACE_URLS env var is set (comma-separated
 * list of Space URLs), each is checked for reachability.
 */
export async function GET() {
  let spaces: Array<{ url: string; ok: boolean }> = [];
  try {
    spaces = await Promise.race([
      checkSpacesStatus(),
      new Promise<Array<{ url: string; ok: boolean }>>((resolve) =>
        setTimeout(() => resolve([]), 6000)
      ),
    ]);
  } catch {
    /* ignore — return default */
  }

  const healthyCount = spaces.filter((s) => s.ok).length;

  return NextResponse.json({
    generationEnabled: true,
    provider: "hf-space",
    backend: "multimodalart/qwen-image-multiple-angles-3d-camera",
    spacesConfigured: spaces.length,
    spacesHealthy: healthyCount,
    spaces: spaces.map((s) => ({
      url: s.url,
      status: s.ok ? "ok" : "unreachable",
    })),
    unlimitedHint:
      "For unlimited GPU capacity, duplicate the Space to your own HF account " +
      "(https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera?duplicate=true) " +
      "and set HF_SPACE_URLS env var with your Space URL(s).",
  });
}
