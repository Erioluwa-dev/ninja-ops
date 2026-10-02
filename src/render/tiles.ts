import { type Arena, isSolidTile } from "../sim";
import { TILE_SHEET_COLS } from "./assets";

/** Bits of a neighbor mask: set when that side's neighbor is a wall. */
export const NEIGHBOR = { n: 1, e: 2, s: 4, w: 8 } as const;

/**
 * Walls use the 3x3 cliff block at col 4, row 0 of the relief sheet: top row
 * has the lit rim, middle rows are plain face, the bottom row is the base.
 */
const WALL_ORIGIN = { col: 4, row: 0 } as const;

/**
 * An unconnected block: the cliff's rim stacked on its base, built into the
 * empty bottom-left cell of the wall sheet because no single cliff piece has
 * both. Bottom-left of a 20x12 sheet is row 11, col 0.
 */
const PILLAR_FRAME = 11 * TILE_SHEET_COLS.wall;

/** Plain cobble cells of the interior floor sheet that tile without seams. */
const FLOOR_CELLS = [
  { col: 16, row: 13 },
  { col: 17, row: 13 },
  { col: 16, row: 14 },
  { col: 17, row: 14 },
] as const;

export function neighborMask(arena: Arena, col: number, row: number): number {
  let mask = 0;
  if (isSolidTile(arena, col, row - 1)) mask |= NEIGHBOR.n;
  if (isSolidTile(arena, col + 1, row)) mask |= NEIGHBOR.e;
  if (isSolidTile(arena, col, row + 1)) mask |= NEIGHBOR.s;
  if (isSolidTile(arena, col - 1, row)) mask |= NEIGHBOR.w;
  return mask;
}

/**
 * Frame of the wall sheet for a wall tile with the given neighbor mask. Open
 * air above shows the rim, open air below (with a wall above) shows the base,
 * and an open side shows that side's edge. A wall with no wall neighbor is a
 * pillar and gets its own complete block, since every cliff piece assumes a
 * neighbor on some side.
 */
export function wallFrame(mask: number): number {
  if (mask === 0) return PILLAR_FRAME;
  const northOpen = (mask & NEIGHBOR.n) === 0;
  const southOpen = (mask & NEIGHBOR.s) === 0;
  const westOpen = (mask & NEIGHBOR.w) === 0;
  const eastOpen = (mask & NEIGHBOR.e) === 0;
  const rowOffset = northOpen ? 0 : southOpen ? 2 : 1;
  const colOffset = westOpen ? 0 : eastOpen ? 2 : 1;
  return (
    (WALL_ORIGIN.row + rowOffset) * TILE_SHEET_COLS.wall +
    WALL_ORIGIN.col +
    colOffset
  );
}

/** Deterministic per-tile pick, so the floor never shimmers between frames. */
export function floorFrame(col: number, row: number): number {
  let hash = (Math.imul(col, 374761393) + Math.imul(row, 668265263)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  const cell = FLOOR_CELLS[hash % FLOOR_CELLS.length];
  if (!cell) throw new Error("FLOOR_CELLS must not be empty");
  return cell.row * TILE_SHEET_COLS.floor + cell.col;
}
