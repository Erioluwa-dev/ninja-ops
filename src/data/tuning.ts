import { ATTACKS, type AttackData } from "./attacks";
import { COMBAT, type CombatData } from "./combat";
import { KITS, type KitData } from "./kits";

/** Everything the sim reads that shapes feel; a live, mutable copy of the source data. */
export interface Tuning {
  kits: Record<string, KitData>;
  attacks: Record<string, AttackData>;
  combat: CombatData;
}

export function createTuning(): Tuning {
  return {
    kits: structuredClone(KITS),
    attacks: structuredClone(ATTACKS),
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
