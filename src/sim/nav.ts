import { isSolidTile, tileCenter } from "./arena";
import { boxHitsWall } from "./collision";
import type { Arena, Entity, Vec2 } from "./types";
import { normalized } from "./vec";

const NEIGHBOURS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function tileOf(arena: Arena, p: Vec2): Vec2 {
  return {
    x: Math.floor(p.x / arena.tileSize),
    y: Math.floor(p.y / arena.tileSize),
  };
}

/**
 * Sweeps the mover's own feet box rather than a thin ray, so a line that
 * grazes a pillar corner still counts as blocked.
 */
export function hasClearPath(arena: Arena, mover: Entity, to: Vec2): boolean {
  const dx = to.x - mover.pos.x;
  const dy = to.y - mover.pos.y;
  const steps = Math.ceil(Math.hypot(dx, dy) / (arena.tileSize / 4));
  const hw = mover.feet.w / 2;
  const hh = mover.feet.h / 2;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = mover.pos.x + dx * t;
    const y = mover.pos.y + dy * t;
    if (
      boxHitsWall(arena, {
        minX: x - hw,
        maxX: x + hw,
        minY: y - hh,
        maxY: y + hh,
      })
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Centre of the next tile on a shortest 4-connected path, or null when already
 * in the goal tile or the goal is unreachable. Diagonal steps are left out
 * because they would cut pillar corners the feet box can't pass.
 */
export function nextWaypoint(arena: Arena, from: Vec2, to: Vec2): Vec2 | null {
  const start = tileOf(arena, from);
  const goal = tileOf(arena, to);
  if (start.x === goal.x && start.y === goal.y) return null;
  if (isSolidTile(arena, goal.x, goal.y)) return null;

  // Distances are flooded from the goal so the start only has to pick its
  // closest neighbour.
  const dist = new Array<number>(arena.cols * arena.rows).fill(-1);
  const index = (c: number, r: number) => r * arena.cols + c;
  const queue: Vec2[] = [goal];
  dist[index(goal.x, goal.y)] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    if (!cell) break;
    const d = dist[index(cell.x, cell.y)] ?? 0;
    for (const n of NEIGHBOURS) {
      const c = cell.x + n.x;
      const r = cell.y + n.y;
      if (isSolidTile(arena, c, r) || dist[index(c, r)] !== -1) continue;
      dist[index(c, r)] = d + 1;
      queue.push({ x: c, y: r });
    }
  }

  let best: Vec2 | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const n of NEIGHBOURS) {
    const c = start.x + n.x;
    const r = start.y + n.y;
    if (isSolidTile(arena, c, r)) continue;
    const d = dist[index(c, r)] ?? -1;
    if (d >= 0 && d < bestDist) {
      bestDist = d;
      best = tileCenter(arena, c, r);
    }
  }
  return best;
}

/** `desired` when the straight line is open, else the heading to the next waypoint. */
export function navigate(
  arena: Arena,
  mover: Entity,
  target: Vec2,
  desired: Vec2,
): Vec2 {
  if (hasClearPath(arena, mover, target)) return desired;
  const waypoint = nextWaypoint(arena, mover.pos, target);
  if (!waypoint) return desired;
  return normalized({
    x: waypoint.x - mover.pos.x,
    y: waypoint.y - mover.pos.y,
  });
}
