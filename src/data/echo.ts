/** Every Echo number lives here (PRD E-8); frames are sim ticks at 60 Hz. */
export const ECHO_MOVE_IDS = [
  "afterstep",
  "rewindStep",
  "twinStrike",
  "decoyVeil",
] as const;
export type EchoMoveId = (typeof ECHO_MOVE_IDS)[number];

export interface EchoData {
  /** Input frames kept for replay: 1.5 s. */
  bufferFrames: number;
  /** How long after the player a ghost repeats an action: 0.5 s. */
  ghostDelayFrames: number;
  /** Resonance capacity in pips. */
  maxPips: number;
  /** Ghosts alive at once; a newer one replaces the oldest. */
  ghostLimit: number;
  /** Fraction of the player's damage a ghost deals. */
  ghostDamageScale: number;
  gain: {
    perfectDodge: number;
    /** Landed hits that earn one pip. */
    hitsPerPip: number;
  };
  /** Pips lost when an enemy hits a ghost and it dissolves. */
  dissolvePipLoss: number;
  afterstep: {
    cost: number;
    /** The ghost repeats the dash this long after it started: 0.4 s. */
    delayFrames: number;
    /** Input frames the ghost replays; the dash's own length. */
    replayFrames: number;
    /** How long the ghost stays once it has appeared. */
    lingerFrames: number;
  };
  rewindStep: {
    cost: number;
    /** A second dodge press this soon after Afterstep snaps to the ghost: 1 s. */
    windowFrames: number;
  };
  twinStrike: {
    cost: number;
    /** Must outlast the finisher's own frames. */
    lingerFrames: number;
  };
  decoyVeil: {
    cost: number;
    /** Standing still this long raises the ghost: 1 s. */
    standStillFrames: number;
    /** Enemies prefer the ghost for this long: 3 s. */
    tauntFrames: number;
  };
}

export const ECHO = {
  bufferFrames: 90,
  ghostDelayFrames: 30,
  maxPips: 4,
  ghostLimit: 1,
  ghostDamageScale: 0.5,
  // PRD Q4 default.
  gain: { perfectDodge: 1, hitsPerPip: 3 },
  dissolvePipLoss: 1,
  afterstep: { cost: 0, delayFrames: 24, replayFrames: 14, lingerFrames: 45 },
  rewindStep: { cost: 1, windowFrames: 60 },
  twinStrike: { cost: 0, lingerFrames: 40 },
  decoyVeil: { cost: 0, standStillFrames: 60, tauntFrames: 180 },
} as const satisfies EchoData;
