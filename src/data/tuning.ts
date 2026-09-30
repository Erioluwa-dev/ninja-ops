import { ATTACKS, type AttackData } from "./attacks";
import { COMBAT, type CombatData } from "./combat";
import { KITS, type KitData } from "./kits";
import { MOBS, type MobData } from "./mobs";
import { PROJECTILES, type ProjectileData } from "./projectiles";

/** Everything the sim reads that shapes feel; a live, mutable copy of the source data. */
export interface Tuning {
  kits: Record<string, KitData>;
  attacks: Record<string, AttackData>;
  mobs: Record<string, MobData>;
  projectiles: Record<string, ProjectileData>;
  combat: CombatData;
}

export function createTuning(): Tuning {
  return {
    kits: structuredClone(KITS),
    attacks: structuredClone(ATTACKS),
    mobs: structuredClone(MOBS),
    projectiles: structuredClone(PROJECTILES),
    combat: structuredClone(COMBAT),
  };
}

export function getKit(tuning: Tuning, kitId: string): KitData {
  const kit = tuning.kits[kitId];
  if (!kit) throw new Error(`Unknown kit id: ${kitId}`);
  return kit;
}

export function getAttack(tuning: Tuning, attackId: string): AttackData {
  const attack = tuning.attacks[attackId];
  if (!attack) throw new Error(`Unknown attack id: ${attackId}`);
  return attack;
}

export function getMob(tuning: Tuning, mobType: string): MobData {
  const mob = tuning.mobs[mobType];
  if (!mob) throw new Error(`Unknown mob type: ${mobType}`);
  return mob;
}

export function getProjectile(
  tuning: Tuning,
  projectileId: string,
): ProjectileData {
  const projectile = tuning.projectiles[projectileId];
  if (!projectile) throw new Error(`Unknown projectile id: ${projectileId}`);
  return projectile;
}
