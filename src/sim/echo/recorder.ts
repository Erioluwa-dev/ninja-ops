import type { EchoMoveId } from "../../data/echo";
import type { Tuning } from "../../data/tuning";
import type { ActionFrame, EchoFrame, EchoState, Entity } from "../types";

export const IDLE_FRAME: ActionFrame = {
  moveX: 0,
  moveY: 0,
  attack: false,
  dodge: false,
  block: false,
  jump: false,
  spin: false,
  pause: false,
};

export function createEchoState(
  tuning: Tuning,
  unlocked: readonly EchoMoveId[],
): EchoState {
  return {
    buffer: [],
    resonance: 0,
    hitCount: 0,
    unlocked: [...unlocked],
    ghostLimit: tuning.echo.ghostLimit,
    twinStrikeFlicker: false,
    pending: [],
    rewindUntil: -1,
    wasDodging: false,
    wasFinisher: false,
    stillFrames: 0,
  };
}

/** Appends this tick's input and the feet position before it runs, dropping the oldest past the cap. */
export function recordFrame(
  echo: EchoState,
  tuning: Tuning,
  tick: number,
  player: Entity,
  input: ActionFrame,
): void {
  echo.buffer.push({
    tick,
    input: { ...input },
    pos: { x: player.pos.x, y: player.pos.y },
  });
  const excess = echo.buffer.length - tuning.echo.bufferFrames;
  if (excess > 0) echo.buffer.splice(0, excess);
}

export function frameAt(echo: EchoState, tick: number): EchoFrame | undefined {
  return echo.buffer.find((f) => f.tick === tick);
}
