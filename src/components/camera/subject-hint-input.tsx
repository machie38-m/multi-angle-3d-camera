"use client";

import { useEffect } from "react";
import { Tag, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useGenerationProvider } from "@/lib/deployment";
import { cn } from "@/lib/utils";

/**
 * Quick subject picker. Shows preset buttons (Dog, Cat, Person, etc.) and
 * auto-extracts subject from the uploaded filename (e.g., "my-dog.jpg" → "a dog").
 *
 * Only shown when Pollinations is the active provider — Z.AI doesn't need it.
 *
 * User can either:
 *   - Click a preset button (1-click, no typing)
 *   - Type a custom subject manually (advanced)
 *   - Skip entirely (auto-fallback to "the subject from the input image")
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
  { label: "Furniture", hint: "a piece of furniture", emoji: "🪑" },
  { label: "Product", hint: "a product", emoji: "📦" },
];

/** Try to guess the subject from the uploaded filename. */
function extractSubjectFromFilename(filename: string): string | null {
  if (!filename) return null;
  // Strip extension and path
  const base = filename
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]+$/, "") ?? "";
  if (!base) return null;

  // Common keywords → subject hint
  const lower = base.toLowerCase();
  const keywordMap: Record<string, string> = {
    dog: "a dog",
    puppy: "a dog",
    beagle: "a dog",
    poodle: "a dog",
    cat: "a cat",
    kitten: "a cat",
    kitty: "a cat",
    person: "a person",
    people: "people",
    man: "a man",
    woman: "a woman",
    boy: "a boy",
    girl: "a girl",
    kid: "a child",
    child: "a child",
    baby: "a baby",
    portrait: "a person",
    selfie: "a person",
    car: "a car",
    vehicle: "a vehicle",
    truck: "a truck",
    building: "a building",
    house: "a house",
    architecture: "a building",
    landscape: "a landscape",
    mountain: "a mountain",
    beach: "a beach",
    sunset: "a sunset",
    flower: "a flower",
    plant: "a plant",
    tree: "a tree",
    food: "food",
    meal: "food",
    pizza: "a pizza",
    burger: "a burger",
    product: "a product",
    shoe: "a shoe",
    shoes: "shoes",
    bag: "a bag",
    watch: "a watch",
    phone: "a phone",
    laptop: "a laptop",
    furniture: "a piece of furniture",
    chair: "a chair",
    table: "a table",
    sofa: "a sofa",
  };

  // Check for compound matches (e.g., "my-dog-2024" → "dog")
  for (const [keyword, hint] of Object.entries(keywordMap)) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(lower)) {
      return hint;
    }
  }

  return null;
}

export function SubjectHintInput() {
  const subjectHint = useAppStore((s) => s.subjectHint);
  const setSubjectHint = useAppStore((s) => s.setSubjectHint);
  const sourceName = useAppStore((s) => s.sourceName);
  const provider = useGenerationProvider();

  // Auto-detect subject from filename whenever a new file is uploaded
  useEffect(() => {
    if (provider !== "pollinations") return;
    if (!sourceName) return;
    const detected = extractSubjectFromFilename(sourceName);
    if (detected && !subjectHint) {
      setSubjectHint(detected);
    }
  }, [sourceName, provider, subjectHint, setSubjectHint]);

  // Hide on Z.AI providers (they don't need it)
  if (provider === "sandbox" || provider === "zai-public") {
    return null;
  }
  if (provider === "loading") return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-amber-200/90">
          <Tag className="h-3.5 w-3.5" />
          Subject <span className="text-muted-foreground/80">(auto-detected — edit if wrong)</span>
        </label>
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

      {/* Quick-pick buttons */}
      <div className="grid grid-cols-5 gap-1.5">
        {SUBJECT_PRESETS.map((preset) => {
          const isActive = subjectHint === preset.hint;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSubjectHint(preset.hint)}
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

      {/* Manual input (for custom subjects) */}
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
          Free Pollinations provider needs to know the subject to preserve it.
          Pick a preset or type your own. For best results without this step,
          set <code className="text-amber-200/80">ZAI_PUBLIC_API_KEY</code> (free at{" "}
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
