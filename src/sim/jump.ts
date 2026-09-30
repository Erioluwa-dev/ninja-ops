import type { JumpData } from "../data/kits";
import type { Tuning } from "../data/tuning";
import type { Entity } from "./types";

/** Height above the ground `frame` frames after takeoff; a parabola that is 0 at both ends. */
export function jumpHeight(jump: JumpData, frame: number): number {
  if (frame <= 0 || frame >= jump.frames) return 0;
  const u = frame / jump.frames;
  return 4 * jump.peakHeight * u * (1 - u);
}

/** High enough to slip under ground attacks; the landing recovery is not airborne. */
export function isAirborne(e: Entity, tuning: Tuning): boolean {
  return e.z > tuning.combat.airborneZ;
}
