import { NextResponse } from "next/server";
import { loadZaiConfig } from "@/lib/zai-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight status endpoint that the client polls on mount to learn
 * whether generation is available on this deployment.
 *
 * Returns:
 *   { generationEnabled: boolean, mode: "sandbox" | "public" | "showcase" }
 */
export async function GET() {
  const config = await loadZaiConfig();
  if (!config) {
    return NextResponse.json({
      generationEnabled: false,
      mode: "showcase",
      reason:
        "No Z.AI config found. Set ZAI_PUBLIC_API_KEY env var to enable generation.",
    });
  }
  return NextResponse.json({
    generationEnabled: true,
    mode: config.isSandbox ? "sandbox" : "public",
  });
}
