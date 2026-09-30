import { ARENA_LAYOUT } from "../data/arena";
import type { Arena } from "./types";

export function createArena(): Arena {
  const { rows, tileSize } = ARENA_LAYOUT;
  const cols = rows[0]?.length ?? 0;
  const solid: boolean[] = [];
  for (const row of rows) {
    if (row.length !== cols) {
      throw new Error("Arena layout rows must all be the same length");
    }
    for (const ch of row) solid.push(ch === "#");
  }
  return { cols, rows: rows.length, tileSize, solid };
}

export function tileCenter(
  arena: Arena,
  col: number,
  row: number,
): { x: number; y: number } {
  return {
    x: col * arena.tileSize + arena.tileSize / 2,
    y: row * arena.tileSize + arena.tileSize / 2,
  };
}

export function isSolidTile(arena: Arena, col: number, row: number): boolean {
  // Out of bounds counts as solid so nothing can leave the arena.
  if (col < 0 || row < 0 || col >= arena.cols || row >= arena.rows) return true;
  return arena.solid[row * arena.cols + col] === true;
}
