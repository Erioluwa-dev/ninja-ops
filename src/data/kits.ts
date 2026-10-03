import type { HitData } from "./attacks";

/**
 * A data-driven hook run by the sim; `id` selects a handler registered in
 * src/sim/spin.ts, so an element is a data entry plus a handler.
 */
export interface SpinModifierData {
  id: string;
  params: Readonly<Record<string, number>>;
}

export interface SpinData {
  /** Spin cannot start below this much meter. */
  minMeter: number;
  drainPerTick: number;
  /** Fraction of walking speed while spinning. */
  moveSpeedScale: number;
  /** Frames before the same target can be hit by the spin again. */
  hitInterval: number;
  /** Half-extent of the square hit area around the feet. */
  radius: number;
  hit: HitData;
  /** Hostile projectiles touching the spin are sent straight back. */
  deflect: boolean;
  dizzy: {
    base: number;
    /** Extra dizzy frames per second spent spinning. */
    perSecond: number;
    max: number;
  };
  /** Run every spinning tick. */
  onSpinTick: readonly SpinModifierData[];
  /** Run once when the spin ends by release or an empty meter. */
  onSpinEnd: readonly SpinModifierData[];
}

export interface JumpData {
  /** Frames from takeoff to touchdown; the arc is a parabola over this span. */
  frames: number;
  /** Height in px above the ground plane at the top of the arc. */
  peakHeight: number;
  /** Frames of helplessness after touchdown. */
  landingRecovery: number;
  /** Fraction of walking speed while in the air. */
  airSteerScale: number;
}

/** Super armor: damage reduction plus immunity to knockback and hurt interruption. */
export interface ArmorData {
  /** Damage multiplier while the holder is in an attack's startup or active frames. */
  attackDamageScale: number;
  /** Damage multiplier against spin hits, at all times. */
  spinDamageScale: number;
}

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
  /** Whether a corpse leaves the arena; a defeated player stays for the result. */
  removeOnDeath: boolean;
  /** The kit's signature move; null means the entity cannot spin. */
  spin: SpinData | null;
  /** Null means the entity cannot jump. */
  jump: JumpData | null;
  /** Null means every hit interrupts. */
  armor: ArmorData | null;
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
    removeOnDeath: false,
    spin: {
      minMeter: 20,
      drainPerTick: 0.5,
      moveSpeedScale: 0.55,
      hitInterval: 8,
      radius: 22,
      hit: {
        damage: 5,
        guardDamage: 8,
        knockback: 110,
        hitstop: 2,
        unblockable: false,
      },
      deflect: true,
      dizzy: { base: 30, perSecond: 30, max: 150 },
      onSpinTick: [],
      onSpinEnd: [],
    },
    jump: {
      frames: 34,
      peakHeight: 24,
      landingRecovery: 8,
      airSteerScale: 0.7,
    },
    armor: null,
  },
  // The Echo ghost: one hit dissolves it, and it never spins (Echo Spin comes later).
  echoGhost: {
    moveSpeed: 60,
    feet: { w: 10, h: 6 },
    bodyHeight: 20,
    maxHp: 1,
    hpFloor: 0,
    regenDelay: 0,
    regenPerTick: 0,
    hurtStun: 18,
    hurtIframes: 0,
    comboAttacks: ["ninjaHit1", "ninjaHit2", "ninjaHit3"],
    removeOnDeath: true,
    spin: null,
    jump: {
      frames: 34,
      peakHeight: 24,
      landingRecovery: 8,
      airSteerScale: 0.7,
    },
    armor: null,
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
    removeOnDeath: false,
    spin: null,
    jump: null,
    armor: null,
  },
  oniGrunt: {
    moveSpeed: 40,
    feet: { w: 10, h: 6 },
    bodyHeight: 20,
    maxHp: 20,
    hpFloor: 0,
    regenDelay: 0,
    regenPerTick: 0,
    hurtStun: 16,
    hurtIframes: 0,
    comboAttacks: ["oniSlash"],
    removeOnDeath: true,
    spin: null,
    jump: null,
    armor: null,
  },
  oniArcher: {
    moveSpeed: 34,
    feet: { w: 10, h: 6 },
    bodyHeight: 20,
    maxHp: 12,
    hpFloor: 0,
    regenDelay: 0,
    regenPerTick: 0,
    hurtStun: 16,
    hurtIframes: 0,
    comboAttacks: ["oniBolt"],
    removeOnDeath: true,
    spin: null,
    jump: null,
    armor: null,
  },
  oniSweeper: {
    moveSpeed: 36,
    feet: { w: 10, h: 6 },
    bodyHeight: 20,
    maxHp: 28,
    hpFloor: 0,
    regenDelay: 0,
    regenPerTick: 0,
    hurtStun: 16,
    hurtIframes: 0,
    comboAttacks: ["sweeperSweep"],
    removeOnDeath: true,
    spin: null,
    jump: null,
    armor: null,
  },
  oniBrute: {
    moveSpeed: 26,
    feet: { w: 14, h: 8 },
    bodyHeight: 30,
    maxHp: 320,
    hpFloor: 0,
    regenDelay: 0,
    regenPerTick: 0,
    hurtStun: 12,
    hurtIframes: 0,
    comboAttacks: ["bruteSmash", "bruteSlam", "bruteCrush", "bruteSweep"],
    removeOnDeath: true,
    spin: null,
    jump: null,
    armor: { attackDamageScale: 0.5, spinDamageScale: 0.35 },
  },
} as const satisfies Record<string, KitData>;

export type KitId = keyof typeof KITS;
