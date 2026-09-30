import type { Entity } from "./types";

export function depthOrder(entities: readonly Entity[]): Entity[] {
  return [...entities].sort((a, b) => a.pos.y - b.pos.y || a.id - b.id);
}
