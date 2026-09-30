import type { SpinModifierData } from "./kits";

/**
 * An element is only modifier lists: the sim merges them into the spinner's
 * own spin hooks at runtime, so a new element needs a data entry and no logic
 * as long as the modifiers it composes already exist.
 */
export interface ElementData {
  name: string;
  /** Tint for the HUD indicator and anything the element draws. */
  color: number;
  onSpinTick: readonly SpinModifierData[];
  onSpinEnd: readonly SpinModifierData[];
}

export const ELEMENTS = {
  // Burning trail: a patch at the feet every `interval` spin frames. Unblockable
  // and non-flinching, so it reads as damage over time rather than a combo tool.
  fire: {
    name: "Fire",
    color: 0xff8a30,
    onSpinTick: [
      {
        id: "spawnHazard",
        params: {
          interval: 12,
          lifetime: 150,
          radius: 8,
          damage: 2,
          guardDamage: 0,
          knockback: 0,
          hitstop: 0,
          unblockable: 1,
          flinch: 0,
          hitInterval: 30,
          color: 0xff8a30,
        },
      },
    ],
    onSpinEnd: [],
  },
  // Shockwave when the spin runs out naturally; a hit that breaks the spin
  // never reaches it.
  earth: {
    name: "Earth",
    color: 0xb0823a,
    onSpinTick: [],
    onSpinEnd: [
      {
        id: "radialBurst",
        params: {
          radius: 44,
          lifetime: 14,
          damage: 10,
          guardDamage: 20,
          knockback: 220,
          hitstop: 4,
          unblockable: 0,
          flinch: 1,
          color: 0xb0823a,
        },
      },
    ],
  },
} as const satisfies Record<string, ElementData>;

export type ElementId = keyof typeof ELEMENTS;
