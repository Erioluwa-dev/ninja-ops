import type Phaser from "phaser";
import { ACTOR_ASSETS } from "./actorAssets";
import { FX_ASSETS } from "./fxAssets";
import { HUD_ASSETS } from "./hudAssets";
import { TILE_ASSETS } from "./tileAssets";
import type { AssetEntry } from "./types";

export { ACTOR_ASSETS, ACTOR_KEY } from "./actorAssets";
export { FX_ASSETS, FX_KEY } from "./fxAssets";
export { HUD_ASSETS, HUD_KEY } from "./hudAssets";
export { TILE_ASSETS, TILE_KEY, TILE_SHEET_COLS } from "./tileAssets";
export type { AssetEntry, ImageAsset, SpritesheetAsset } from "./types";

const MANIFESTS: readonly (readonly AssetEntry[])[] = [
  ACTOR_ASSETS,
  TILE_ASSETS,
  FX_ASSETS,
  HUD_ASSETS,
];

// Phaser.Loader.Events.FILE_LOAD_ERROR, spelled out so this module (imported by
// unit tests) never loads Phaser itself, which needs a browser.
const LOAD_ERROR = "loaderror";

// A missing file would otherwise show up only as Phaser's green placeholder.
function reportLoadError(file: Phaser.Loader.File): void {
  console.error(
    `Failed to load ${file.type} asset "${file.key}" from ${file.src}`,
  );
}

/** Queue every art asset on the scene's loader; call from `preload`. */
export function preloadAssets(scene: Phaser.Scene): void {
  // The loader outlives scene restarts, so drop any listener left by an earlier preload.
  scene.load.off(LOAD_ERROR, reportLoadError);
  scene.load.on(LOAD_ERROR, reportLoadError);
  for (const manifest of MANIFESTS) {
    for (const asset of manifest) {
      if (asset.type === "spritesheet") {
        scene.load.spritesheet(asset.key, asset.url, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
        });
      } else {
        scene.load.image(asset.key, asset.url);
      }
    }
  }
}
