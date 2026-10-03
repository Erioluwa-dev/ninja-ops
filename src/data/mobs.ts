/** One attack a mob can choose; the record key is the attack id. */
export interface MobMoveData {
  /** RNG weight when the target is not spinning. */
  weight: number;
  /** RNG weight when the target is spinning. */
  spinWeight: number;
  /** The move is only a candidate while the target is this far away. */
  pickMinDist: number;
  pickMaxDist: number;
  /** Same meaning as the mob-level fields, for this move. */
  minRange: number;
  maxRange: number;
  alignTolerance: number;
}

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
  /** Drawn as a boss bar on the HUD instead of over the head. */
  bossBar: boolean;
  /**
   * A canon villain can never be reduced below 1 hp by the player, a ghost or
   * the blade (PRD N-8); only a scripted team finisher can end it.
   */
  canonVillain: boolean;
  /**
   * Attacks to pick from by range and target state, keyed by attack id. Without
   * it the mob always uses its kit's first attack.
   */
  moves?: Record<string, MobMoveData>;
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
    bossBar: false,
    canonVillain: false,
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
    bossBar: false,
    canonVillain: false,
  },
  sweeper: {
    kitId: "oniSweeper",
    tokenWeight: 1,
    role: "melee",
    sightRange: 400,
    engageRange: 70,
    holdDistance: 50,
    minRange: 0,
    maxRange: 30,
    alignTolerance: 18,
    circleSpeedScale: 0.6,
    reactionDelay: 40,
    reactionJitter: 30,
    cooldown: 50,
    tokenRetry: 25,
    tokenRetryJitter: 40,
    approachTimeout: 260,
    bossBar: false,
    canonVillain: false,
  },
  oniBrute: {
    kitId: "oniBrute",
    tokenWeight: 2,
    role: "melee",
    sightRange: 400,
    engageRange: 75,
    holdDistance: 55,
    minRange: 0,
    maxRange: 22,
    alignTolerance: 10,
    circleSpeedScale: 0.5,
    reactionDelay: 45,
    reactionJitter: 0,
    cooldown: 50,
    tokenRetry: 25,
    tokenRetryJitter: 40,
    approachTimeout: 360,
    bossBar: true,
    canonVillain: false,
    moves: {
      bruteSmash: {
        weight: 4,
        spinWeight: 1,
        pickMinDist: 0,
        pickMaxDist: 40,
        minRange: 0,
        maxRange: 22,
        alignTolerance: 10,
      },
      bruteSlam: {
        weight: 2,
        spinWeight: 24,
        pickMinDist: 0,
        pickMaxDist: 75,
        minRange: 0,
        maxRange: 24,
        alignTolerance: 24,
      },
      bruteCrush: {
        weight: 3,
        spinWeight: 1,
        pickMinDist: 20,
        pickMaxDist: 75,
        minRange: 0,
        maxRange: 22,
        alignTolerance: 10,
      },
      bruteSweep: {
        weight: 3,
        spinWeight: 1,
        pickMinDist: 10,
        pickMaxDist: 75,
        minRange: 6,
        maxRange: 34,
        alignTolerance: 22,
      },
    },
  },
} as const satisfies Record<string, MobData>;

export type MobTypeId = keyof typeof MOBS;

export interface WaveData {
  spawns: readonly { type: MobTypeId; count: number }[];
}

// Debug waves: F3 spawns the first, F4 the second (a lone brute).
export const WAVES = [
  {
    spawns: [
      { type: "melee", count: 3 },
      { type: "ranged", count: 2 },
      { type: "sweeper", count: 1 },
    ],
  },
  { spawns: [{ type: "oniBrute", count: 1 }] },
] as const satisfies readonly WaveData[];
