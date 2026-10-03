import { isHostile } from "../data/factions";
import { applyTeamFinisher } from "./finisher";
import { spawnWave } from "./spawner";
import { enterStun } from "./states";
import type { ActionFrame, ArenaFlow, FlowPhase, SimState } from "./types";

export function createFlow(phase: FlowPhase): ArenaFlow {
  return {
    phase,
    wave: 0,
    wavesCleared: 0,
    phaseTicks: 0,
    runTicks: 0,
    finishers: {},
  };
}

function setPhase(flow: ArenaFlow, phase: FlowPhase): void {
  flow.phase = phase;
  flow.phaseTicks = 0;
}

// Allies are mobs too; only the player's enemies hold the fight open.
function mobsCleared(state: SimState): boolean {
  return !state.entities.some(
    (e) =>
      e.kind === "mob" && e.state !== "dead" && isHostile("ninja", e.faction),
  );
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
  flow.finishers = {};
  beginNext(state);
}

export function canRestart(state: SimState): boolean {
  const { phase, phaseTicks } = state.arenaFlow;
  return (
    (phase === "victory" || phase === "defeat") &&
    phaseTicks >= state.tuning.flow.resultLockFrames
  );
}

/**
 * A canon villain cannot be killed by the player's side, so once it is down to
 * its floor it staggers and, after a beat, the team lands the finishing blow.
 */
function stepFinishers(state: SimState): void {
  const { finishers } = state.arenaFlow;
  const delay = state.tuning.flow.finisherDelay;
  for (const e of state.entities) {
    if (!e.canonVillain || e.state === "dead" || e.hp > 1) continue;
    const left = finishers[e.id];
    if (left === undefined) {
      enterStun(e, "stagger", delay);
      finishers[e.id] = delay;
    } else if (left <= 1) {
      applyTeamFinisher(state, e);
      delete finishers[e.id];
    } else {
      finishers[e.id] = left - 1;
    }
  }
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
  stepFinishers(state);
  if (state.defeated) {
    setPhase(flow, "defeat");
    return;
  }
  if (flow.phase === "wave" && mobsCleared(state)) {
    flow.wavesCleared = flow.wave;
    const { waves, boss } = state.tuning.flow;
    const more = flow.wave < waves.length || boss.spawns.length > 0;
    setPhase(flow, more ? "breather" : "victory");
  } else if (flow.phase === "breather") {
    if (flow.phaseTicks >= state.tuning.flow.breather) beginNext(state);
  } else if (flow.phase === "boss" && mobsCleared(state)) {
    setPhase(flow, "victory");
  }
}
