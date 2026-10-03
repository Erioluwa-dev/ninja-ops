/**
 * The Hollow Edge's corruption meter (Bible §2.1, PRD B-3 to B-5). Chapter 1
 * only lowers it; the thresholds are here so later chapters change data, not code.
 */
export const BLADE = {
  /** Lower bound of each tier; the meter runs 0-100. */
  thresholds: {
    /** The blade hums audibly and some NPCs avoid the player. */
    hum: 25,
    /** Enemies mark the player first. */
    marked: 50,
    /** The ghost sometimes acts on its own. */
    ghostActs: 75,
    /** Forced stagger and a chapter story consequence. */
    stagger: 100,
  },
} as const;

export type CorruptionTier = "none" | keyof typeof BLADE.thresholds;
