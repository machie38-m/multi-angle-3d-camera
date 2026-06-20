"use client";

import { useCallback, useRef, useEffect } from "react";
import { Camera, Compass } from "lucide-react";
import { sphericalToCartesian, type CameraParams } from "@/lib/camera";
import { describeCameraShort } from "@/lib/camera";

interface Props {
  params: CameraParams;
  onChange: (patch: Partial<CameraParams>) => void;
  disabled?: boolean;
}

/**
 * 3D orbit visualization. The subject sits in the center; the camera icon
 * orbits around it. The user can drag anywhere on the stage to rotate the
 * camera — horizontal drag changes azimuth, vertical drag changes elevation.
 * Distance is left to the slider (sensitivity-tuned wheel/trackpad support
 * could be added later).
 *
 * Implemented with pure CSS 3D transforms — no Three.js needed.
 */
export function CameraOrbit({ params, onChange, disabled }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    startAz: number;
    startEl: number;
    accumAzDelta: number; // accumulated delta in degrees since last onChange
    accumElDelta: number;
  }>({
    active: false,
    lastX: 0,
    lastY: 0,
    startAz: 0,
    startEl: 0,
    accumAzDelta: 0,
    accumElDelta: 0,
  });

  // Keep latest params in a ref so the move handler (which is memoized
  // with empty deps) can read fresh values without being re-created.
  const paramsRef = useRef(params);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

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
      if (disabledRef.current) return;
      e.preventDefault();
      const p = paramsRef.current;
      dragRef.current.active = true;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      dragRef.current.startAz = p.azimuth;
      dragRef.current.startEl = p.elevation;
      dragRef.current.accumAzDelta = 0;
      dragRef.current.accumElDelta = 0;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d.active || disabledRef.current) return;
      e.preventDefault();

      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;

      // Delta-based orbit control:
      // - drag right  → azimuth increases (camera moves to the right of subject)
      // - drag left   → azimuth decreases
      // - drag up     → elevation increases (camera moves above subject)
      // - drag down   → elevation decreases (camera moves below subject)
      //
      // Sensitivity: 0.4° per pixel of drag. ~450px of horizontal drag = 180°.
      const SENSITIVITY = 0.4;

      d.accumAzDelta += dx * SENSITIVITY;
      d.accumElDelta += -dy * SENSITIVITY; // drag up (dy<0) → el+

      // Compute new values starting from where the drag began, plus
      // all accumulated deltas. This guarantees the camera tracks the
      // pointer exactly even across rapid state updates.
      const newAz = d.startAz + d.accumAzDelta;
      const newEl = d.startEl + d.accumElDelta;

      // Normalize azimuth to [-180, 180]
      let normAz = newAz;
      while (normAz > 180) normAz -= 360;
      while (normAz < -180) normAz += 360;

      // Clamp elevation to [-90, 90]
      const clampedEl = Math.max(-90, Math.min(90, newEl));

      onChangeRef.current({
        azimuth: Math.round(normAz),
        elevation: Math.round(clampedEl),
      });
    },
    []
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current.active = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  // Wheel / trackpad: change distance
  const handleWheel = useCallback((e: WheelEvent) => {
    if (disabledRef.current) return;
    e.preventDefault();
    // wheel up (deltaY < 0) → zoom in (distance decreases)
    const delta = e.deltaY > 0 ? 0.08 : -0.08;
    const newDist = Math.max(0.5, Math.min(3, paramsRef.current.distance + delta));
    onChangeRef.current({ distance: Math.round(newDist * 100) / 100 });
  }, []);

  // Attach wheel listener with passive:false so we can preventDefault
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  return (
    <div className="w-full">
      <div
        ref={stageRef}
        className="scene-3d relative w-full aspect-square max-w-[280px] mx-auto select-none touch-none"
        style={{ cursor: disabled ? "default" : "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Orbit rings (tilted equatorial plane) */}
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

        {/* Vertical great circle (perpendicular to equator) */}
        <div
          className="absolute left-1/2 top-1/2 rounded-full border border-primary/20"
          style={{
            width: radius * 2,
            height: radius * 2,
            transform: "translate(-50%, -50%) rotateY(90deg)",
            transformStyle: "preserve-3d",
          }}
        />

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
            transition: "transform 0.12s ease-out",
            pointerEvents: "none",
          }}
        >
          {/* Line connecting center to camera */}
          <div
            className="absolute"
            style={{
              width: 2,
              height: Math.sqrt(camX * camX + camY * camY + camZ * camZ),
              background:
                "linear-gradient(to top, oklch(0.78 0.18 165 / 0.7), oklch(0.78 0.18 165 / 0.15))",
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
            className="pulse-glow flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-black/85 backdrop-blur"
            style={{
              transform: "translate(-50%, -50%)",
            }}
          >
            <Camera className="h-4 w-4 text-primary" />
          </div>
        </div>

        {/* Cardinal direction labels (around equator) */}
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

        {/* Drag hint (only when no drag is active and not disabled) */}
        {!disabled && (
          <div className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[9px] text-white/70 backdrop-blur">
            <Compass className="h-3 w-3" />
            drag · scroll = zoom
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Drag bola untuk pindahkan kamera ke segala arah · scroll untuk zoom
      </p>
    </div>
  );
}
