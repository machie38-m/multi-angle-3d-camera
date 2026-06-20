import { NextResponse } from "next/server";
import { loadZaiConfig } from "@/lib/zai-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight status endpoint that the client polls on mount to learn
 * which generation provider is active on this deployment.
 *
 * Provider priority:
 *   1. "sandbox"     — Z.ai sandbox (auto-injected config, best quality)
 *   2. "zai-public"  — Z.AI public API (requires ZAI_PUBLIC_API_KEY)
 *   3. "pollinations" — Pollinations.ai (always available, free, no auth)
 *
 * Generation is ALWAYS enabled because Pollinations.ai requires no
 * authentication. The provider field tells the client which backend
 * is in use for transparency.
 */
export async function GET() {
  const config = await loadZaiConfig();
  if (config) {
    return NextResponse.json({
      generationEnabled: true,
      provider: config.isSandbox ? "sandbox" : "zai-public",
      mode: config.isSandbox ? "sandbox" : "public",
    });
  }
  // No Z.AI config — fall back to Pollinations (always available)
  return NextResponse.json({
    generationEnabled: true,
    provider: "pollinations",
    mode: "pollinations",
    note: "Using Pollinations.ai (free, no auth). Set ZAI_PUBLIC_API_KEY for higher-quality Z.AI generation.",
  });
}
