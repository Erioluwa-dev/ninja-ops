/**
 * Tile atlas for hub and world maps, indexed into the Ninja Adventure
 * tilesets by 16 px cell. Kept as data so maps and the offline preview
 * share one source of truth.
 */

export type SheetKey =
  | "floor"
  | "nature"
  | "house"
  | "water"
  | "element"
  | "detail"
  | "village"
  | "interior";

export const SHEET_FILES: Record<SheetKey, string> = {
  floor: "TilesetFloor.png",
  nature: "TilesetNature.png",
  house: "TilesetHouse.png",
  water: "TilesetWater.png",
  element: "TilesetElement.png",
  detail: "TilesetFloorDetail.png",
  village: "TilesetVillageAbandoned.png",
  interior: "floor-interior-stone.png",
};

export const SHEET_COLS: Record<SheetKey, number> = {
  floor: 22,
  nature: 24,
  house: 33,
  water: 28,
  element: 16,
  detail: 16,
  village: 20,
  interior: 22,
};

export interface Cell {
  sheet: SheetKey;
  col: number;
  row: number;
}

export function frameOf(cell: Cell): number {
  return cell.row * SHEET_COLS[cell.sheet] + cell.col;
}

/** Ground characters used in map rows. */
export type GroundChar = "." | "," | "~" | "=" | "#" | "_" | "+" | "W";

/**
 * A terrain painted over a base with the pack's 4x4 blob layout: a 3x3
 * rounded block, a vertical strip in the 4th column, a horizontal strip in
 * the 4th row and a lone patch in the corner. Picking by the 4-neighbour
 * mask is enough for the shapes our maps use.
 */
export interface Blob {
  sheet: SheetKey;
  col: number;
  row: number;
}

const N = 1;
const E = 2;
const S = 4;
const W = 8;

/** Offset into the blob block for each 4-neighbour mask. */
const BLOB_OFFSET: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let mask = 0; mask < 16; mask++) {
    const n = (mask & N) !== 0;
    const e = (mask & E) !== 0;
    const s = (mask & S) !== 0;
    const w = (mask & W) !== 0;
    let c: number;
    let r: number;
    if ((e || w) && (n || s)) {
      c = w && e ? 1 : w ? 2 : 0;
      r = n && s ? 1 : n ? 2 : 0;
    } else if (n || s) {
      c = 3;
      r = n && s ? 1 : n ? 2 : 0;
    } else if (e || w) {
      r = 3;
      c = w && e ? 1 : w ? 2 : 0;
    } else {
      c = 3;
      r = 3;
    }
    out.push([c, r]);
  }
  return out;
})();

export function blobCell(blob: Blob, mask: number): Cell {
  const off = BLOB_OFFSET[mask & 15] ?? [3, 3];
  return { sheet: blob.sheet, col: blob.col + off[0], row: blob.row + off[1] };
}

export function neighbourMask(
  same: (col: number, row: number) => boolean,
  col: number,
  row: number,
): number {
  return (
    (same(col, row - 1) ? N : 0) |
    (same(col + 1, row) ? E : 0) |
    (same(col, row + 1) ? S : 0) |
    (same(col - 1, row) ? W : 0)
  );
}

/** Plain grass, with tufted variants scattered by a stable hash. */
export const GRASS: readonly Cell[] = [
  { sheet: "floor", col: 0, row: 12 },
  { sheet: "floor", col: 0, row: 12 },
  { sheet: "floor", col: 0, row: 12 },
  { sheet: "floor", col: 1, row: 12 },
  { sheet: "floor", col: 2, row: 12 },
  { sheet: "floor", col: 3, row: 12 },
];

export const TERRAIN: Record<"path" | "water" | "plaza" | "court", Blob> = {
  path: { sheet: "floor", col: 0, row: 7 },
  water: { sheet: "water", col: 0, row: 6 },
  plaza: { sheet: "floor", col: 0, row: 0 },
  /** Monastery courtyard: framed sandstone paving. */
  court: { sheet: "interior", col: 11, row: 0 },
};

