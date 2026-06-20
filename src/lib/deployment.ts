"use client";

import { useEffect, useState } from "react";

/**
 * Active generation provider. Determined at runtime by calling /api/status.
 *
 * - "loading"      — initial state, before status check completes
 * - "sandbox"      — Z.ai sandbox (auto-injected config, best quality)
 * - "zai-public"   — Z.AI public API key set via env var
 * - "pollinations" — Pollinations.ai free tier (always available as fallback)
 */
export type GenerationProvider =
  | "loading"
  | "sandbox"
  | "zai-public"
  | "pollinations";

interface StatusResponse {
  generationEnabled: boolean;
  provider: GenerationProvider;
  mode?: string;
  note?: string;
}

let cachedStatus: StatusResponse | null = null;
let pendingFetch: Promise<StatusResponse> | null = null;

async function fetchStatus(): Promise<StatusResponse> {
  if (cachedStatus) return cachedStatus;
  if (pendingFetch) return pendingFetch;

  pendingFetch = fetch("/api/status")
    .then((r) => r.json())
    .then((data: StatusResponse) => {
      cachedStatus = data;
      return data;
    })
    .catch(() => {
      // Network error — assume Pollinations fallback is available
      const fallback: StatusResponse = {
        generationEnabled: true,
        provider: "pollinations",
        note: "Status check failed; assuming Pollinations fallback.",
      };
      cachedStatus = fallback;
      return fallback;
    })
    .finally(() => {
      pendingFetch = null;
    });

  return pendingFetch;
}

/**
 * React hook that returns the active generation provider. Calls /api/status
 * once on mount and caches the result for the rest of the session.
 */
export function useGenerationProvider(): GenerationProvider {
  const [provider, setProvider] = useState<GenerationProvider>("loading");

  useEffect(() => {
    let mounted = true;
    fetchStatus().then((s) => {
      if (mounted) setProvider(s.provider);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return provider;
}

/**
 * Synchronous helper for code that runs outside React hooks.
 * Returns the cached provider if available, or null if not yet fetched.
 */
export function getGenerationProviderSync(): GenerationProvider | null {
  return cachedStatus?.provider ?? null;
}

/**
 * Returns true if generation is enabled. Always true — Pollinations is
 * always available as a fallback even without any API key.
 */
export function isGenerationEnabled(): boolean {
  return cachedStatus?.generationEnabled ?? true;
}

/**
 * Returns a short human-friendly label for the active provider.
 * Used in the UI to give users transparency about which backend is in use.
 */
export function getProviderLabel(provider: GenerationProvider): string {
  switch (provider) {
    case "sandbox":
      return "Z.ai Sandbox";
    case "zai-public":
      return "Z.AI Public API";
    case "pollinations":
      return "Pollinations.ai (free)";
    case "loading":
      return "Checking…";
  }
}

/**
 * Returns a longer description of the active provider for tooltips.
 */
export function getProviderDescription(provider: GenerationProvider): string {
  switch (provider) {
    case "sandbox":
      return "Running inside the Z.ai sandbox — full-quality image generation via Z.AI.";
    case "zai-public":
      return "Using Z.AI public API. Highest quality. Configured via ZAI_PUBLIC_API_KEY env var.";
    case "pollinations":
      return "Using Pollinations.ai free tier. No signup required, but quality may be lower than Z.AI. Set ZAI_PUBLIC_API_KEY for higher-quality generation.";
    case "loading":
      return "Checking which image generation provider is available…";
  }
}
