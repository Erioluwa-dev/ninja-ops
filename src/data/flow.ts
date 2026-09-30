import type { WaveData } from "./mobs";

export interface FlowData {
  /** Mob waves in order; the boss follows the last one. */
  waves: readonly WaveData[];
  boss: WaveData;
  /** Frames the "WAVE n" / "BOSS" banner stays up after a wave starts. */
  bannerFrames: number;
  /** Quiet frames between a cleared wave and the next. */
  breather: number;
  /** Frames after a result appears before restart is accepted, so a mashed attack can't skip it. */
  resultLockFrames: number;
}

export const FLOW = {
  waves: [
    { spawns: [{ type: "melee", count: 3 }] },
    {
      spawns: [
        { type: "melee", count: 3 },
        { type: "ranged", count: 2 },
      ],
    },
    {
      spawns: [
        { type: "melee", count: 2 },
        { type: "ranged", count: 2 },
        { type: "sweeper", count: 2 },
      ],
    },
  ],
  boss: { spawns: [{ type: "oniBrute", count: 1 }] },
  bannerFrames: 90,
  breather: 150,
  resultLockFrames: 60,
} as const satisfies FlowData;
