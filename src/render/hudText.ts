import { type FlowPhase, SIM_HZ } from "../sim";

/**
 * The words and widths the HUD shows, as pure functions of sim values. The pack's
 * 8x8 font is drawn in capitals, so every string here is already upper case.
 */

export const INTRO_TITLE = "NINJA OPS";
export const INTRO_BODY = "ATTACK  START THE RUN\nF5  ELEMENT   F6  SANDBOX";

/** "oniBrute" -> "ONI BRUTE": the kit id is the only name the sim carries. */
export function bossName(kitId: string): string {
  return kitId.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
}

/** Width in px of a bar's fill, clamped so a stray value never spills the frame. */
export function meterWidth(value: number, max: number, width: number): number {
  if (max <= 0) return 0;
  return Math.round(width * Math.min(1, Math.max(0, value / max)));
}

export function waveLabel(
  phase: FlowPhase,
  wave: number,
  total: number,
): string {
  switch (phase) {
    case "sandbox":
      return "SANDBOX";
    case "wave":
    case "breather":
      return `WAVE ${wave}/${total}`;
    case "boss":
      return "BOSS";
    default:
      return "";
  }
}

/** The big banner that opens a phase; empty once `bannerFrames` have passed. */
export function bannerText(
  phase: FlowPhase,
  wave: number,
  phaseTicks: number,
  bannerFrames: number,
): string {
  if (phaseTicks >= bannerFrames) return "";
  switch (phase) {
    case "wave":
      return `WAVE ${wave}`;
    case "boss":
      return "BOSS";
    case "breather":
      return `WAVE ${wave} CLEAR`;
    default:
      return "";
  }
}

export interface RunResult {
  won: boolean;
  wavesCleared: number;
  totalWaves: number;
  runTicks: number;
  hitsTaken: number;
  canRestart: boolean;
  /** False for a story fight that ends with its last wave; defaults to true. */
  hasBoss?: boolean;
  /** What the attack button does from the result panel; defaults to RESTART. */
  action?: string;
}

export function resultTitle(won: boolean): string {
  return won ? "VICTORY" : "DEFEATED";
}

export function resultBody(r: RunResult): string {
  const boss = r.won && (r.hasBoss ?? true) ? " + BOSS" : "";
  const cleared = `${r.wavesCleared}/${r.totalWaves}${boss}`;
  const seconds = (r.runTicks / SIM_HZ).toFixed(1);
  return [
    `WAVES CLEARED  ${cleared}`,
    `TIME  ${seconds}S`,
    `HITS TAKEN  ${r.hitsTaken}`,
    "",
    r.canRestart ? `ATTACK  ${r.action ?? "RESTART"}` : "",
  ].join("\n");
}

export function lineCount(text: string): number {
  return text.split("\n").length;
}
