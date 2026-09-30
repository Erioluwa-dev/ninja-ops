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

/** Where the attack's rect sits in front of the attacker, whatever the phase. */
export function attackBox(e: Entity, attack: AttackData): Box | null {
  if (attack.projectile !== undefined) return null;
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

/** The ground-plane hit rect, or null outside the attack's active frames. */
export function activeHitbox(e: Entity, tuning: Tuning): Box | null {
  const attack = currentAttack(e, tuning);
  if (!attack || attackPhase(attack, e.combat.attackFrame) !== "active") {
    return null;
  }
  return attackBox(e, attack);
}

/** The rect a telegraphed swing is about to make live; null outside startup. */
export function telegraphBox(e: Entity, tuning: Tuning): Box | null {
  const attack = currentAttack(e, tuning);
  if (!attack?.telegraph) return null;
  if (attackPhase(attack, e.combat.attackFrame) !== "startup") return null;
  return attackBox(e, attack);
}
