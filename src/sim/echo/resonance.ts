import type { SimState } from "../types";

export function gainPips(state: SimState, pips: number): void {
  const { echo, tuning } = state;
  echo.resonance = Math.min(tuning.echo.maxPips, echo.resonance + pips);
}

export function canSpend(state: SimState, pips: number): boolean {
  return state.echo.resonance >= pips;
}

export function spendPips(state: SimState, pips: number): void {
  state.echo.resonance = Math.max(0, state.echo.resonance - pips);
}

/** Every landed player hit counts; each `hitsPerPip`-th pays a pip. */
export function registerLandedHit(state: SimState): void {
  const { echo, tuning } = state;
  echo.hitCount += 1;
  if (echo.hitCount >= tuning.echo.gain.hitsPerPip) {
    echo.hitCount = 0;
    gainPips(state, 1);
  }
}

export function onPerfectDodge(state: SimState): void {
  gainPips(state, state.tuning.echo.gain.perfectDodge);
}

/** An enemy hit on a ghost dissolves it and costs the player resonance. */
export function onGhostHit(state: SimState): void {
  spendPips(state, state.tuning.echo.dissolvePipLoss);
}
