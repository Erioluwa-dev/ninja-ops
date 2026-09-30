import { describe, expect, it } from "vitest";
import { FLOW } from "../data/flow";
import { createTuning, type Tuning } from "../data/tuning";
import { canRestart } from "./flow";
import { deriveSeed } from "./rng";
import { enterDead } from "./states";
import { createSim, restartSim, step } from "./step";
import { entityOfKind, forceAttack, idleInput } from "./testing";
import type { Entity, SimState } from "./types";

function inertTuning(): Tuning {
  const tuning = createTuning();
  for (const mob of Object.values(tuning.mobs)) mob.reactionDelay = 1_000_000;
  return tuning;
}

const mobs = (state: SimState): Entity[] =>
  state.entities.filter((e) => e.kind === "mob");

function run(state: SimState, ticks: number, input = idleInput()): void {
  for (let t = 0; t < ticks; t++) step(state, input);
}

function killMob(m: Entity): void {
  m.hp = 0;
  m.state = "dead";
  m.combat.stun = 0;
}

describe("arena flow", () => {
  it("stays inert in sandbox so debug play and scripted scenarios are untouched", () => {
    const state = createSim({ seed: 1 });
    run(state, 5, idleInput({ attack: true }));
    run(state, 5);
    expect(state.arenaFlow.phase).toBe("sandbox");
    expect(mobs(state)).toHaveLength(0);
    expect(state.entities.some((e) => e.kind === "dummy")).toBe(true);
  });

  it("waits in the intro for an attack press, then clears the dummy and starts wave 1", () => {
    const state = createSim({ seed: 1, mode: "intro", tuning: inertTuning() });
    run(state, 30);
    expect(state.arenaFlow.phase).toBe("intro");
    expect(mobs(state)).toHaveLength(0);
    run(state, 1, idleInput({ attack: true }));
    expect(state.arenaFlow.phase).toBe("wave");
    expect(state.arenaFlow.wave).toBe(1);
    expect(state.entities.some((e) => e.kind === "dummy")).toBe(false);
    const first = FLOW.waves[0].spawns.reduce((n, s) => n + s.count, 0);
    expect(mobs(state)).toHaveLength(first);
  });

  it("advances through every wave and the boss to victory", () => {
    const state = createSim({ seed: 2, mode: "run", tuning: inertTuning() });
    const { breather } = state.tuning.flow;
    expect(state.arenaFlow.phase).toBe("wave");

    for (let n = 1; n <= FLOW.waves.length; n++) {
      expect(state.arenaFlow.wave).toBe(n);
      const expected = FLOW.waves[n - 1]?.spawns.reduce(
        (sum, s) => sum + s.count,
        0,
      );
      expect(mobs(state)).toHaveLength(expected ?? -1);
      run(state, 10);
      expect(state.arenaFlow.phase).toBe("wave");
      for (const m of mobs(state)) killMob(m);
      run(state, 1);
      expect(state.arenaFlow.phase).toBe("breather");
      expect(state.arenaFlow.wavesCleared).toBe(n);
      run(state, breather - 1);
      expect(state.arenaFlow.phase).toBe("breather");
      run(state, 1);
    }

    expect(state.arenaFlow.phase).toBe("boss");
    expect(mobs(state).map((m) => m.mobType)).toEqual(["oniBrute"]);
    for (const m of mobs(state)) killMob(m);
    run(state, 1);
    expect(state.arenaFlow.phase).toBe("victory");
    expect(state.arenaFlow.wavesCleared).toBe(FLOW.waves.length);
    expect(state.arenaFlow.runTicks).toBeGreaterThan(breather);
  });

  it("does not advance while a wave still has living mobs", () => {
    const state = createSim({ seed: 2, mode: "run", tuning: inertTuning() });
    for (const m of mobs(state).slice(1)) killMob(m);
    run(state, 200);
    expect(state.arenaFlow.phase).toBe("wave");
  });

  it("ends in defeat when the player dies and freezes the run clock", () => {
    const state = createSim({ seed: 3, mode: "run", tuning: inertTuning() });
    run(state, 20);
    const player = entityOfKind(state, "player");
    player.hp = 0;
    enterDead(player, state.tuning);
    run(state, 1);
    expect(state.arenaFlow.phase).toBe("defeat");
    const ticks = state.arenaFlow.runTicks;
    run(state, 30);
    expect(state.arenaFlow.runTicks).toBe(ticks);
  });

  it("only accepts a restart after the result lock", () => {
    const state = createSim({ seed: 3, mode: "run", tuning: inertTuning() });
    const player = entityOfKind(state, "player");
    expect(canRestart(state)).toBe(false);
    player.hp = 0;
    enterDead(player, state.tuning);
    run(state, 2);
    expect(canRestart(state)).toBe(false);
    run(state, state.tuning.flow.resultLockFrames);
    expect(canRestart(state)).toBe(true);
  });

  it("counts damaging hits taken for the summary", () => {
    const state = createSim({ seed: 4, mode: "run", tuning: inertTuning() });
    const player = entityOfKind(state, "player");
    const mob = mobs(state)[0];
    if (!mob) throw new Error("expected a mob");
    mob.pos = { x: player.pos.x + 12, y: player.pos.y };
    forceAttack(mob, "oniSlash", { x: -1, y: 0 });
    run(state, 40);
    expect(player.combat.hitsTaken).toBe(1);
  });
});

describe("restart", () => {
  it("matches a fresh sim from that seed and keeps the live tuning", () => {
    const first = createSim({ seed: 9, mode: "run", element: "earth" });
    first.tuning.combat.dodge.duration = 99;
    run(first, 120, idleInput({ moveX: 1 }));

    const seed = deriveSeed(9, 1);
    const again = restartSim(first, seed, "run");
    const fresh = createSim({
      seed,
      tuning: first.tuning,
      mode: "run",
      element: "earth",
    });
    expect(again.tuning).toBe(first.tuning);
    expect(again.tuning.combat.dodge.duration).toBe(99);
    expect(JSON.stringify(again)).toBe(JSON.stringify(fresh));
    expect(again.tick).toBe(0);
    expect(entityOfKind(again, "player").element).toBe("earth");
  });

  it("plays out identically when the same seed is restarted twice", () => {
    const first = createSim({ seed: 9, mode: "run" });
    const a = restartSim(first, deriveSeed(9, 2), "run");
    const b = restartSim(first, deriveSeed(9, 2), "run");
    run(a, 200);
    run(b, 200);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(deriveSeed(9, 2)).not.toBe(deriveSeed(9, 3));
  });

  it("returns to sandbox or the intro on request", () => {
    const first = createSim({ seed: 9, mode: "run" });
    expect(restartSim(first, 1, "sandbox").arenaFlow.phase).toBe("sandbox");
    expect(restartSim(first, 1, "intro").arenaFlow.phase).toBe("intro");
  });
});
