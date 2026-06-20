"use client";

import { Tag } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useGenerationProvider } from "@/lib/deployment";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Optional subject hint input. Only shown when Pollinations is the active
 * provider (Z.AI doesn't need it — it's a proper image-edit model that
 * preserves the subject automatically).
 *
 * Example hints:
 *   "a beagle dog"
 *   "a young woman"
 *   "a red sports car"
 *   "a mountain landscape"
 *
 * The hint is included in the Pollinations prompt to dramatically improve
 * subject preservation across camera-angle changes.
 */
export function SubjectHintInput() {
  const subjectHint = useAppStore((s) => s.subjectHint);
  const setSubjectHint = useAppStore((s) => s.setSubjectHint);
  const provider = useGenerationProvider();

  // Hide on Z.AI providers (they don't need it)
  if (provider === "sandbox" || provider === "zai-public") {
    return null;
  }
  // Hide while loading (will appear after status check if needed)
  if (provider === "loading") return null;

  return (
    <div className={cn("space-y-1.5")}>
      <label
        htmlFor="subject-hint"
        className="flex items-center gap-1.5 text-xs font-medium text-amber-200/90"
      >
        <Tag className="h-3.5 w-3.5" />
        Subject hint <span className="text-muted-foreground">(optional, recommended)</span>
      </label>
      <Input
        id="subject-hint"
        type="text"
        value={subjectHint}
        onChange={(e) => setSubjectHint(e.target.value)}
        placeholder='e.g. "a brown dog", "a person", "a red car"'
        maxLength={80}
        className="h-9 text-sm border-amber-500/30 bg-amber-500/5 focus-visible:border-amber-500/60 focus-visible:ring-amber-500/20"
      />
      <p className="text-[11px] text-amber-200/60 leading-relaxed">
        Pollinations (free provider) needs to know what's in your photo to keep
        it consistent across angles. Be brief — 2-5 words is ideal.
      </p>
    </div>
  );
}
