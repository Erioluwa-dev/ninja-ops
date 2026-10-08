import { describe, expect, it } from "vitest";
import {
  CIVILIAN_RECIPES,
  isSuitPixel,
  recolorPixel,
  recolorRgba,
  SUIT_RECIPES,
} from "./ninjaPalette";

type Px = readonly [number, number, number, number];
const OLIVE: Px = [168, 161, 41, 255] as const;
const GREEN = [86, 134, 76, 255] as const;
const TEAL = [52, 90, 82, 255] as const;
const OUTLINE = [20, 27, 27, 255] as const;
const SKIN = [209, 75, 52, 255] as const;
const SKIN2 = [239, 145, 79, 255] as const;
const WHITE = [255, 255, 255, 255] as const;

describe("ninja suit palette", () => {
  it("selects only the green suit pixels", () => {
    const suit: Px[] = [OLIVE, GREEN, TEAL];
    const other: Px[] = [OUTLINE, SKIN, SKIN2, WHITE, [0, 0, 0, 0]];
    for (const [r, g, b, a] of suit) expect(isSuitPixel(r, g, b, a)).toBe(true);
    for (const [r, g, b, a] of other) {
      expect(isSuitPixel(r, g, b, a)).toBe(false);
    }
  });

  it("leaves skin, eyes and outline untouched", () => {
    for (const p of [OUTLINE, SKIN, SKIN2, WHITE]) {
      expect(recolorPixel(p, SUIT_RECIPES.kai)).toEqual([...p]);
    }
  });

  it("turns the suit red for Kai and blue for Jay", () => {
    const [kr, kg, kb] = recolorPixel(GREEN, SUIT_RECIPES.kai);
    expect(kr).toBeGreaterThan(kg + 40);
    expect(kr).toBeGreaterThan(kb + 40);
    const [jr, , jb] = recolorPixel(GREEN, SUIT_RECIPES.jay);
    expect(jb).toBeGreaterThan(jr + 40);
  });

  it("makes Zane light and Cole dark, both nearly grey", () => {
    const zane = recolorPixel(OLIVE, SUIT_RECIPES.zane);
    const cole = recolorPixel(OLIVE, SUIT_RECIPES.cole);
    expect(Math.min(zane[0], zane[1], zane[2])).toBeGreaterThan(190);
    expect(Math.max(cole[0], cole[1], cole[2])).toBeLessThan(110);
  });

  it("keeps the shading steps ordered and the alpha", () => {
    const lum = (p: readonly number[]): number =>
      (p[0] ?? 0) + (p[1] ?? 0) + (p[2] ?? 0);
    for (const recipe of Object.values(SUIT_RECIPES)) {
      expect(lum(recolorPixel(OLIVE, recipe))).toBeGreaterThan(
        lum(recolorPixel(TEAL, recipe)),
      );
    }
    expect(recolorPixel([86, 134, 76, 128], SUIT_RECIPES.kai)[3]).toBe(128);
  });

  it("recolours a buffer in place", () => {
    const data = new Uint8ClampedArray([...GREEN, ...OUTLINE]);
    recolorRgba(data, SUIT_RECIPES.kai);
    expect(data[0]).toBeGreaterThan(data[1] ?? 0);
    expect([...data.slice(4)]).toEqual([...OUTLINE]);
  });
});

describe("civilian palette", () => {
  it("has six looks distinct from each other and from the ninja suits", () => {
    expect(CIVILIAN_RECIPES).toHaveLength(6);
    const outputs = [...CIVILIAN_RECIPES, ...Object.values(SUIT_RECIPES)].map(
      (r) => recolorPixel(GREEN, r).join(","),
    );
    expect(new Set(outputs).size).toBe(outputs.length);
    expect(new Set([GREEN.join(",")]).has(outputs[0] ?? "")).toBe(false);
  });
});
