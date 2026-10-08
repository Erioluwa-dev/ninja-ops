import type Phaser from "phaser";
import { ACTOR_KEY } from "./assets";
import { type NinjaColor, recolorRgba, SUIT_RECIPES } from "./ninjaPalette";

const ALLY_KEYS: Record<NinjaColor, string> = {
  kai: ACTOR_KEY.allyKai,
  jay: ACTOR_KEY.allyJay,
  zane: ACTOR_KEY.allyZane,
  cole: ACTOR_KEY.allyCole,
};

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
  for (const color of Object.keys(ALLY_KEYS) as NinjaColor[]) {
    const key = ALLY_KEYS[color];
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.drawImage(source, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    recolorRgba(image.data, SUIT_RECIPES[color]);
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
