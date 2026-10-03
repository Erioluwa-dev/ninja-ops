import { enterDead } from "./states";
import type { Entity, SimState } from "./types";

/**
 * The scripted blow that ends a canon villain (Bible: the ninja keep their big
 * moments). It is the only damage path that ignores the canon-villain floor, so
 * it is never reachable from player, ghost or blade input.
 */
export function applyTeamFinisher(state: SimState, target: Entity): void {
  if (target.state === "dead") return;
  target.hp = 0;
  enterDead(target, state.tuning);
}
