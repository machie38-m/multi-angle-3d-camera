"use client";

import { RotateCcw, Compass, Mountain, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CAMERA_LIMITS,
  PRESETS,
  type CameraParams,
} from "@/lib/camera";
import { describeCameraShort } from "@/lib/camera";
import { cn } from "@/lib/utils";

interface Props {
  params: CameraParams;
  onChange: (patch: Partial<CameraParams>) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function CameraControls({ params, onChange, onReset, disabled }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Camera Parameters</h3>
          <p className="font-mono text-[11px] text-primary/80">
            {describeCameraShort(params)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={disabled}
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {/* Azimuth */}
      <SliderRow
        icon={<Compass className="h-4 w-4" />}
        label="Azimuth"
        hint="Horizontal rotation · -180° to 180°"
        value={params.azimuth}
        min={CAMERA_LIMITS.azimuth.min}
        max={CAMERA_LIMITS.azimuth.max}
        step={CAMERA_LIMITS.azimuth.step}
        suffix="°"
        onChange={(v) => onChange({ azimuth: v })}
        disabled={disabled}
      />

      {/* Elevation */}
      <SliderRow
        icon={<Mountain className="h-4 w-4" />}
        label="Elevation"
        hint="Vertical angle · -90° (below) to 90° (above)"
        value={params.elevation}
        min={CAMERA_LIMITS.elevation.min}
        max={CAMERA_LIMITS.elevation.max}
        step={CAMERA_LIMITS.elevation.step}
        suffix="°"
        onChange={(v) => onChange({ elevation: v })}
        disabled={disabled}
      />

      {/* Distance */}
      <SliderRow
        icon={<ZoomIn className="h-4 w-4" />}
        label="Distance"
        hint="Zoom · 0.5× (close) to 3× (far)"
        value={params.distance}
        min={CAMERA_LIMITS.distance.min}
        max={CAMERA_LIMITS.distance.max}
        step={CAMERA_LIMITS.distance.step}
        suffix="×"
        onChange={(v) => onChange({ distance: Number(v.toFixed(2)) })}
        disabled={disabled}
      />

      {/* Presets */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Quick Presets
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {PRESETS.map((p) => {
            const isActive =
              params.azimuth === p.params.azimuth &&
              params.elevation === p.params.elevation &&
              Math.abs(params.distance - p.params.distance) < 0.05;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(p.params)}
                title={p.description}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors",
                  "hover:border-primary/60 hover:bg-primary/5",
                  isActive
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 bg-white/[0.02] text-muted-foreground",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface SliderRowProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function SliderRow({
  icon,
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  disabled,
}: SliderRowProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary/80">{icon}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="font-mono text-sm tabular-nums text-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        className="cam-slider w-full"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
