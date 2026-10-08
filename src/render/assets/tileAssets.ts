import { SHEET_FILES, type SheetKey } from "../../data/hubTiles";
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

/** Texture key for a hub tileset sheet. */
export const hubSheetKey = (sheet: SheetKey): string => `hub-${sheet}`;

const HUB_SHEETS = Object.keys(SHEET_FILES) as SheetKey[];

/** Hub and world tilesets; the arena sheets above stay for battles. */
export const HUB_TILE_ASSETS: readonly AssetEntry[] = HUB_SHEETS.map(
  (sheet): AssetEntry => ({
    type: "spritesheet",
    key: hubSheetKey(sheet),
    url: assetUrl(`tiles/${SHEET_FILES[sheet]}`),
    frameWidth: 16,
    frameHeight: 16,
  }),
);
