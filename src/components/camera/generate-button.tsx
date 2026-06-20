"use client";

import { Sparkles, Loader2, ImageOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGenerate } from "@/components/camera/use-generate";
import { useAppStore } from "@/store/app-store";
import {
  useDeploymentMode,
  getShowcaseReason,
} from "@/lib/deployment";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function GenerateButton() {
  const { generate, isGenerating, canGenerate } = useGenerate();
  const sourceImage = useAppStore((s) => s.sourceImage);
  const error = useAppStore((s) => s.error);
  const mode = useDeploymentMode();

  const isLoadingMode = mode === "loading";
  const showcaseDisabled = mode === "showcase";
  const buttonDisabled = isLoadingMode || showcaseDisabled || !canGenerate;

  const button = (
    <Button
      type="button"
      size="lg"
      onClick={showcaseDisabled || isLoadingMode ? undefined : () => generate()}
      disabled={buttonDisabled}
      className={cn(
        "w-full gap-2 h-12 text-sm font-semibold",
        showcaseDisabled || isLoadingMode
          ? "bg-muted text-muted-foreground border border-white/10 cursor-not-allowed"
          : "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 border border-primary/40 glow-emerald disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating…
        </>
      ) : isLoadingMode ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking availability…
        </>
      ) : showcaseDisabled ? (
        <>
          <Lock className="h-4 w-4" />
          Generation Disabled (Showcase Mode)
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Generate New Angle
        </>
      )}
    </Button>
  );

  return (
    <div className="space-y-2">
      {showcaseDisabled ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-center">
              <p className="text-xs leading-relaxed">{getShowcaseReason()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      {!sourceImage && !showcaseDisabled && !isLoadingMode && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ImageOff className="h-3 w-3" />
          Upload a photo to enable generation
        </p>
      )}

      {showcaseDisabled && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/80 leading-relaxed">
          This is a showcase deployment. The full AI pipeline requires a
          Z.AI public API key. The UI (upload, camera control, history) is
          fully functional — explore it freely.
        </p>
      )}

      {error && !showcaseDisabled && !isLoadingMode && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
