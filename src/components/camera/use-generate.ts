"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import { buildCameraPrompt, describeCameraShort } from "@/lib/camera";

/**
 * Hook that exposes the generate action so multiple UI entry points
 * (primary button, "Regenerate" button, etc.) can trigger it.
 */
export function useGenerate() {
  const sourceImage = useAppStore((s) => s.sourceImage);
  const camera = useAppStore((s) => s.camera);
  const subjectHint = useAppStore((s) => s.subjectHint);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const setGenerating = useAppStore((s) => s.setGenerating);
  const setResult = useAppStore((s) => s.setResult);
  const setError = useAppStore((s) => s.setError);
  const pushHistory = useAppStore((s) => s.pushHistory);

  const generate = useCallback(
    async (overrides?: { params?: typeof camera }) => {
      if (!sourceImage) {
        toast.error("Upload foto terlebih dahulu.");
        return;
      }
      const params = overrides?.params ?? camera;

      setGenerating(true);
      setError(null);
      const startedAt = Date.now();
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: sourceImage,
            params,
            subjectHint: subjectHint.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Request failed (${res.status})`);
        }

        const data = await res.json();
        if (!data?.image) {
          throw new Error("No image returned from API.");
        }

        const item = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          image: data.image as string,
          params,
          prompt: (data.prompt as string) || buildCameraPrompt(params),
          createdAt: Date.now(),
        };
        setResult(item);
        pushHistory(item);
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        toast.success(`View generated in ${elapsed}s`, {
          description: describeCameraShort(params),
        });
        return item;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Generation failed.";
        setError(msg);
        toast.error("Generation failed", { description: msg });
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [
      sourceImage,
      camera,
      subjectHint,
      setGenerating,
      setError,
      setResult,
      pushHistory,
    ]
  );

  return {
    generate,
    isGenerating,
    canGenerate: !!sourceImage && !isGenerating,
  };
}
