import type { AttackData } from "../data/attacks";
import { getAttack, type Tuning } from "../data/tuning";
import type { Box } from "./collision";
import type { AttackPhase, Entity } from "./types";

export function attackTotalFrames(attack: AttackData): number {
  return attack.startup + attack.active + attack.recovery;
}

export function attackPhase(attack: AttackData, frame: number): AttackPhase {
  if (frame < attack.startup) return "startup";
  if (frame < attack.startup + attack.active) return "active";
  return "recovery";
}

export function currentAttack(e: Entity, tuning: Tuning): AttackData | null {
  if (e.state !== "attack" || e.combat.attackId === null) return null;
  return getAttack(tuning, e.combat.attackId);
}

/** The ground-plane hit rect, or null outside the attack's active frames. */
export function activeHitbox(e: Entity, tuning: Tuning): Box | null {
  const attack = currentAttack(e, tuning);
  if (!attack || attackPhase(attack, e.combat.attackFrame) !== "active") {
    return null;
  }
  const { length, width, offset } = attack.hitbox;
  const horizontal = e.facing.x !== 0;
  const w = horizontal ? length : width;
  const h = horizontal ? width : length;
  const cx = e.pos.x + e.facing.x * offset;
  const cy = e.pos.y + e.facing.y * offset;
  return {
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minY: cy - h / 2,
    maxY: cy + h / 2,
  };
}
