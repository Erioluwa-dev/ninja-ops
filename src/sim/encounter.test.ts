import { describe, expect, it } from "vitest";
import { ENCOUNTERS, type EncounterId } from "../data/encounters";
import { createTuning } from "../data/tuning";
import { createEncounterSim, type EncounterContext } from "./encounter";
import { step } from "./step";
import { entityOfKind, idleInput } from "./testing";
import type { Entity, SimState } from "./types";

const CONTEXT: EncounterContext = {
  echoMoves: ["afterstep", "twinStrike", "decoyVeil", "rewindStep"],
  resonance: 0,
  ghostLimit: 1,
  allyMobTypes: [],
  twinStrikeFlicker: false,
  rewindWindowFrames: 60,
};

function sim(
  encounter: EncounterId,
  context: Partial<EncounterContext> = {},
  tune: (t: ReturnType<typeof createTuning>) => void = () => {},
): SimState {
  const tuning = createTuning();
  tune(tuning);
  return createEncounterSim({
    encounter,
    seed: 11,
    context: { ...CONTEXT, ...context },
    tuning,
  });
}

const run = (state: SimState, ticks: number, input = idleInput()): void => {
  for (let t = 0; t < ticks; t++) step(state, input);
};

const mobsOf = (state: SimState, type: string): Entity[] =>
  state.entities.filter((e) => e.mobType === type);

// Keeps the player alive and the enemies still, so a fight is only what the test makes it.
function calm(state: SimState): void {
  const player = entityOfKind(state, "player");
  player.hp = 1_000_000;
  player.maxHp = 1_000_000;
}

describe("encounters", () => {
  it("starts every encounter in the phase its data implies", () => {
    for (const id of Object.keys(ENCOUNTERS) as EncounterId[]) {
      const state = sim(id);
      const data = ENCOUNTERS[id];
      expect(state.arenaFlow.phase).toBe(data.waves.length ? "wave" : "boss");
      expect(state.entities.some((e) => e.kind === "mob")).toBe(true);
    }
  });

  it("carries the story's Echo state into the fight", () => {
    const state = sim("ch1_village", {
      echoMoves: ["afterstep"],
      resonance: 3,
      ghostLimit: 2,
      twinStrikeFlicker: true,
      rewindWindowFrames: 45,
    });
    expect(state.echo.unlocked).toEqual(["afterstep"]);
    expect(state.echo.resonance).toBe(3);
    expect(state.echo.ghostLimit).toBe(2);
    expect(state.echo.twinStrikeFlicker).toBe(true);
    expect(state.tuning.echo.rewindStep.windowFrames).toBe(45);
  });

  it("ends a bossless encounter in victory when its last wave falls", () => {
    const state = sim("ch1_tutorial");
    for (const mob of mobsOf(state, "drillDummy")) mob.hp = 0.5;
    // A breakable target: one hit finishes it.
    const player = entityOfKind(state, "player");
    for (const mob of mobsOf(state, "drillDummy")) {
      mob.pos = { x: player.pos.x + 14, y: player.pos.y };
    }
    for (let i = 0; i < 40 && state.arenaFlow.phase !== "victory"; i++) {
      run(state, 6, idleInput({ attack: true }));
      run(state, 6);
    }
    expect(state.arenaFlow.phase).toBe("victory");
  });
});

describe("traps", () => {
  it("hurt the player standing on one, and not the Skulkin", () => {
    const state = sim("ch1_dungeon");
    const player = entityOfKind(state, "player");
    const trap = state.hazards[0];
    if (!trap) throw new Error("dungeon has no traps");
    expect(state.hazards).toHaveLength(ENCOUNTERS.ch1_dungeon.traps.length);
    player.pos = { ...trap.pos };
    const grunt = mobsOf(state, "skulkinGrunt")[0];
    if (!grunt) throw new Error("no grunt");
    grunt.pos = { ...trap.pos };
    const before = { player: player.hp, grunt: grunt.hp };
    run(state, 5);
    expect(player.hp).toBeLessThan(before.player);
    expect(grunt.hp).toBe(before.grunt);
  });

  it("do not expire during a fight", () => {
    const state = sim("ch1_dungeon");
    calm(state);
    run(state, 600);
    expect(state.hazards).toHaveLength(ENCOUNTERS.ch1_dungeon.traps.length);
  });
});

