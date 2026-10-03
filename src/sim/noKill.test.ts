import { describe, expect, it } from "vitest";
import { ELEMENTS, type ElementData } from "../data/elements";
import { createTuning, type Tuning } from "../data/tuning";
import { spawnGhost } from "./echo/ghost";
import { applyTeamFinisher } from "./finisher";
import { spawnProjectile } from "./projectiles";
import { spawnMob } from "./spawner";
import { createSim, step } from "./step";
import { entityOfKind, idleInput } from "./testing";
import type { Entity, SimState } from "./types";

const HUGE = 1_000_000;

interface World {
  state: SimState;
  player: Entity;
  villain: Entity;
}

// Every swing is huge, so only the canon-villain floor can keep the target alive.
function world(
  canon: boolean,
  tune: (t: Tuning) => void = () => {},
  dx = 16,
): World {
  const tuning = createTuning();
  for (const mob of Object.values(tuning.mobs)) mob.reactionDelay = HUGE;
  const melee = tuning.mobs.melee;
  if (melee) melee.canonVillain = canon;
  for (const attack of Object.values(tuning.attacks)) attack.damage = HUGE;
  tune(tuning);
  const state = createSim({ seed: 3, tuning });
  state.entities = state.entities.filter((e) => e.kind !== "dummy");
  const player = entityOfKind(state, "player");
  const villain = spawnMob(state, "melee", {
    x: player.pos.x + dx,
    y: player.pos.y,
  });
  return { state, player, villain };
}

const run = (state: SimState, ticks: number, input = idleInput()): void => {
  for (let t = 0; t < ticks; t++) step(state, input);
};

const alive = (e: Entity): boolean => e.state !== "dead" && e.hp >= 1;

describe("no killing blows on canon villains", () => {
  it("control: the same blow kills an ordinary mob", () => {
    const { state, villain } = world(false);
    run(state, 20, idleInput({ attack: true }));
    expect(villain.state).toBe("dead");
  });

  it("holds against the player's melee combo", () => {
    const { state, villain } = world(true);
    for (let i = 0; i < 20; i++) {
      run(state, 4, idleInput({ attack: true }));
      run(state, 4, idleInput());
    }
    expect(villain.hp).toBe(1);
    expect(alive(villain)).toBe(true);
  });

  it("holds against a counter attack's bonus damage", () => {
    const { state, player, villain } = world(true);
    player.combat.counterWindow = 45;
    run(state, 20, idleInput({ attack: true }));
    expect(villain.hp).toBe(1);
    expect(alive(villain)).toBe(true);
  });

  it("holds against a ghost's melee", () => {
    const { state, player, villain } = world(true, undefined, 200);
    spawnGhost(state, {
      owner: player,
      move: "twinStrike",
      pos: { x: villain.pos.x - 16, y: villain.pos.y },
      facing: { x: 1, y: 0 },
      replayTick: state.tick,
      actFrames: 1,
      follow: false,
      press: "attack",
      attackId: "ninjaHit3",
      ttl: 60,
      taunt: false,
    });
    run(state, 30);
    expect(villain.hp).toBe(1);
    expect(alive(villain)).toBe(true);
  });

  it("holds against the player's spin", () => {
    const { state, player, villain } = world(true, (t) => {
      const spin = t.kits.ninja?.spin;
      if (spin) spin.hit.damage = HUGE;
    });
    player.combat.spinMeter = 100;
    run(state, 40, idleInput({ spin: true }));
    expect(villain.hp).toBe(1);
    expect(alive(villain)).toBe(true);
  });

  it("holds against an element's ground hazard", () => {
    const fire: ElementData = {
      ...ELEMENTS.fire,
      onSpinTick: ELEMENTS.fire.onSpinTick.map((m) => ({
        ...m,
        params: { ...m.params, damage: HUGE, radius: 40 },
      })),
    };
    const { state, player, villain } = world(true, (t) => {
      t.elements.fire = fire;
    });
    player.element = "fire";
    player.combat.spinMeter = 100;
    // Out of spin reach, so only the hazard patches can touch it.
    villain.pos.x = player.pos.x + 30;
    run(state, 60, idleInput({ spin: true }));
    expect(villain.hp).toBe(1);
    expect(alive(villain)).toBe(true);
  });

  it("holds against a projectile fired by the player's side", () => {
    const { state, player, villain } = world(true, undefined, 40);
    spawnProjectile(state, player, "oniBolt");
    run(state, 60);
    expect(villain.hp).toBe(1);
    expect(alive(villain)).toBe(true);
  });

  it("is ended only by the scripted team finisher", () => {
    const { state, villain } = world(true);
    run(state, 20, idleInput({ attack: true }));
    expect(villain.hp).toBe(1);
    applyTeamFinisher(state, villain);
    expect(villain.state).toBe("dead");
    expect(villain.hp).toBe(0);
  });
});