/** Wooden boardwalk: a plain plank tile. */
export const PLANK: Cell = { sheet: "water", col: 5, row: 13 };

export function variantHash(col: number, row: number): number {
  let h = (col * 374761393 + row * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export interface StampDef {
  sheet: SheetKey;
  col: number;
  row: number;
  w: number;
  h: number;
  /** Bottom rows that block movement; the rest draws over the player. */
  solidRows: number;
  /** Solid columns inside the footprint, when narrower than the stamp. */
  solidCols?: { from: number; to: number };
}

const stamp = (
  sheet: SheetKey,
  col: number,
  row: number,
  w: number,
  h: number,
  solidRows: number,
  solidCols?: { from: number; to: number },
): StampDef =>
  solidCols === undefined
    ? { sheet, col, row, w, h, solidRows }
    : { sheet, col, row, w, h, solidRows, solidCols };

export const STAMPS = {
  pine: stamp("nature", 2, 0, 2, 2, 1),
  oak: stamp("nature", 0, 0, 2, 2, 1),
  cherry: stamp("nature", 14, 0, 2, 2, 1),
  bigCherry: stamp("nature", 0, 18, 3, 3, 1, { from: 1, to: 1 }),
  bigOak: stamp("nature", 3, 18, 3, 3, 1, { from: 1, to: 1 }),
  pineGrove: stamp("nature", 0, 2, 4, 3, 1),
  bush: stamp("nature", 1, 10, 1, 1, 1),
  shrub: stamp("nature", 2, 10, 1, 1, 1),
  fern: stamp("nature", 6, 11, 1, 1, 0),
  sunflower: stamp("nature", 0, 11, 1, 1, 0),
  bamboo: stamp("nature", 11, 8, 1, 3, 1),
  rock: stamp("nature", 18, 9, 1, 1, 1),
  boulder: stamp("nature", 16, 8, 2, 2, 1),
  stump: stamp("nature", 4, 8, 1, 1, 1),

  torii: stamp("house", 0, 5, 3, 2, 0),
  hall: stamp("house", 12, 0, 4, 3, 2),
  house: stamp("house", 0, 0, 4, 3, 2),
  shop: stamp("house", 16, 0, 3, 3, 2),
  tavern: stamp("house", 19, 0, 4, 3, 2),
  bakery: stamp("house", 23, 0, 3, 3, 2),
  cottage: stamp("house", 26, 0, 3, 3, 2),
  dojoSign: stamp("house", 4, 4, 2, 1, 0),
  stairs: stamp("house", 9, 15, 4, 3, 0),
  statue: stamp("house", 1, 15, 2, 3, 2),
  lionStatue: stamp("house", 3, 15, 2, 2, 1),
  stall: stamp("house", 16, 16, 3, 2, 2),
  barrel: stamp("house", 16, 15, 1, 1, 1),
  crate: stamp("house", 17, 15, 1, 1, 1),
  bannerRed: stamp("house", 23, 20, 1, 2, 1),
  bannerGreen: stamp("house", 25, 20, 1, 2, 1),
  weaponRack: stamp("house", 14, 10, 2, 2, 1),
  board: stamp("element", 11, 1, 3, 1, 1),
  flowers: stamp("detail", 5, 2, 1, 1, 0),
  grassTuft: stamp("detail", 3, 2, 1, 1, 0),
  leaves: stamp("detail", 0, 0, 1, 1, 0),
  medallion: stamp("interior", 15, 0, 4, 4, 0),
  wallH: stamp("house", 10, 4, 1, 2, 1),
  wallV: stamp("house", 11, 7, 1, 1, 1),
  wallCorner: stamp("house", 8, 4, 1, 2, 1),
  tower: stamp("house", 19, 3, 3, 6, 3),
  dummy: stamp("element", 11, 0, 1, 1, 1),
} as const satisfies Record<string, StampDef>;

export type StampId = keyof typeof STAMPS;

/** Forest tiles ('#') are filled with this canopy, one per 2x2 block. */
export const FOREST_TREE: StampDef = STAMPS.pine;

export const FOREST_FILL: StampDef = STAMPS.bush;
