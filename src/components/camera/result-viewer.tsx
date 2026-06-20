"use client";

import { useState } from "react";
import { Download, RefreshCw, Maximize2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeCameraShort, type CameraParams } from "@/lib/camera";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGenerate } from "@/components/camera/use-generate";

interface Props {
  sourceImage: string | null;
  result: { image: string; params: CameraParams; prompt: string } | null;
  isGenerating: boolean;
}

export function ResultViewer({
  sourceImage,
  result,
  isGenerating,
}: Props) {
  const { generate, isGenerating: hookGenerating } = useGenerate();
  const onRegenerate = () => generate();
  const generating = isGenerating || hookGenerating;
  const regenerateDisabled = generating;
  const [showCompare, setShowCompare] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Generated View
        </h3>
        <div className="flex items-center gap-1.5">
          {sourceImage && result && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setShowCompare((v) => !v)}
            >
              {showCompare ? "Single" : "Compare"}
            </Button>
          )}
          {result && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoomOpen(true)}
                aria-label="Zoom image"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <a
                href={result.image}
                download={`multi-angle-${Date.now()}.png`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5"
                aria-label="Download image"
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/40",
          showCompare && result && sourceImage ? "grid grid-cols-2 gap-px bg-white/5" : ""
        )}
      >
        {/* Source image (only in compare mode) */}
        {showCompare && result && sourceImage && (
          <div className="relative bg-black/40">
            <img
              src={sourceImage}
              alt="Original"
              className="w-full max-h-[420px] object-contain"
            />
            <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
              ORIGINAL
            </span>
          </div>
        )}

        {/* Result or placeholder */}
        {result ? (
          <div className="relative bg-black/40">
            <img
              src={result.image}
              alt="Generated view"
              className="w-full max-h-[420px] object-contain"
            />
            {showCompare && (
              <span className="absolute top-2 left-2 rounded bg-primary/80 px-2 py-0.5 text-[10px] font-medium text-primary-foreground backdrop-blur">
                GENERATED
              </span>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
              <p className="font-mono text-[10px] text-white/90">
                {describeCameraShort(result.params)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-8 text-center">
            {generating ? (
              <>
                <div className="relative h-14 w-14">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Synthesizing new view…</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Usually takes 15–40 seconds
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.03] border border-white/10">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">No view generated yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upload a photo, set the camera angle, then hit Generate
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Overlay spinner when regenerating with existing result */}
        {generating && result && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
            </div>
            <p className="text-xs text-white/80">Re-rendering…</p>
          </div>
        )}
      </div>

      {result && (
        <div className="flex items-center justify-between gap-2">
          <details className="flex-1 min-w-0">
            <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
              View prompt
            </summary>
            <p className="mt-1.5 rounded-md border border-white/10 bg-white/[0.02] p-2 text-[11px] text-muted-foreground font-mono leading-relaxed">
              {result.prompt}
            </p>
          </details>
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerateDisabled}
            className="shrink-0 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", generating && "animate-spin")} />
            Regenerate
          </Button>
        </div>
      )}

      {/* Zoom dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 border-white/10 bg-black/80">
          <DialogTitle className="sr-only">Generated view (zoomed)</DialogTitle>
          {result && (
            <img
              src={result.image}
              alt="Generated view zoomed"
              className="w-full h-full max-h-[88vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
