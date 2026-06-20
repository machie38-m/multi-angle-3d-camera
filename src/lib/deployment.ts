"use client";

import { useEffect, useState } from "react";

/**
 * Deployment mode. Determined at runtime by calling /api/status.
 *
 * - "loading"     — initial state, before status check completes
 * - "sandbox"     — running inside the Z.ai sandbox (full feature, JWT auto-injected)
 * - "public"      — running on Vercel/Netlify/etc. with a valid ZAI_PUBLIC_API_KEY
 * - "showcase"    — no Z.AI config available; UI works but generation disabled
 */
export type DeploymentMode = "loading" | "sandbox" | "public" | "showcase";

interface StatusResponse {
  generationEnabled: boolean;
  mode: DeploymentMode;
  reason?: string;
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
      // Network error — assume showcase
      const fallback: StatusResponse = {
        generationEnabled: false,
        mode: "showcase",
        reason: "Failed to check API status.",
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
 * React hook that returns the current deployment mode. Calls /api/status
 * once on mount and caches the result for the rest of the session.
 */
export function useDeploymentMode(): DeploymentMode {
  const [mode, setMode] = useState<DeploymentMode>("loading");

  useEffect(() => {
    let mounted = true;
    fetchStatus().then((s) => {
      if (mounted) setMode(s.mode);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return mode;
}

/**
 * Synchronous helper for code that runs outside React hooks
 * (e.g. inside event handlers). Returns the cached status if available,
 * or null if not yet fetched.
 */
export function getDeploymentModeSync(): DeploymentMode | null {
  return cachedStatus?.mode ?? null;
}

/**
 * Returns true if generation is enabled (sandbox or public mode).
 */
export function isGenerationEnabled(): boolean {
  return cachedStatus?.generationEnabled ?? false;
}

/**
 * Returns a human-friendly explanation for why generation is disabled.
 */
export function getShowcaseReason(): string {
  if (cachedStatus?.reason) return cachedStatus.reason;
  return (
    "Image generation is disabled in this deployment. To enable it, set " +
    "the ZAI_PUBLIC_API_KEY environment variable to your Z.AI public API key " +
    "(get one at https://z.ai → API Keys)."
  );
}
