import { canDamage, isHostile } from "../data/factions";
import type { Tuning } from "../data/tuning";
import type { ActionFrame, Entity, SimState, Vec2 } from "./types";

/** What an entity wants this tick, whether it came from a player or a script. */
export interface Intent {
  moveX: number;
  moveY: number;
  attackPress: boolean;
  dodgePress: boolean;
  jumpPress: boolean;
  blockHeld: boolean;
  blockPress: boolean;
  spinHeld: boolean;
  /** Which of the kit's attacks an attack press starts; null is the first. */
  attackId: string | null;
  /** Direction to face while free, e.g. toward a target. */
  aim: Vec2 | null;
}

export const NO_INTENT: Intent = {
  moveX: 0,
  moveY: 0,
  attackPress: false,
  dodgePress: false,
  jumpPress: false,
  blockHeld: false,
  blockPress: false,
  spinHeld: false,
  attackId: null,
  aim: null,
};

function clampedMove(input: ActionFrame): Vec2 {
  const x = Number.isFinite(input.moveX) ? input.moveX : 0;
  const y = Number.isFinite(input.moveY) ? input.moveY : 0;
  const mag = Math.hypot(x, y);
  // Only shrink: a slight tilt must stay slower than full deflection.
  return mag > 1 ? { x: x / mag, y: y / mag } : { x, y };
}

export function playerIntent(input: ActionFrame, prev: ActionFrame): Intent {
  const move = clampedMove(input);
  return {
    moveX: move.x,
    moveY: move.y,
    attackPress: input.attack && !prev.attack,
    dodgePress: input.dodge && !prev.dodge,
    jumpPress: input.jump && !prev.jump,
    blockHeld: input.block,
    blockPress: input.block && !prev.block,
    spinHeld: input.spin,
    attackId: null,
    aim: null,
  };
}

/**
 * Closest living hostile; neutrals are hittable but never something to hunt.
 * A taunting ghost (Decoy Veil) outranks anything nearer.
 */
export function nearestHostile(state: SimState, self: Entity): Entity | null {
  let best: Entity | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  let taunter: Entity | null = null;
  let taunterDist = Number.POSITIVE_INFINITY;
  for (const other of state.entities) {
    if (other === self || other.state === "dead") continue;
    if (!isHostile(self.faction, other.faction)) continue;
    const d = Math.hypot(other.pos.x - self.pos.x, other.pos.y - self.pos.y);
    if (d < bestDist) {
      best = other;
      bestDist = d;
    }
    if (other.ghost?.taunt && d < taunterDist) {
      taunter = other;
      taunterDist = d;
    }
  }
  return taunter ?? best;
}

function nearestTarget(state: SimState, self: Entity): Entity | null {
  let best: Entity | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const other of state.entities) {
    if (other === self || other.state === "dead") continue;
    if (!canDamage(self.faction, other.faction)) continue;
    const d = Math.hypot(other.pos.x - self.pos.x, other.pos.y - self.pos.y);
    if (d < bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

export function dummyIntent(
  state: SimState,
  dummy: Entity,
  tuning: Tuning,
): Intent {
  const script = tuning.combat.dummy;
  if (!script.scriptedAttack) {
    dummy.aiTimer = script.interval;
    return NO_INTENT;
  }
  const free = dummy.state === "idle" || dummy.state === "move";
  if (!free || dummy.combat.hitstop > 0) return NO_INTENT;

  dummy.aiTimer -= 1;
  const target = nearestTarget(state, dummy);
  const aim = target
    ? { x: target.pos.x - dummy.pos.x, y: target.pos.y - dummy.pos.y }
    : null;
  if (dummy.aiTimer > 0) return { ...NO_INTENT, aim };
  dummy.aiTimer = script.interval;
  return { ...NO_INTENT, aim, attackPress: true };
}
