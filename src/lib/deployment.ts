"use client";

import { useEffect, useState } from "react";

/**
 * Generation provider status. Determined at runtime by calling /api/status.
 *
 * - "loading"   — initial state, before status check completes
 * - "hf-space"  — using Hugging Face Space (always available, anonymous)
 */
export type GenerationProvider = "loading" | "hf-space";

interface StatusResponse {
  generationEnabled: boolean;
  provider: GenerationProvider;
  backend?: string;
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
      // Network error — assume HF Space (default)
      const fallback: StatusResponse = {
        generationEnabled: true,
        provider: "hf-space",
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
 * React hook that returns the active generation provider.
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

export function isGenerationEnabled(): boolean {
  return cachedStatus?.generationEnabled ?? true;
}

export function getProviderLabel(provider: GenerationProvider): string {
  switch (provider) {
    case "hf-space":
      return "Qwen Image Edit";
    case "loading":
      return "Checking…";
  }
}

export function getProviderDescription(provider: GenerationProvider): string {
  switch (provider) {
    case "hf-space":
      return "Powered by multimalart/qwen-image-multiple-angles-3d-camera on Hugging Face Space. Qwen-Image-Edit-2511 with Multiple-Angles LoRA for precise camera control. Free, anonymous, no signup.";
    case "loading":
      return "Checking which image generation provider is available…";
  }
}
