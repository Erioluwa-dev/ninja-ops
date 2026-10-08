/** One ninja's suit colour, as an HSV recipe applied to the green sheet's suit pixels. */
export interface SuitRecipe {
  /** Target hue in degrees. */
  hue: number;
  /** Multiplies the source saturation; near 0 reads as white or grey. */
  satScale: number;
  /** Multiplies the source value, which keeps the sheet's shading steps apart. */
  valScale: number;
  /** Lifts the value afterwards, so a dark suit keeps readable shading steps. */
  valLift: number;
}

export type NinjaColor = "kai" | "jay" | "zane" | "cole";

export const SUIT_RECIPES: Record<NinjaColor, SuitRecipe> = {
  kai: { hue: 2, satScale: 1.5, valScale: 1.2, valLift: 0 },
  jay: { hue: 214, satScale: 1.4, valScale: 1.15, valLift: 0 },
  zane: { hue: 200, satScale: 0.16, valScale: 1.4, valLift: 0.08 },
  cole: { hue: 230, satScale: 0.14, valScale: 0.55, valLift: 0.04 },
};

/**
 * Townsfolk tunics. Hues and values are kept away from the four ninja suits
 * (red, blue, white, black) and the green player: earthy or muted colours only.
 */
export const CIVILIAN_RECIPES: readonly SuitRecipe[] = [
  { hue: 28, satScale: 0.9, valScale: 0.75, valLift: 0 }, // brown
  { hue: 210, satScale: 0.1, valScale: 0.95, valLift: 0 }, // grey
  { hue: 285, satScale: 0.9, valScale: 0.95, valLift: 0 }, // purple
  { hue: 30, satScale: 1.6, valScale: 1.25, valLift: 0 }, // orange
  { hue: 175, satScale: 1.1, valScale: 1.0, valLift: 0 }, // teal
  { hue: 345, satScale: 1.0, valScale: 0.7, valLift: 0 }, // maroon
];

// The green sheet's suit is olive (hue ~57), green (~110) and teal (~167).
// Skin and sash sit near 10-25 degrees, the eye whites have no saturation and
// the outline is very dark, so a hue/saturation/value window isolates the suit.
const SUIT_HUE_MIN = 40;
const SUIT_HUE_MAX = 190;
const SUIT_SAT_MIN = 0.3;
const SUIT_VAL_MIN = 0.25;

type Rgba = readonly [number, number, number, number];

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = (((g - b) / d) % 6) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [(h + 360) % 360, max === 0 ? 0 : d / max, max / 255];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255].map((c) =>
    Math.round(Math.min(255, Math.max(0, c))),
  ) as [number, number, number];
}

/** Whether a pixel belongs to the suit rather than skin, eyes or outline. */
export function isSuitPixel(
  r: number,
  g: number,
  b: number,
  a: number,
): boolean {
  if (a === 0) return false;
  const [h, s, v] = rgbToHsv(r, g, b);
  return (
    h >= SUIT_HUE_MIN &&
    h <= SUIT_HUE_MAX &&
    s >= SUIT_SAT_MIN &&
    v >= SUIT_VAL_MIN
  );
}

/** Recolours one pixel; non-suit pixels come back unchanged. */
export function recolorPixel(
  [r, g, b, a]: Rgba,
  recipe: SuitRecipe,
): [number, number, number, number] {
  if (!isSuitPixel(r, g, b, a)) return [r, g, b, a];
  const [, s, v] = rgbToHsv(r, g, b);
  const [nr, ng, nb] = hsvToRgb(
    recipe.hue,
    Math.min(1, s * recipe.satScale),
    Math.min(1, v * recipe.valScale + recipe.valLift),
  );
  return [nr, ng, nb, a];
}

/** Recolours an RGBA byte buffer (ImageData layout) in place. */
export function recolorRgba(data: Uint8ClampedArray, recipe: SuitRecipe): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    const [r, g, b, a] = recolorPixel(
      [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0],
      recipe,
    );
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
}
