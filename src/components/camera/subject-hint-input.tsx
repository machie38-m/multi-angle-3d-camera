"use client";

import { useEffect, useState, useCallback } from "react";
import { Tag, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useGenerationProvider } from "@/lib/deployment";
import {
  autoCaptionDataUrl,
  getCaptionStatus,
  onCaptionStatusChange,
  type CaptionResult,
} from "@/lib/auto-caption";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Auto-captioning subject picker.
 *
 * When the user uploads an image:
 *   1. The image is sent through ResNet-50 (in-browser, no API key) which
 *      classifies it into one of 1000 ImageNet categories (dog breed,
 *      car model, food, landscape, etc.)
 *   2. The detected label is converted to a natural-language subject hint
 *      ("a beagle dog", "a sports car", "a tabby cat") and auto-filled
 *      into the subject hint field.
 *   3. The user can override the auto-detection by clicking a preset
 *      button or typing their own subject.
 *
 * The auto-captioning runs entirely in the browser using WebAssembly.
 * Model files (~25MB) are downloaded once and cached by the browser.
 */

interface Preset {
  label: string;
  hint: string;
  emoji: string;
}

const SUBJECT_PRESETS: Preset[] = [
  { label: "Dog", hint: "a dog", emoji: "🐶" },
  { label: "Cat", hint: "a cat", emoji: "🐱" },
  { label: "Person", hint: "a person", emoji: "🧑" },
  { label: "Car", hint: "a car", emoji: "🚗" },
  { label: "Building", hint: "a building", emoji: "🏢" },
  { label: "Landscape", hint: "a landscape", emoji: "🏞️" },
  { label: "Flower", hint: "a flower", emoji: "🌸" },
  { label: "Food", hint: "food", emoji: "🍽️" },
  { label: "Bird", hint: "a bird", emoji: "🐦" },
  { label: "Other", hint: "the subject", emoji: "✨" },
];

export function SubjectHintInput() {
  const subjectHint = useAppStore((s) => s.subjectHint);
  const setSubjectHint = useAppStore((s) => s.setSubjectHint);
  const sourceImage = useAppStore((s) => s.sourceImage);
  const sourceName = useAppStore((s) => s.sourceName);
  const provider = useGenerationProvider();

  const [captionStatus, setCaptionStatus] = useState(getCaptionStatus());
  const [captionProgress, setCaptionProgress] = useState<
    "idle" | "loading-model" | "detecting" | "done" | "error"
  >("idle");
  const [lastCaption, setLastCaption] = useState<CaptionResult | null>(null);

  // Subscribe to caption status changes (model loading state)
  useEffect(() => {
    return onCaptionStatusChange((s) => setCaptionStatus(s));
  }, []);

  // Run auto-captioning whenever a new image is uploaded
  const runAutoCaption = useCallback(
    async (imageDataUrl: string) => {
      setCaptionProgress("loading-model");
      try {
        // First call will trigger model download (~25MB) and may take
        // 5-15 seconds on first run, instant on subsequent runs.
        setCaptionProgress("detecting");
        const result = await autoCaptionDataUrl(imageDataUrl);
        setLastCaption(result);

        // Only auto-set subjectHint if user hasn't manually edited it
        // (i.e. subjectHint is empty, OR it equals the previous auto-detect)
        const shouldOverride =
          !subjectHint ||
          (lastCaption && subjectHint === lastCaption.subjectHint);

        if (shouldOverride && result.score > 0.15) {
          setSubjectHint(result.subjectHint);
        }
        setCaptionProgress("done");
      } catch (err) {
        console.error("[auto-caption] failed:", err);
        setCaptionProgress("error");
        // Fall back to filename-based detection
        const fallback = extractSubjectFromFilename(sourceName);
        if (fallback && !subjectHint) {
          setSubjectHint(fallback);
        }
      }
    },
    [subjectHint, lastCaption, setSubjectHint, sourceName]
  );

  useEffect(() => {
    if (provider !== "pollinations") return;
    if (!sourceImage) return;
    // Debounce slightly to avoid running on every render
    const timer = setTimeout(() => {
      runAutoCaption(sourceImage);
    }, 200);
    return () => clearTimeout(timer);
  }, [sourceImage, provider, runAutoCaption]);

  // Hide on Z.AI providers (they don't need subject hints)
  if (provider === "sandbox" || provider === "zai-public") {
    return null;
  }
  if (provider === "loading") return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-amber-200/90">
          <Tag className="h-3.5 w-3.5" />
          Subject
          {captionProgress === "done" && lastCaption && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
              <CheckCircle2 className="h-2.5 w-2.5" />
              auto: {lastCaption.label} ({Math.round(lastCaption.score * 100)}%)
            </span>
          )}
        </label>
        <div className="flex items-center gap-2">
          {subjectHint && (
            <button
              type="button"
              onClick={() => setSubjectHint("")}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Status line */}
      {captionProgress === "loading-model" && (
        <div className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 px-2.5 py-1.5 text-[11px] text-blue-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading AI model (~25MB, one-time download)…
        </div>
      )}
      {captionProgress === "detecting" && (
        <div className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 px-2.5 py-1.5 text-[11px] text-blue-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          Detecting subject…
        </div>
      )}
      {captionProgress === "error" && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-200">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>
            Auto-detect unavailable. Pick a preset or type your own subject below.
          </span>
        </div>
      )}

      {/* Quick-pick buttons */}
      <div className="grid grid-cols-5 gap-1.5">
        {SUBJECT_PRESETS.map((preset) => {
          const isActive = subjectHint === preset.hint;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setSubjectHint(preset.hint);
                toast.success(`Subject: ${preset.hint}`);
              }}
              title={`Set subject: ${preset.hint}`}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-[10px] font-medium transition-colors",
                "hover:border-amber-500/50 hover:bg-amber-500/5",
                isActive
                  ? "border-amber-500 bg-amber-500/15 text-amber-200"
                  : "border-white/10 bg-white/[0.02] text-muted-foreground"
              )}
            >
              <span className="text-base leading-none">{preset.emoji}</span>
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>

      {/* Manual input */}
      <input
        type="text"
        value={subjectHint}
        onChange={(e) => setSubjectHint(e.target.value)}
        placeholder='Or type your own (e.g. "a brown beagle dog")'
        maxLength={80}
        className="h-8 w-full rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
      />

      <p className="flex items-start gap-1.5 text-[10px] text-amber-200/60 leading-relaxed">
        <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
        <span>
          Subject is auto-detected from your photo using in-browser AI. Edit if
          wrong. For 100% accurate results without this step, set{" "}
          <code className="text-amber-200/80">ZAI_PUBLIC_API_KEY</code> (free at{" "}
          <a
            href="https://z.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-300 hover:text-amber-200 underline underline-offset-2"
          >
            z.ai
          </a>
          ).
        </span>
      </p>
    </div>
  );
}

/** Fallback: extract subject from filename (used if auto-captioning fails). */
function extractSubjectFromFilename(filename: string): string | null {
  if (!filename) return null;
  const base = filename
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]+$/, "") ?? "";
  if (!base) return null;

  const lower = base.toLowerCase();
  const keywordMap: Record<string, string> = {
    dog: "a dog",
    puppy: "a dog",
    beagle: "a dog",
    cat: "a cat",
    kitten: "a cat",
    person: "a person",
    man: "a man",
    woman: "a woman",
    car: "a car",
    building: "a building",
    landscape: "a landscape",
    flower: "a flower",
    food: "food",
  };

  for (const [keyword, hint] of Object.entries(keywordMap)) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(lower)) return hint;
  }
  return null;
}
