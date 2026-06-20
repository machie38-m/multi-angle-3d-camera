"use client";

import { AlertTriangle, ExternalLink, X, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  useDeploymentMode,
  getShowcaseReason,
} from "@/lib/deployment";

/**
 * Top-of-page banner shown only in showcase mode. Explains why generation
 * is disabled and what the user can do to enable it.
 */
export function ShowcaseBanner() {
  const mode = useDeploymentMode();
  const [dismissed, setDismissed] = useState(false);

  // Loading: render nothing (avoid layout shift)
  if (mode === "loading") return null;
  // Sandbox / public: full mode, no banner needed
  if (mode !== "showcase") return null;
  if (dismissed) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-amber-500/30 bg-amber-500/10 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-200">
              Showcase Mode — AI generation is disabled
            </p>
            <p className="mt-0.5 text-[11px] text-amber-100/70 leading-relaxed">
              {getShowcaseReason()}
            </p>
            <a
              href="https://z.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2"
            >
              Get a Z.AI API key to enable generation
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="shrink-0 rounded p-1 text-amber-300/60 hover:bg-amber-500/10 hover:text-amber-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small loading indicator shown in the GenerateButton while deployment
 * mode is still being checked.
 */
export function ModeLoadingSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}
