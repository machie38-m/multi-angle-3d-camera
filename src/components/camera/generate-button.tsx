"use client";

import { Sparkles, Loader2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGenerate } from "@/components/camera/use-generate";
import { useAppStore } from "@/store/app-store";
import { useGenerationProvider } from "@/lib/deployment";
import { cn } from "@/lib/utils";

export function GenerateButton() {
  const { generate, isGenerating, canGenerate } = useGenerate();
  const sourceImage = useAppStore((s) => s.sourceImage);
  const error = useAppStore((s) => s.error);
  const provider = useGenerationProvider();

  const isLoadingProvider = provider === "loading";
  const buttonDisabled = isLoadingProvider || !canGenerate;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="lg"
        onClick={() => generate()}
        disabled={buttonDisabled}
        className={cn(
          "w-full gap-2 h-12 text-sm font-semibold",
          "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
          "hover:from-primary/90 hover:to-primary/70",
          "border border-primary/40 glow-emerald",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:glow-emerald-none"
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : isLoadingProvider ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking availability…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate New Angle
          </>
        )}
      </Button>

      {!sourceImage && !isLoadingProvider && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ImageOff className="h-3 w-3" />
          Upload a photo to enable generation
        </p>
      )}

      {provider === "pollinations" && !isGenerating && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/70 leading-relaxed">
          Using free Pollinations.ai provider. For higher-quality results,
          set the <code className="text-amber-200">ZAI_PUBLIC_API_KEY</code>{" "}
          env var to your Z.AI public API key.
        </p>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
