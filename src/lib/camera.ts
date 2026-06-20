/**
 * Camera parameter helpers
 * - Azimuth:   -180° to +180°   (0 = front, + = right, - = left, ±180 = behind)
 * - Elevation: -90° to +90°     (0 = eye level, + = above, - = below)
 * - Distance:   0.5 to 3.0      (1 = original, <1 closer, >1 farther)
 *
 * These get converted into a natural-language prompt that an image-edit
 * model can understand to re-render the scene from a new camera angle.
 */

export interface CameraParams {
  azimuth: number; // degrees
  elevation: number; // degrees
  distance: number; // multiplier
}

export const CAMERA_LIMITS = {
  azimuth: { min: -180, max: 180, step: 5 },
  elevation: { min: -90, max: 90, step: 5 },
  distance: { min: 0.5, max: 3, step: 0.1 },
} as const;

export const DEFAULT_CAMERA: CameraParams = {
  azimuth: 30,
  elevation: 15,
  distance: 1.4,
};

/** Build a natural-language camera-angle prompt for the image-edit API. */
export function buildCameraPrompt(params: CameraParams): string {
  const azimuthDesc = describeAzimuth(params.azimuth);
  const elevationDesc = describeElevation(params.elevation);
  const distanceDesc = describeDistance(params.distance);

  const prompt =
    `Re-render the exact same scene, subject, objects, colors, lighting, ` +
    `mood, and visual style as the input photograph, but from a new camera position. ` +
    `New camera: ${azimuthDesc}, ${elevationDesc}, ${distanceDesc}. ` +
    `The subject, composition intent, environment, and atmosphere must remain visually consistent with the original. ` +
    `Photorealistic, sharp focus, high detail, no text, no watermark.`;

  return prompt;
}

/**
 * Build a SIMPLIFIED camera-angle prompt for Pollinations.ai's flux model.
 *
 * Pollinations is a general-purpose text-to-image model that takes the input
 * image as a weak reference. It does NOT understand elaborate camera jargon
 * like "three-quarter right profile" or "rear-left angle, nearly behind the
 * subject" — those confuse it into generating unrelated subjects.
 *
 * This prompt builder:
 *   - Leads with a clear subject mention (from the user-provided hint)
 *   - Uses simple, direct angle words ("right side view", "from above", etc.)
 *   - Repeats the subject at the end to reinforce preservation
 *
 * The subjectHint is critical for Pollinations. Without it, results are
 * unreliable. If empty, the prompt is still built but quality will suffer.
 */
export function buildPollinationsPrompt(
  params: CameraParams,
  subjectHint?: string
): string {
  const subject = subjectHint?.trim() || "the subject";
  const angleDesc = describeAngleSimple(params.azimuth, params.elevation);
  const distanceDesc = describeDistanceSimple(params.distance);

  return (
    `A photo of ${subject}, photographed from a new camera angle: ${angleDesc}, ${distanceDesc}. ` +
    `Same ${subject}, same colors, same lighting, same background environment. ` +
    `Photorealistic photograph, sharp focus, high detail.`
  );
}

/** Simplified azimuth + elevation description for general image models. */
function describeAngleSimple(az: number, el: number): string {
  const a = Math.round(az);
  const e = Math.round(el);
  const parts: string[] = [];

  // Azimuth → simple direction word
  if (a === 0) parts.push("front view");
  else if (a === 180 || a === -180) parts.push("back view from behind");
  else if (a > 0 && a <= 30) parts.push("slight right of front");
  else if (a > 30 && a <= 60) parts.push("right three-quarter view");
  else if (a > 60 && a <= 120) parts.push("right side view");
  else if (a > 120 && a < 180) parts.push("back-right three-quarter view");
  else if (a < 0 && a >= -30) parts.push("slight left of front");
  else if (a < -30 && a >= -60) parts.push("left three-quarter view");
  else if (a < -60 && a >= -120) parts.push("left side view");
  else if (a < -120 && a > -180) parts.push("back-left three-quarter view");

  // Elevation → simple angle word
  if (e === 0) parts.push("eye-level");
  else if (e > 0 && e <= 20) parts.push("slightly elevated");
  else if (e > 20 && e <= 45) parts.push("high angle looking down");
  else if (e > 45) parts.push("top-down view from above");
  else if (e < 0 && e >= -20) parts.push("slightly low angle");
  else if (e < -20 && e >= -45) parts.push("low angle looking up");
  else parts.push("worm's-eye view from below");

  return parts.join(", ");
}

function describeDistanceSimple(d: number): string {
  if (d < 0.7) return "extreme close-up";
  if (d < 1.0) return "closer crop";
  if (d <= 1.05) return "same distance as original";
  if (d <= 1.5) return "slightly pulled back";
  if (d <= 2.2) return "wider shot";
  return "distant wide shot";
}

function describeAzimuth(az: number): string {
  const a = Math.round(az);
  const abs = Math.abs(a);

  if (a === 0) return "front view (0° azimuth, camera directly in front of subject)";
  if (abs === 180)
    return "back view (180° azimuth, camera directly behind subject, showing the reverse side)";

  const side = a > 0 ? "right" : "left";
  let strength = "slight";
  if (abs > 30 && abs <= 90) strength = "moderate";
  else if (abs > 90) strength = "strong";

  if (abs <= 30) {
    return `${strength} ${side} angle, camera moved ${abs}° to the ${side} of the front, still mostly frontal with a ${side} bias`;
  }
  if (abs <= 90) {
    return `${side} side view, camera positioned ${abs}° to the ${side} (roughly three-quarter ${side} profile)`;
  }
  // 90 < abs < 180
  return `${strength} rear-${side} angle, camera ${abs}° around to the ${side}, nearly behind the subject, showing mostly the ${side}-rear`;
}