describe("allies", () => {
  it("fight on the player's side without holding the fight open", () => {
    const state = sim("ch1_village", { allyMobTypes: ["allyKai"] });
    const ally = mobsOf(state, "allyKai")[0];
    expect(ally?.faction).toBe("ninja");
    for (const grunt of mobsOf(state, "skulkinGrunt")) grunt.state = "dead";
    run(state, 2);
    expect(state.arenaFlow.phase).toBe("breather");
  });

  it("attack the Skulkin", () => {
    const state = sim("ch1_village", { allyMobTypes: ["allyKai"] });
    calm(state);
    const ally = mobsOf(state, "allyKai")[0];
    const grunt = mobsOf(state, "skulkinGrunt")[0];
    if (!ally || !grunt) throw new Error("missing fighters");
    ally.pos = { x: 100, y: 60 };
    grunt.pos = { x: 116, y: 60 };
    const start = grunt.hp;
    run(state, 400);
    expect(grunt.hp < start || grunt.state === "dead").toBe(true);
  });
});

describe("the Skulkin General", () => {
  // Every swing from the player's side is huge, so only the invariant can save him.
  const huge = (t: ReturnType<typeof createTuning>): void => {
    for (const attack of Object.values(t.attacks)) {
      if (attack.damage < 100) attack.damage = attack.damage > 0 ? 100_000 : 0;
    }
    const general = t.mobs.skulkinGeneral;
    if (general) general.reactionDelay = 1_000_000;
  };

  function boss(
    allies: string[] = [],
    finisherDelay?: number,
  ): {
    state: SimState;
    general: Entity;
    player: Entity;
  } {
    const state = sim("ch1_boss", { allyMobTypes: allies }, (t) => {
      huge(t);
      if (finisherDelay !== undefined) t.flow.finisherDelay = finisherDelay;
    });
    calm(state);
    const general = mobsOf(state, "skulkinGeneral")[0];
    if (!general) throw new Error("no general");
    const player = entityOfKind(state, "player");
    general.pos = { x: player.pos.x + 16, y: player.pos.y };
    general.canonVillain = true;
    return { state, general, player };
  }

  it("is a canon villain with a boss bar", () => {
    const { general, state } = boss();
    expect(general.canonVillain).toBe(true);
    expect(state.tuning.mobs.skulkinGeneral?.bossBar).toBe(true);
  });

  it("cannot be killed by the player however hard they hit", () => {
    // The finisher is held off, so nothing but the player's own blows act on him.
    const { state, general } = boss([], 1_000_000);
    let lowest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 60; i++) {
      run(state, 4, idleInput({ attack: true }));
      run(state, 4);
      lowest = Math.min(lowest, general.hp);
      expect(general.state).not.toBe("dead");
    }
    expect(lowest).toBe(1);
  });

  it("falls to the team's finishing blow once he is down, ending the fight", () => {
    const { state, general } = boss();
    let staggerAt = -1;
    for (let i = 0; i < 400 && state.arenaFlow.phase !== "victory"; i++) {
      run(state, 4, idleInput({ attack: true }));
      run(state, 4);
      if (staggerAt < 0 && general.hp === 1) staggerAt = state.tick;
    }
    expect(staggerAt).toBeGreaterThan(0);
    expect(general.state).toBe("dead");
    expect(state.arenaFlow.phase).toBe("victory");
    // The blow waited out the stagger rather than landing the instant he hit the floor.
    expect(state.tick - staggerAt).toBeGreaterThanOrEqual(
      state.tuning.flow.finisherDelay - 8,
    );
  });

  it("is not finished early by a ghost or an ally, only by the scripted blow", () => {
    const { state, general } = boss(["allyZane"]);
    const ally = mobsOf(state, "allyZane")[0];
    if (ally) ally.pos = { x: general.pos.x - 16, y: general.pos.y + 4 };
    for (let i = 0; i < 600 && state.arenaFlow.phase !== "victory"; i++) {
      run(state, 1);
      // Until the scripted blow, the ally's hits leave him standing at the floor.
      if (general.state !== "dead")
        expect(general.hp).toBeGreaterThanOrEqual(1);
    }
    expect(state.arenaFlow.phase).toBe("victory");
  });
});
