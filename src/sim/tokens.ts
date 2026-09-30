import type { Tuning } from "../data/tuning";
import { isStunned } from "./states";
import type { Entity, SimState } from "./types";

export function tokenCapacity(tuning: Tuning): number {
  const { pool, max } = tuning.combat.tokens;
  return Math.min(pool, max);
}

export function tokensInUse(state: SimState): number {
  return state.tokens.reduce((sum, t) => sum + t.weight, 0);
}

export function holdsToken(state: SimState, e: Entity): boolean {
  return state.tokens.some((t) => t.entityId === e.id);
}

export function tryAcquireToken(
  state: SimState,
  e: Entity,
  weight: number,
): boolean {
  if (holdsToken(state, e)) return true;
  if (tokensInUse(state) + weight > tokenCapacity(state.tuning)) return false;
  state.tokens.push({ entityId: e.id, weight });
  return true;
}

export function releaseToken(state: SimState, e: Entity): void {
  state.tokens = state.tokens.filter((t) => t.entityId !== e.id);
}

/** A holder that was hit, staggered or killed loses its slot the same tick. */
export function pruneTokens(state: SimState): void {
  state.tokens = state.tokens.filter((t) => {
    const holder = state.entities.find((e) => e.id === t.entityId);
    return (
      holder !== undefined && holder.state !== "dead" && !isStunned(holder)
    );
  });
}
