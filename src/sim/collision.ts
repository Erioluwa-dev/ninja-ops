import { isSolidTile } from "./arena";
import type { Arena, Entity } from "./types";

// Touching edges are not overlap; the slack absorbs float error after a snap.
const EPSILON = 1e-6;

export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function feetBox(e: Entity): Box {
  return {
    minX: e.pos.x - e.feet.w / 2,
    maxX: e.pos.x + e.feet.w / 2,
    minY: e.pos.y - e.feet.h / 2,
    maxY: e.pos.y + e.feet.h / 2,
  };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.minX < b.maxX - EPSILON &&
    a.maxX > b.minX + EPSILON &&
    a.minY < b.maxY - EPSILON &&
    a.maxY > b.minY + EPSILON
  );
}

function solidTilesOverlapping(arena: Arena, box: Box): Box[] {
  const ts = arena.tileSize;
  const c0 = Math.floor((box.minX + EPSILON) / ts);
  const c1 = Math.floor((box.maxX - EPSILON) / ts);
  const r0 = Math.floor((box.minY + EPSILON) / ts);
  const r1 = Math.floor((box.maxY - EPSILON) / ts);
  const tiles: Box[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (isSolidTile(arena, c, r)) {
        tiles.push({
          minX: c * ts,
          maxX: (c + 1) * ts,
          minY: r * ts,
          maxY: (r + 1) * ts,
        });
      }
    }
  }
  return tiles;
}

export function boxHitsWall(arena: Arena, box: Box): boolean {
  return solidTilesOverlapping(arena, box).length > 0;
}

function blockersOverlapping(
  arena: Arena,
  mover: Entity,
  others: readonly Entity[],
): Box[] {
  const box = feetBox(mover);
  const blockers = solidTilesOverlapping(arena, box);
  for (const other of others) {
    // A corpse fades in place and must not wall anyone in.
    if (other.id === mover.id || other.state === "dead") continue;
    const otherBox = feetBox(other);
    if (boxesOverlap(box, otherBox)) blockers.push(otherBox);
  }
  return blockers;
}

function moveAxis(
  arena: Arena,
  mover: Entity,
  others: readonly Entity[],
  axis: "x" | "y",
  delta: number,
): void {
  if (delta === 0) return;
  // Sub-steps under half a tile keep a fast mover from skipping over a thin
  // wall or entity between the before and after positions.
  const maxStep = Math.min(arena.tileSize, mover.feet.w, mover.feet.h) / 2;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / maxStep));
  const stepDelta = delta / steps;
  const half = (axis === "x" ? mover.feet.w : mover.feet.h) / 2;

  for (let i = 0; i < steps; i++) {
    mover.pos[axis] += stepDelta;
    const blockers = blockersOverlapping(arena, mover, others);
    if (blockers.length === 0) continue;

    let edge =
      stepDelta > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    for (const b of blockers) {
      if (stepDelta > 0) edge = Math.min(edge, axis === "x" ? b.minX : b.minY);
      else edge = Math.max(edge, axis === "x" ? b.maxX : b.maxY);
    }
    mover.pos[axis] = stepDelta > 0 ? edge - half : edge + half;
    return;
  }
}

/** Per-axis (x then y) so a blocked axis does not stop motion along the other. */
export function moveAndCollide(
  arena: Arena,
  mover: Entity,
  others: readonly Entity[],
  dx: number,
  dy: number,
): void {
  moveAxis(arena, mover, others, "x", dx);
  moveAxis(arena, mover, others, "y", dy);
}
