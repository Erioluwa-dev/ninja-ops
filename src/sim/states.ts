import type { Tuning } from "../data/tuning";
import type { Entity, EntityState } from "./types";

// Index is priority: a later entry preempts an earlier one. Jump has no
// behavior yet; it holds its slot so later phases need no reshuffle. Dizzy is
// the after-spin stun, so it sits with the other forced states.
export const STATE_PRIORITY: readonly EntityState[] = [
  "idle",
  "move",
  "attack",
  "block",
  "dodge",
  "jump",
  "spin",
  "dizzy",
  "stagger",
  "guardBreak",
  "hurt",
  "dead",
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

export function clearSpin(e: Entity): void {
  e.combat.spinFrame = 0;
  e.combat.spinHitCd = {};
}

/** Forced by a hit, guard break or the end of a spin, so it bypasses the priority check. */
export function enterStun(
  e: Entity,
  kind: "hurt" | "stagger" | "guardBreak" | "dizzy",
  frames: number,
): void {
  clearAttack(e);
  clearSpin(e);
  const c = e.combat;
  c.attackBuffer = 0;
  c.dodgeBuffer = 0;
  c.dodgeFrame = 0;
  c.blockFrame = 0;
  c.counterWindow = 0;
  c.stun = frames;
  e.state = kind;
}

export function isStunned(e: Entity): boolean {
  return (
    e.state === "hurt" ||
    e.state === "stagger" ||
    e.state === "guardBreak" ||
    e.state === "dizzy"
  );
}

export function enterDead(e: Entity, tuning: Tuning): void {
  enterStun(e, "hurt", 0);
  e.combat.stun = tuning.combat.death.frames;
  e.combat.hurtIframes = 0;
  e.state = "dead";
}
