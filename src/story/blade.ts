import { BLADE, type CorruptionTier } from "../data/blade";

/** The highest corruption threshold reached, or "none" below the first. */
export function corruptionTier(corruption: number): CorruptionTier {
  const { thresholds } = BLADE;
  if (corruption >= thresholds.stagger) return "stagger";
  if (corruption >= thresholds.ghostActs) return "ghostActs";
  if (corruption >= thresholds.marked) return "marked";
  if (corruption >= thresholds.hum) return "hum";
  return "none";
}
