import { getKit, type Tuning } from "../data/tuning";
import { attackPhase, currentAttack } from "./attack";
import type { Entity } from "./types";

/**
 * Damage multiplier when super armor is in force, otherwise null. Armor covers
 * a swing's startup and active frames only, so its recovery stays punishable.
 */
export function armorScale(
  e: Entity,
  fromSpin: boolean,
  tuning: Tuning,
): number | null {
  const armor = getKit(tuning, e.kitId).armor;
  if (!armor) return null;
  if (fromSpin) return armor.spinDamageScale;
  return isArmored(e, tuning) ? armor.attackDamageScale : null;
}

export function isArmored(e: Entity, tuning: Tuning): boolean {
  if (getKit(tuning, e.kitId).armor === null) return false;
  const attack = currentAttack(e, tuning);
  if (!attack) return false;
  return attackPhase(attack, e.combat.attackFrame) !== "recovery";
}
