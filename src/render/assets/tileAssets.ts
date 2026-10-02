import { assetUrl } from "./assetUrl";
import type { AssetEntry } from "./types";

export const TILE_KEY = {
  floor: "tiles-floor",
  wall: "tiles-wall",
} as const;

/** Columns per sheet; a frame index is row * cols + col. */
export const TILE_SHEET_COLS = {
  floor: 22,
  wall: 20,
} as const;

export const TILE_ASSETS = [
  {
    type: "spritesheet",
    key: TILE_KEY.floor,
    url: assetUrl("tiles/floor-interior-stone.png"),
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    type: "spritesheet",
    key: TILE_KEY.wall,
    url: assetUrl("tiles/wall-relief-cliff.png"),
    frameWidth: 16,
    frameHeight: 16,
  },
] as const satisfies readonly AssetEntry[];
