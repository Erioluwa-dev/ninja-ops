import {
  blobCell,
  type Cell,
  FOREST_FILL,
  FOREST_TREE,
  GRASS,
  neighbourMask,
  PLANK,
  STAMPS,
  type StampDef,
  type StampId,
  TERRAIN,
  variantHash,
} from "./hubTiles";

export interface StampPlacement {
  id: StampId;
  col: number;
  row: number;
}

export interface PlacedStamp {
  def: StampDef;
  col: number;
  row: number;
}

export interface ComposedMap {
  cols: number;
  rows: number;
  /** Base layer then overlay layer per tile; overlay may be null. */
  ground: Cell[];
  overlay: (Cell | null)[];
  stamps: PlacedStamp[];
  solid: boolean[];
}

const SOLID_GROUND = new Set(["#", "~"]);

/**
 * Turns map rows and stamp placements into draw layers and a collision grid.
 * Pure so tests and the offline preview see exactly what the game draws.
 */
export function composeMap(
  rows: readonly string[],
  placements: readonly StampPlacement[],
): ComposedMap {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const charAt = (col: number, row: number): string => {
    if (col < 0 || row < 0 || col >= width || row >= height) return "#";
    return rows[row]?.[col] ?? "#";
  };
  const ground: Cell[] = [];
  const overlay: (Cell | null)[] = [];
  const solid: boolean[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const ch = charAt(col, row);
      const grass =
        GRASS[variantHash(col, row) % GRASS.length] ?? GRASS[0] ?? PLANK;
      ground.push(grass);
      solid.push(SOLID_GROUND.has(ch));
      const blob =
        ch === ","
          ? TERRAIN.path
          : ch === "~"
            ? TERRAIN.water
            : ch === "_"
              ? TERRAIN.plaza
              : null;
      if (blob) {
        // A bridge sits on water, so the pond keeps its shape under it.
        const joins = (c: number, r: number): boolean => {
          const other = charAt(c, r);
          return other === ch || (ch === "~" && other === "=");
        };
        const mask = neighbourMask(joins, col, row);
        overlay.push(blobCell(blob, mask));
      } else if (ch === "=") {
        overlay.push(PLANK);
      } else {
        overlay.push(null);
      }
    }
  }

  const stamps: PlacedStamp[] = [];
  // Forest is drawn as a canopy on 2x2 blocks so edges stay irregular but
  // the collision still follows the '#' tiles exactly.
  for (let row = 0; row < height; row += 2) {
    for (let col = 0; col < width; col += 2) {
      if (charAt(col, row) === "#" && charAt(col + 1, row + 1) === "#") {
        stamps.push({ def: FOREST_TREE, col, row });
      }
    }
  }
  // Lone forest tiles the canopy missed still need something to show
  // why they block.
  const covered = new Set<number>();
  for (const s of stamps) {
    for (const [dc, dr] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      covered.add((s.row + dr) * width + s.col + dc);
    }
  }
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (charAt(col, row) === "#" && !covered.has(row * width + col)) {
        stamps.push({ def: FOREST_FILL, col, row });
      }
    }
  }
  for (const p of placements) {
    const def = STAMPS[p.id];
    stamps.push({ def, col: p.col, row: p.row });
    const from = def.solidCols?.from ?? 0;
    const to = def.solidCols?.to ?? def.w - 1;
    for (let r = def.h - def.solidRows; r < def.h; r++) {
      for (let c = from; c <= to; c++) {
        const cc = p.col + c;
        const rr = p.row + r;
        if (cc < 0 || rr < 0 || cc >= width || rr >= height) continue;
        solid[rr * width + cc] = true;
      }
    }
  }
  return { cols: width, rows: height, ground, overlay, stamps, solid };
}
