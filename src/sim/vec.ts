import type { Vec2 } from "./types";

/** Ties go horizontal so a perfect diagonal still has a stable facing. */
export function snapCardinal(v: Vec2): Vec2 {
  if (Math.abs(v.x) >= Math.abs(v.y)) return { x: v.x < 0 ? -1 : 1, y: 0 };
  return { x: 0, y: v.y < 0 ? -1 : 1 };
}

export function normalized(v: Vec2): Vec2 {
  const mag = Math.hypot(v.x, v.y);
  return mag === 0 ? { x: 0, y: 0 } : { x: v.x / mag, y: v.y / mag };
}
