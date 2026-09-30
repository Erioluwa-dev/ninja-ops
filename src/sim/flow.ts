import { spawnWave } from "./spawner";
import type { ActionFrame, ArenaFlow, FlowPhase, SimState } from "./types";

export function createFlow(phase: FlowPhase): ArenaFlow {
  return { phase, wave: 0, wavesCleared: 0, phaseTicks: 0, runTicks: 0 };
}

function setPhase(flow: ArenaFlow, phase: FlowPhase): void {
  flow.phase = phase;
  flow.phaseTicks = 0;
}

function mobsCleared(state: SimState): boolean {
  return !state.entities.some((e) => e.kind === "mob" && e.state !== "dead");
}

function beginNext(state: SimState): void {
  const flow = state.arenaFlow;
  const { waves, boss } = state.tuning.flow;
  const wave = waves[flow.wave];
  if (wave) {
    flow.wave += 1;
    setPhase(flow, "wave");
    spawnWave(state, wave);
  } else {
    setPhase(flow, "boss");
    spawnWave(state, boss);
  }
}

/** Clears sandbox leftovers (dummy, debug mobs, hazards) and starts wave 1. */
export function startRun(state: SimState): void {
  const flow = state.arenaFlow;
  state.entities = state.entities.filter((e) => e.kind === "player");
  state.projectiles = [];
  state.hazards = [];
  state.tokens = [];
  flow.wave = 0;
  flow.wavesCleared = 0;
  flow.runTicks = 0;
  beginNext(state);
}

export function canRestart(state: SimState): boolean {
  const { phase, phaseTicks } = state.arenaFlow;
  return (
    (phase === "victory" || phase === "defeat") &&
    phaseTicks >= state.tuning.flow.resultLockFrames
  );
}

/** Runs after the tick's combat so it sees this tick's deaths. */
export function stepFlow(state: SimState, input: ActionFrame): void {
  const flow = state.arenaFlow;
  switch (flow.phase) {
    case "sandbox":
      return;
    case "victory":
    case "defeat":
      flow.phaseTicks += 1;
      return;
    case "intro":
      if (input.attack && !state.prevInput.attack) startRun(state);
      return;
    default:
      break;
  }

  flow.runTicks += 1;
  flow.phaseTicks += 1;
  if (state.defeated) {
    setPhase(flow, "defeat");
    return;
  }
  if (flow.phase === "wave" && mobsCleared(state)) {
    flow.wavesCleared = flow.wave;
    setPhase(flow, "breather");
  } else if (flow.phase === "breather") {
    if (flow.phaseTicks >= state.tuning.flow.breather) beginNext(state);
  } else if (flow.phase === "boss" && mobsCleared(state)) {
    setPhase(flow, "victory");
  }
}
