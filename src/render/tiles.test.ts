import { describe, expect, it } from "vitest";
import { ARENA_LAYOUT } from "../data/arena";
import { type Arena, createSim } from "../sim";
import { TILE_SHEET_COLS } from "./assets";
import { floorFrame, NEIGHBOR, neighborMask, wallFrame } from "./tiles";

function arenaFrom(rows: readonly string[]): Arena {
  const cols = rows[0]?.length ?? 0;
  return {
    cols,
    rows: rows.length,
    tileSize: 16,
    solid: rows.flatMap((row) => [...row].map((ch) => ch === "#")),
  };
}

// The cliff block's 3x3 pieces by (col, row) offset from its origin.
const piece = (colOffset: number, rowOffset: number): number =>
  rowOffset * TILE_SHEET_COLS.wall + 4 + colOffset;

describe("neighborMask", () => {
  const arena = arenaFrom(["#.#", "...", "#.."]);

  it("is empty when every neighbor is floor", () => {
    expect(neighborMask(arena, 1, 1)).toBe(0);
  });

  it("sets a bit for each wall neighbor", () => {
    expect(neighborMask(arena, 1, 0) & NEIGHBOR.e).toBe(NEIGHBOR.e);
    expect(neighborMask(arena, 1, 0) & NEIGHBOR.w).toBe(NEIGHBOR.w);
    expect(neighborMask(arena, 1, 0) & NEIGHBOR.s).toBe(0);
    expect(neighborMask(arena, 0, 1)).toBe(
      NEIGHBOR.n | NEIGHBOR.s | NEIGHBOR.w,
    );
  });

  it("counts out of bounds as solid so the outer ring has no open edge", () => {
    expect(neighborMask(arena, 1, 0) & NEIGHBOR.n).toBe(NEIGHBOR.n);
    expect(neighborMask(arena, 2, 2) & NEIGHBOR.s).toBe(NEIGHBOR.s);
    expect(neighborMask(arena, 2, 2) & NEIGHBOR.e).toBe(NEIGHBOR.e);
  });
});

describe("wallFrame", () => {
  const all = NEIGHBOR.n | NEIGHBOR.e | NEIGHBOR.s | NEIGHBOR.w;

  it("returns a piece of the 3x3 cliff block for every mask with a wall neighbor", () => {
    const pieces = new Set<number>();
    for (let mask = 1; mask <= all; mask++) pieces.add(wallFrame(mask));
    const block = new Set<number>();
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) block.add(piece(c, r));
    expect([...pieces].every((frame) => block.has(frame))).toBe(true);
  });

  it("uses the plain face when every neighbor is a wall", () => {
    expect(wallFrame(all)).toBe(piece(1, 1));
  });

  it("shows the rim where air is above and the base where air is below", () => {
    expect(wallFrame(all & ~NEIGHBOR.n)).toBe(piece(1, 0));
    expect(wallFrame(all & ~NEIGHBOR.s)).toBe(piece(1, 2));
  });

  it("shows an edge on whichever side is open", () => {
    expect(wallFrame(all & ~NEIGHBOR.w)).toBe(piece(0, 1));
    expect(wallFrame(all & ~NEIGHBOR.e)).toBe(piece(2, 1));
  });

  it("combines open sides into corners", () => {
    expect(wallFrame(all & ~NEIGHBOR.n & ~NEIGHBOR.w)).toBe(piece(0, 0));
    expect(wallFrame(all & ~NEIGHBOR.n & ~NEIGHBOR.e)).toBe(piece(2, 0));
    expect(wallFrame(all & ~NEIGHBOR.s & ~NEIGHBOR.w)).toBe(piece(0, 2));
    expect(wallFrame(all & ~NEIGHBOR.s & ~NEIGHBOR.e)).toBe(piece(2, 2));
  });

  it("gives a lone pillar its own block rather than a cliff corner", () => {
    const pillar = wallFrame(0);
    expect(pillar).toBe(11 * TILE_SHEET_COLS.wall);
    for (let mask = 1; mask <= all; mask++) {
      expect(wallFrame(mask)).not.toBe(pillar);
    }
  });

  it("tiles the real arena: face on the top wall, rim on the bottom wall", () => {
    const { arena } = createSim({ seed: 1 });
    const lastRow = ARENA_LAYOUT.rows.length - 1;
    expect(wallFrame(neighborMask(arena, 5, 0))).toBe(piece(1, 2));
    expect(wallFrame(neighborMask(arena, 5, lastRow))).toBe(piece(1, 0));
    expect(wallFrame(neighborMask(arena, 0, 4))).toBe(piece(2, 1));
    expect(wallFrame(neighborMask(arena, arena.cols - 1, 4))).toBe(piece(0, 1));
  });
});

describe("floorFrame", () => {
  it("is deterministic per tile and ignores the order tiles are asked for", () => {
    const forward = [floorFrame(3, 4), floorFrame(7, 1), floorFrame(0, 9)];
    const backward = [floorFrame(0, 9), floorFrame(7, 1), floorFrame(3, 4)];
    expect(forward).toEqual(backward.reverse());
  });

  it("varies across the arena without leaving the cobble cells", () => {
    const frames = new Set<number>();
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 15; col++) frames.add(floorFrame(col, row));
    }
    expect(frames.size).toBeGreaterThan(1);
    const max = 17 * TILE_SHEET_COLS.floor;
    expect([...frames].every((frame) => frame >= 0 && frame < max)).toBe(true);
  });
});
