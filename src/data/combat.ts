import type { Faction } from "./factions";

export interface CombatData {
  /** Frames an attack or dodge press stays queued. */
  inputBuffer: number;
  dodge: {
    duration: number;
    /** Px/s while dashing. */
    speed: number;
    /** Leading frames of the dodge that ignore hits. */
    iframes: number;
    /** Frames from dodge start until another can begin. */
    cooldown: number;
    /** A hit landing in the first N dodge frames counts as perfect. */
    perfectWindow: number;
  };
  block: {
    /** A hit landing in the first N block frames is a parry. */
    perfectWindow: number;
    moveSpeedScale: number;
    /** Min dot(facing, direction to attacker) for a hit to count as frontal. */
    frontDot: number;
    guardMax: number;
    regenDelay: number;
    regenPerTick: number;
    guardBreakStun: number;
    /** Fraction of the attack's knockback a blocker is pushed back. */
    pushbackScale: number;
  };
  hurt: {
    /** Per-tick velocity multiplier for knockback. */
    knockbackDecay: number;
    /** Knockback speed (px/s) under which it snaps to zero. */
    knockbackStop: number;
  };
  parry: {
    staggerFrames: number;
    hitstop: number;
  };
  counter: {
    /** Frames after a perfect dodge or parry in which the next attack is a counter. */
    window: number;
    bonusDamage: boolean;
    damageMultiplier: number;
    stagger: boolean;
    staggerFrames: number;
  };
  meters: {
    spinMax: number;
    perfectDodgeSpinGain: number;
    /** Spin meter gained by an attacker whose hit landed and damaged. */
    spinGainPerHit: number;
  };
  tokens: {
    /** Attack-token capacity in weight units; clamped to `max`. */
    pool: number;
    max: number;
  };
  death: {
    /** Frames a dead entity lingers (fading) before removal. */
    frames: number;
  };
  crowd: {
    /** Mobs closer than this (center to center) push apart. */
    separationRadius: number;
    /** Strength of the push relative to the mob's own steering. */
    separationWeight: number;
  };
  dummy: {
    /** Default for the F2 toggle. */
    scriptedAttack: boolean;
    /** The dummy is neutral until scripted; then it fights as this faction. */
    scriptedFaction: Faction;
    /** Free frames between the end of one swing and the next telegraph. */
    interval: number;
  };
}

export const COMBAT = {
  inputBuffer: 8,
  dodge: {
    duration: 14,
    speed: 170,
    iframes: 9,
    cooldown: 40,
    perfectWindow: 7,
  },
  block: {
    perfectWindow: 7,
    moveSpeedScale: 0.5,
    frontDot: 0,
    guardMax: 60,
    regenDelay: 45,
    regenPerTick: 0.5,
    guardBreakStun: 60,
    pushbackScale: 0.6,
  },
  hurt: {
    knockbackDecay: 0.85,
    knockbackStop: 4,
  },
  parry: {
    staggerFrames: 50,
    hitstop: 6,
  },
  counter: {
    window: 45,
    bonusDamage: true,
    damageMultiplier: 1.75,
    stagger: true,
    staggerFrames: 40,
  },
  meters: {
    spinMax: 100,
    perfectDodgeSpinGain: 12,
    spinGainPerHit: 8,
  },
  tokens: {
    pool: 2,
    max: 3,
  },
  death: {
    frames: 30,
  },
  crowd: {
    separationRadius: 14,
    separationWeight: 1,
  },
  dummy: {
    scriptedAttack: false,
    scriptedFaction: "oni",
    interval: 90,
  },
} as const satisfies CombatData;
