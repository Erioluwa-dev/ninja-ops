import type Phaser from "phaser";
import { ACTOR_KEY } from "./assets";
import {
  CIVILIAN_RECIPES,
  type NinjaColor,
  recolorRgba,
  SUIT_RECIPES,
  type SuitRecipe,
} from "./ninjaPalette";

const ALLY_KEYS: Record<NinjaColor, string> = {
  kai: ACTOR_KEY.allyKai,
  jay: ACTOR_KEY.allyJay,
  zane: ACTOR_KEY.allyZane,
  cole: ACTOR_KEY.allyCole,
};

const CIVILIAN_KEYS = [
  ACTOR_KEY.civilian0,
  ACTOR_KEY.civilian1,
  ACTOR_KEY.civilian2,
  ACTOR_KEY.civilian3,
  ACTOR_KEY.civilian4,
  ACTOR_KEY.civilian5,
] as const;

/** Texture key per palette-swapped sheet, with the recipe that makes it. */
const SWAPS: readonly { key: string; recipe: SuitRecipe }[] = [
  ...(Object.keys(ALLY_KEYS) as NinjaColor[]).map((c) => ({
    key: ALLY_KEYS[c],
    recipe: SUIT_RECIPES[c],
  })),
  ...CIVILIAN_KEYS.flatMap((key, i) => {
    const recipe = CIVILIAN_RECIPES[i];
    return recipe ? [{ key, recipe }] : [];
  }),
];

const FRAME = 32;

/**
 * Registers a recoloured copy of the player's ninja sheet for each ally, with
 * the same frame indices. Call from `create`, after the loader has finished;
 * safe to call again on a scene restart.
 */
export function buildNinjaTextures(scene: Phaser.Scene): void {
  const source = scene.textures.get(ACTOR_KEY.player).getSourceImage();
  if (
    !(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)
  ) {
    return;
  }
  for (const { key, recipe } of SWAPS) {
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.drawImage(source, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    recolorRgba(image.data, recipe);
    ctx.putImageData(image, 0, 0);
    const texture = scene.textures.addCanvas(key, canvas);
    if (!texture) continue;
    const cols = Math.floor(canvas.width / FRAME);
    const rows = Math.floor(canvas.height / FRAME);
    for (let i = 0; i < cols * rows; i++) {
      texture.add(
        i,
        0,
        (i % cols) * FRAME,
        Math.floor(i / cols) * FRAME,
        FRAME,
        FRAME,
      );
    }
  }
}
