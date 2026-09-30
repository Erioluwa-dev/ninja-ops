import type { Entity, EntityState } from "./types";

// Index is priority: a later entry preempts an earlier one. Jump and spin have
// no behavior yet; they hold their slots so later phases need no reshuffle.
export const STATE_PRIORITY: readonly EntityState[] = [
  "idle",
  "move",
  "attack",
  "block",
  "dodge",
  "jump",
  "spin",
  "stagger",
  "guardBreak",
  "hurt",
];

function priorityOf(state: EntityState): number {
  return STATE_PRIORITY.indexOf(state);
}

export function canEnterState(from: EntityState, to: EntityState): boolean {
  return priorityOf(to) > priorityOf(from);
}

export function clearAttack(e: Entity): void {
  e.combat.attackId = null;
  e.combat.attackFrame = 0;
  e.combat.comboIndex = 0;
  e.combat.attackHits = [];
  e.combat.attackCounter = false;
}

/** Forced by a hit or guard break, so it bypasses the priority check. */
export function enterStun(
  e: Entity,
  kind: "hurt" | "stagger" | "guardBreak",
  frames: number,
): void {
  clearAttack(e);
  const c = e.combat;
  c.attackBuffer = 0;
  c.dodgeBuffer = 0;
  c.dodgeFrame = 0;
  c.blockFrame = 0;
  c.counterWindow = 0;
  c.stun = frames;
  e.state = kind;
}
