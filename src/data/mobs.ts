export interface MobData {
  kitId: string;
  /** How much of the shared attack-token pool one attacker of this type uses. */
  tokenWeight: number;
  /** Melee closes in ("chase"); ranged holds a firing lane ("reposition"). */
  role: "melee" | "ranged";
  /** Beyond this a mob ignores its target. */
  sightRange: number;
  /** Inside this a mob asks for a token; outside it just closes in. */
  engageRange: number;
  /** Ring radius a mob without a token circles at. */
  holdDistance: number;
  /** Attack when the distance along the facing axis is within [minRange, maxRange]. */
  minRange: number;
  maxRange: number;
  /** Max sideways offset from the target at which the attack still lines up. */
  alignTolerance: number;
  /** Fraction of move speed while circling. */
  circleSpeedScale: number;
  /** Frames after spawning before the first decision. */
  reactionDelay: number;
  reactionJitter: number;
  /** Frames of standing off after an attack or stun before deciding again. */
  cooldown: number;
  /** Frames between token requests, plus a random extra up to the jitter. */
  tokenRetry: number;
  tokenRetryJitter: number;
  /** A token holder that has not started its attack by then gives it back. */
  approachTimeout: number;
}

export const MOBS = {
  melee: {
    kitId: "oniGrunt",
    tokenWeight: 1,
    role: "melee",
    sightRange: 400,
    engageRange: 60,
    holdDistance: 42,
    minRange: 0,
    maxRange: 16,
    alignTolerance: 6,
    circleSpeedScale: 0.6,
    reactionDelay: 30,
    reactionJitter: 30,
    cooldown: 40,
    tokenRetry: 20,
    tokenRetryJitter: 40,
    approachTimeout: 240,
  },
  ranged: {
    kitId: "oniArcher",
    tokenWeight: 1,
    role: "ranged",
    sightRange: 400,
    engageRange: 130,
    holdDistance: 90,
    minRange: 55,
    maxRange: 120,
    alignTolerance: 4,
    circleSpeedScale: 0.6,
    reactionDelay: 45,
    reactionJitter: 30,
    cooldown: 60,
    tokenRetry: 30,
    tokenRetryJitter: 50,
    approachTimeout: 300,
  },
} as const satisfies Record<string, MobData>;

export type MobTypeId = keyof typeof MOBS;

export interface WaveData {
  spawns: readonly { type: MobTypeId; count: number }[];
}

// The debug wave spawned by F3.
export const WAVES = [
  {
    spawns: [
      { type: "melee", count: 3 },
      { type: "ranged", count: 2 },
    ],
  },
] as const satisfies readonly WaveData[];
