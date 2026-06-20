"use client";

import { useCallback, useRef } from "react";
import { Camera } from "lucide-react";
import { sphericalToCartesian, type CameraParams } from "@/lib/camera";
import { describeCameraShort } from "@/lib/camera";

interface Props {
  params: CameraParams;
  onChange: (patch: Partial<CameraParams>) => void;
  disabled?: boolean;
}

/**
 * 3D orbit visualization. The subject sits in the center; the camera icon
 * orbits around it. The user can either drag the camera on the orbit ball
 * (updating azimuth + elevation) or use the sliders from the parent.
 *
 * Implemented with pure CSS 3D transforms — no Three.js needed.
 */
export function CameraOrbit({ params, onChange, disabled }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean }>({ active: false });

  // Convert spherical camera params to cartesian for CSS 3D positioning.
  // The "stage" has a fixed 3D space where the subject sphere is at origin.
  const radius = 90; // px, base orbit radius
  const pos = sphericalToCartesian(params, radius);

  // For CSS 3D: x → right, y → up, z → toward viewer
  const camX = pos.x;
  const camY = -pos.y; // CSS Y is inverted (down = positive)
  const camZ = pos.z;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragRef.current.active = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active || disabled) return;
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      // Compute azimuth (horizontal) and elevation (vertical) from drag.
      // Distance is left untouched (use slider for that).
      const az = Math.round(Math.atan2(dx, -dy + 0.0001) * (180 / Math.PI));
      // Elevation: based on dy magnitude relative to radius.
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = rect.width / 2;
      const el = Math.round(Math.atan2(dy, Math.max(dist, 1)) * (180 / Math.PI));
      const clampedEl = Math.max(-90, Math.min(90, el));

      // Azimuth: atan2 returns -180..180 already, but for "up" drag direction
      // we want the camera to go up. So when dy is negative (mouse up), el positive.
      // The above already does that.
      const clampedAz = ((az + 180) % 360) - 180;

      onChange({ azimuth: clampedAz, elevation: -clampedEl });
    },
    [disabled, onChange]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current.active = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="w-full">
      <div
        ref={stageRef}
        className="scene-3d relative w-full aspect-square max-w-[280px] mx-auto select-none touch-none"
        style={{ cursor: disabled ? "default" : "grab" }}
      >
        {/* Orbit rings */}
        <div
          className="orbit-stage absolute inset-0"
          style={{
            transform: "rotateX(60deg) rotateZ(0deg)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Equator ring */}
          <div
            className="absolute left-1/2 top-1/2 rounded-full border border-primary/30"
            style={{
              width: radius * 2,
              height: radius * 2,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 20px oklch(0.78 0.18 165 / 0.15) inset",
            }}
          />
          {/* Outer ring */}
          <div
            className="absolute left-1/2 top-1/2 rounded-full border border-white/10"
            style={{
              width: radius * 2.4,
              height: radius * 2.4,
              transform: "translate(-50%, -50%)",
            }}
          />
          {/* Inner ring */}
          <div
            className="absolute left-1/2 top-1/2 rounded-full border border-white/[0.06]"
            style={{
              width: radius * 1.4,
              height: radius * 1.4,
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>

        {/* Axis cross */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: radius * 2.6,
            height: 1,
            transform: "translate(-50%, -50%)",
            background:
              "linear-gradient(to right, transparent, oklch(0.78 0.18 165 / 0.25), transparent)",
          }}
        />
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: 1,
            height: radius * 2.6,
            transform: "translate(-50%, -50%)",
            background:
              "linear-gradient(to bottom, transparent, oklch(0.78 0.18 165 / 0.25), transparent)",
          }}
        />

        {/* Subject sphere at center */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 36,
            height: 36,
            background:
              "radial-gradient(circle at 30% 30%, oklch(0.85 0.18 165), oklch(0.45 0.12 165))",
            boxShadow:
              "0 0 24px oklch(0.78 0.18 165 / 0.55), inset -4px -4px 12px rgba(0,0,0,0.4)",
          }}
        />

        {/* Camera position marker — appears on the orbit */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate3d(${camX}px, ${camY}px, ${camZ}px)`,
            transformStyle: "preserve-3d",
            transition: "transform 0.18s ease-out",
          }}
        >
          {/* Line connecting center to camera */}
          <div
            className="absolute"
            style={{
              width: 1,
              height: Math.sqrt(camX * camX + camY * camY + camZ * camZ),
              background:
                "linear-gradient(to top, oklch(0.78 0.18 165 / 0.6), oklch(0.78 0.18 165 / 0.1))",
              transformOrigin: "top center",
              transform: `translate(-50%, -100%) rotateZ(${
                Math.atan2(camX, -camY) * (180 / Math.PI)
              }deg)`,
              left: 0,
              top: 0,
            }}
          />
          {/* Camera icon */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="pulse-glow flex h-8 w-8 cursor-grab items-center justify-center rounded-full border-2 border-primary bg-black/80 backdrop-blur active:cursor-grabbing"
            style={{
              transform: "translate(-50%, -50%)",
            }}
            role="slider"
            aria-label="Camera position"
            aria-valuenow={Math.round(params.azimuth)}
            aria-valuemin={-180}
            aria-valuemax={180}
            aria-valuetext={describeCameraShort(params)}
          >
            <Camera className="h-4 w-4 text-primary" />
          </div>
        </div>

        {/* Cardinal direction labels */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted-foreground/80">
          N (back)
        </span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted-foreground/80">
          S (front)
        </span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/80">
          W
        </span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/80">
          E
        </span>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Drag the camera icon on the orbit, or use the sliders below
      </p>
    </div>
  );
}
