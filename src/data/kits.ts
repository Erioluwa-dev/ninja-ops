export interface KitData {
  /** Pixels per second at full stick deflection. */
  moveSpeed: number;
  feet: { w: number; h: number };
  bodyHeight: number;
  maxHp: number;
  /** Damage never takes hp below this; 1 keeps a training dummy alive. */
  hpFloor: number;
  /** Frames after damage before hp regenerates. */
  regenDelay: number;
  regenPerTick: number;
  hurtStun: number;
  /** Frames of invulnerability after being hit; 0 lets combos chain. */
  hurtIframes: number;
  /** Attack ids in combo order. */
  comboAttacks: readonly string[];
}

export const KITS = {
  ninja: {
    moveSpeed: 60,
    feet: { w: 10, h: 6 },
    bodyHeight: 20,
    maxHp: 100,
    hpFloor: 0,
    regenDelay: 0,
    regenPerTick: 0,
    hurtStun: 18,
    hurtIframes: 45,
    comboAttacks: ["ninjaHit1", "ninjaHit2", "ninjaHit3"],
  },
  dummy: {
    moveSpeed: 0,
    feet: { w: 12, h: 8 },
    bodyHeight: 22,
    maxHp: 100,
    hpFloor: 1,
    regenDelay: 90,
    regenPerTick: 1,
    hurtStun: 14,
    hurtIframes: 0,
    comboAttacks: ["dummySwing"],
  },
} as const satisfies Record<string, KitData>;

export type KitId = keyof typeof KITS;
