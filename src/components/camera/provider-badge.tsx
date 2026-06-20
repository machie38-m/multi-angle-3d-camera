"use client";

import { Loader2, Sparkles, Zap, Cloud } from "lucide-react";
import {
  useGenerationProvider,
  getProviderLabel,
  getProviderDescription,
} from "@/lib/deployment";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Small badge in the header that shows which image-generation provider
 * is currently active. Gives users transparency about which backend
 * processes their images.
 */
export function ProviderBadge() {
  const provider = useGenerationProvider();

  let icon: React.ReactNode;
  let className: string;

  if (provider === "loading") {
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    className = "border-white/15 bg-white/5 text-muted-foreground";
  } else if (provider === "sandbox") {
    icon = <Sparkles className="h-3.5 w-3.5" />;
    className = "border-primary/40 bg-primary/10 text-primary";
  } else if (provider === "zai-public") {
    icon = <Sparkles className="h-3.5 w-3.5" />;
    className = "border-primary/40 bg-primary/10 text-primary";
  } else {
    // pollinations
    icon = <Cloud className="h-3.5 w-3.5" />;
    className = "border-amber-500/40 bg-amber-500/10 text-amber-300";
  }

  const badge = (
    <div
      className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium sm:inline-flex ${className}`}
    >
      {icon}
      {getProviderLabel(provider)}
    </div>
  );

  if (provider === "loading") return badge;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-center">
          <p className="text-xs leading-relaxed">
            {getProviderDescription(provider)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
