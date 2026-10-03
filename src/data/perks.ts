import { ECHO } from "./echo";

/**
 * Trust tiers (PRD Q5 default): the meter runs 0-10 and a perk step unlocks at
 * each threshold. Only the first step of each perk is defined in the Bible, so
 * the second threshold is recorded but changes nothing yet.
 */
export const TRUST_TIERS = [3, 6] as const;

export const TRUST_PERKS = {
  /** Kai adds a fire flicker to Twin Strike's ghost (Bible §1.2). */
  kai: { twinStrikeFlicker: true },
  /**
   * Jay: a shorter Rewind Step window (the owner's suggestion, Bible §1.2).
   * The Bible does not say how much shorter, so this is a placeholder to tune.
   */
  jay: { rewindWindowFrames: ECHO.rewindStep.windowFrames - 15 },
} as const;
