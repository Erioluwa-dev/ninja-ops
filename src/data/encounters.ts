import type { WaveData } from "./mobs";

/** A static damage zone of an enemy faction: the dungeon's trap tiles. */
export interface TrapData {
  col: number;
  row: number;
  /** Half-extent of the square zone, px. */
  radius: number;
  damage: number;
}

export interface EncounterData {
  /** Waves in order; the boss, if any, follows the last. */
  waves: readonly WaveData[];
  /** No spawns means the fight ends with the last wave. */
  boss: WaveData;
  traps: readonly TrapData[];
  /** Whether the ninja the player picked at `ch1_s5` fights beside them. */
  guardAlly: boolean;
}

const NO_BOSS: WaveData = { spawns: [] };

/**
 * Story fights, keyed by the id a `combat` step names. They reuse the arena's
 * wave format, so a wave here is the same data as one in the sandbox flow.
 */
export const ENCOUNTERS = {
  // ch1_s1: Wu's drills. Movement, the combo and block against slow targets.
  ch1_tutorial: {
    waves: [{ spawns: [{ type: "drillDummy", count: 2 }] }],
    boss: NO_BOSS,
    traps: [],
    guardAlly: false,
  },
  // ch1_s3: the short village defence that teaches Decoy Veil.
  ch1_village: {
    waves: [
      { spawns: [{ type: "skulkinGrunt", count: 3 }] },
      { spawns: [{ type: "skulkinGrunt", count: 4 }] },
    ],
    boss: NO_BOSS,
    traps: [],
    guardAlly: false,
  },
  // ch1_s4: trap tiles between the player and the Skulkin; teaches Rewind Step.
  ch1_dungeon: {
    waves: [
      { spawns: [{ type: "skulkinGrunt", count: 3 }] },
      { spawns: [{ type: "skulkinGrunt", count: 4 }] },
    ],
    boss: NO_BOSS,
    traps: [
      { col: 5, row: 2, radius: 7, damage: 6 },
      { col: 5, row: 7, radius: 7, damage: 6 },
      { col: 9, row: 4, radius: 7, damage: 6 },
      { col: 9, row: 6, radius: 7, damage: 6 },
    ],
    guardAlly: false,
  },
  // ch1_s7: the Skulkin General. The team, not the player, ends it.
  ch1_boss: {
    waves: [],
    boss: { spawns: [{ type: "skulkinGeneral", count: 1 }] },
    traps: [],
    guardAlly: true,
  },
} as const satisfies Record<string, EncounterData>;

export type EncounterId = keyof typeof ENCOUNTERS;

export function isEncounterId(id: string): id is EncounterId {
  return id in ENCOUNTERS;
}