function describeElevation(el: number): string {
  const e = Math.round(el);
  const abs = Math.abs(e);

  if (e === 0) return "eye-level camera (0° elevation)";
  if (abs === 90) {
    return e > 0
      ? "pure top-down aerial view (90° elevation, directly overhead looking straight down)"
      : "pure worm's-eye view (-90° elevation, directly underneath looking straight up)";
  }

  if (e > 0) {
    if (abs <= 20) return `slightly elevated camera, looking down ${abs}° (gentle high angle)`;
    if (abs <= 45) return `high-angle camera, looking down ${abs}° (above eye level)`;
    return `steep high-angle / near-aerial camera, looking down ${abs}°`;
  }
  // negative
  if (abs <= 20) return `slightly low camera, looking up ${abs}° (gentle low angle)`;
  if (abs <= 45) return `low-angle camera, looking up ${abs}° (hero shot from below)`;
  return `extreme worm's-eye view, looking up ${abs}° from very low`;
}

function describeDistance(d: number): string {
  if (d < 0.7) return "extreme close-up, camera much closer than the original (cropped in tight)";
  if (d < 1.0) return "closer than the original, camera moved forward for a tighter framing";
  if (d <= 1.05) return "same camera distance as the original";
  if (d <= 1.5) return "slightly farther than the original, camera pulled back a little";
  if (d <= 2.2) return "farther than the original, wider shot with more of the surroundings visible";
  return "very far from the subject, distant wide establishing shot";
}

/** Build a short human label for UI display. */
export function describeCameraShort(params: CameraParams): string {
  const parts: string[] = [];
  const az = Math.round(params.azimuth);
  const el = Math.round(params.elevation);

  if (az === 0) parts.push("Front");
  else if (az === 180 || az === -180) parts.push("Back");
  else parts.push(`${az > 0 ? "R" : "L"} ${Math.abs(az)}°`);

  if (el === 0) parts.push("Eye");
  else if (el > 0) parts.push(`↑${el}°`);
  else parts.push(`↓${Math.abs(el)}°`);

  parts.push(`${params.distance.toFixed(1)}×`);

  return parts.join(" · ");
}

/** Preset camera angles for quick access. */
export interface Preset {
  id: string;
  label: string;
  description: string;
  params: CameraParams;
}

export const PRESETS: Preset[] = [
  {
    id: "front",
    label: "Front",
    description: "Direct front view",
    params: { azimuth: 0, elevation: 0, distance: 1 },
  },
  {
    id: "right",
    label: "Right 45°",
    description: "Right three-quarter view",
    params: { azimuth: 45, elevation: 0, distance: 1 },
  },
  {
    id: "left",
    label: "Left 45°",
    description: "Left three-quarter view",
    params: { azimuth: -45, elevation: 0, distance: 1 },
  },
  {
    id: "right-90",
    label: "Right Side",
    description: "Right side profile",
    params: { azimuth: 90, elevation: 0, distance: 1.1 },
  },
  {
    id: "left-90",
    label: "Left Side",
    description: "Left side profile",
    params: { azimuth: -90, elevation: 0, distance: 1.1 },
  },
  {
    id: "back",
    label: "Back",
    description: "Behind the subject",
    params: { azimuth: 180, elevation: 0, distance: 1 },
  },
  {
    id: "high",
    label: "High Angle",
    description: "Looking down 45°",
    params: { azimuth: 30, elevation: 45, distance: 1.4 },
  },
  {
    id: "top",
    label: "Top Down",
    description: "Bird's-eye view",
    params: { azimuth: 0, elevation: 80, distance: 1.8 },
  },
  {
    id: "low",
    label: "Low Angle",
    description: "Hero shot from below",
    params: { azimuth: 0, elevation: -30, distance: 0.9 },
  },
  {
    id: "wide",
    label: "Wide Shot",
    description: "Farther away",
    params: { azimuth: 20, elevation: 10, distance: 2.3 },
  },
  {
    id: "closeup",
    label: "Close Up",
    description: "Tight framing",
    params: { azimuth: -20, elevation: 5, distance: 0.7 },
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Dramatic 3/4 high",
    params: { azimuth: -55, elevation: 25, distance: 1.6 },
  },
];

/**
 * Convert spherical camera coordinates (azimuth, elevation, distance)
 * to 3D cartesian coordinates for the orbit visualization.
 * Subject sits at origin, camera orbits around it.
 */
export function sphericalToCartesian(params: CameraParams, radius = 1) {
  const azRad = (params.azimuth * Math.PI) / 180;
  const elRad = (params.elevation * Math.PI) / 180;
  const r = radius * params.distance;

  // Y up, Z toward viewer, X to the right
  const x = r * Math.cos(elRad) * Math.sin(azRad);
  const z = r * Math.cos(elRad) * Math.cos(azRad);
  const y = r * Math.sin(elRad);

  return { x, y, z };
}
