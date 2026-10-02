import Phaser from "phaser";
import { HUD_KEY } from "./assets";

export const HUD_FONT = "hud-bitmap-font";
const GLYPH = 8;
const COLUMNS = 15;
// The glyphs are 6 px wide in an 8 px cell, so cells already leave 2 px between
// letters; -1 would make wide letters like M, W and V touch.
const LETTER_SPACING = 0;
const LINE_SPACING = 1;
const OUTLINE_STEPS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const OUTLINE_CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

const ALIGN = { left: 0, center: 1, right: 2 } as const;

/** Register the pack's sheet as a bitmap font; safe to call on every scene start. */
export function registerHudFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(HUD_FONT)) return;
  scene.cache.bitmapFont.add(
    HUD_FONT,
    Phaser.GameObjects.RetroFont.Parse(scene, {
      image: HUD_KEY.font,
      width: GLYPH,
      height: GLYPH,
      chars: Phaser.GameObjects.RetroFont.TEXT_SET1,
      charsPerRow: COLUMNS,
      "offset.x": 0,
      "offset.y": 0,
      "spacing.x": 0,
      "spacing.y": 0,
      lineSpacing: LINE_SPACING,
    }),
  );
}

export interface HudLabelOptions {
  x: number;
  y: number;
  depth: number;
  /** Glyph height in px; use a multiple of 8 so the pixels stay square. */
  size?: number;
  originX?: number;
  originY?: number;
  align?: keyof typeof ALIGN;
  /** Black rim on all four sides, for text drawn over the arena. */
  outline?: boolean;
  /** Extra px between letters; only for text that must fit a fixed width. */
  letterSpacing?: number;
  /** Fill colour (white if omitted); `null` keeps the font's own dark ink for light panels. */
  color?: number | null;
}

/**
 * A line or block of text in the pack's bitmap font. The glyphs are near-black,
 * so the face is filled with a colour and, over the arena, rimmed with black
 * copies of itself to stay readable on any tile. Larger text gets a rim one
 * font pixel thick, corners included, so light colours hold up on pale panels.
 */
export class HudLabel {
  private readonly rim: Phaser.GameObjects.BitmapText[] = [];
  private readonly face: Phaser.GameObjects.BitmapText;
  private current = "";

  constructor(scene: Phaser.Scene, options: HudLabelOptions) {
    const { x, y, depth } = options;
    const size = options.size ?? GLYPH;
    const align = ALIGN[options.align ?? "left"];
    const make = (dx: number, dy: number) =>
      scene.add
        .bitmapText(x + dx, y + dy, HUD_FONT, "", size, align)
        .setOrigin(options.originX ?? 0, options.originY ?? 0)
        .setLetterSpacing(options.letterSpacing ?? LETTER_SPACING)
        .setDepth(depth);
    if (options.outline ?? true) {
      const thickness = Math.max(1, Math.round(size / GLYPH));
      const steps =
        thickness > 1 ? [...OUTLINE_STEPS, ...OUTLINE_CORNERS] : OUTLINE_STEPS;
      for (const [dx, dy] of steps) {
        this.rim.push(make(dx * thickness, dy * thickness).setTint(0x000000));
      }
    }
    this.face = make(0, 0);
    this.setColor(options.color === undefined ? 0xffffff : options.color);
  }

  setText(value: string): this {
    if (value === this.current) return this;
    this.current = value;
    for (const layer of this.layers()) layer.setText(value);
    return this;
  }

  /** `null` shows the font's own ink. */
  setColor(color: number | null): this {
    if (color === null) {
      this.face.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    } else {
      this.face.setTint(color).setTintMode(Phaser.TintModes.FILL);
    }
    return this;
  }

  setVisible(visible: boolean): this {
    for (const layer of this.layers()) layer.setVisible(visible);
    return this;
  }

  destroy(): void {
    for (const layer of this.layers()) layer.destroy();
  }

  private layers(): Phaser.GameObjects.BitmapText[] {
    return [...this.rim, this.face];
  }
}
