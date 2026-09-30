import { describe, expect, it } from "vitest";
import { ELEMENTS, type ElementData } from "../data/elements";
import { createTuning, type Tuning } from "../data/tuning";
import { cycleElement, setElement } from "./elements";
import { createEntity } from "./entity";
import { spawnMob } from "./spawner";
import { createSim, step } from "./step";
import { entityOfKind, idleInput } from "./testing";
import type { Entity, SimState } from "./types";

interface World {
  state: SimState;
  tuning: Tuning;
  player: Entity;
}

function world(element: string | null, tune?: (t: Tuning) => void): World {
  const tuning = createTuning();
  for (const mob of Object.values(tuning.mobs)) mob.reactionDelay = 1_000_000;
  tune?.(tuning);
  const state = createSim({ seed: 5, tuning, element });
  state.entities = state.entities.filter((e) => e.kind !== "dummy");
  return { state, tuning, player: entityOfKind(state, "player") };
}

const spinning = idleInput({ spin: true });

function run(state: SimState, ticks: number, input = idleInput()): void {
  for (let t = 0; t < ticks; t++) step(state, input);
}

/** Spins `ticks` frames, then lets go so the spin ends on its own. */
function spinAndRelease(w: World, ticks: number): void {
  w.player.combat.spinMeter = 100;
  run(w.state, ticks, spinning);
  run(w.state, 1);
}

function mobAt(w: World, type: string, dx: number): Entity {
  return spawnMob(w.state, type, {
    x: w.player.pos.x + dx,
    y: w.player.pos.y,
  });
}

// A dummy is neutral, and so hittable, unless its script gives it a faction.
function allyDummy(t: Tuning): void {
  t.combat.dummy.scriptedAttack = true;
  t.combat.dummy.scriptedFaction = "ninja";
}

function addAlly(w: World, pos: { x: number; y: number }): Entity {
  const ally = createEntity(
    w.state.nextId,
    "dummy",
    "ninja",
    "dummy",
    pos,
    { x: 1, y: 0 },
    w.tuning,
  );
  w.state.nextId += 1;
  w.state.entities.push(ally);
  return ally;
}

const FIRE = ELEMENTS.fire.onSpinTick[0].params;
const EARTH = ELEMENTS.earth.onSpinEnd[0].params;

describe("fire trail", () => {
  it("drops a hazard on the first spin frame and then on its interval", () => {
    const w = world("fire");
    w.player.combat.spinMeter = 100;
    // The spin starts on the first tick and its first spinning frame is the next.
    run(w.state, 1, spinning);
    expect(w.state.hazards).toHaveLength(0);
    run(w.state, 1, spinning);
    expect(w.state.hazards).toHaveLength(1);
    run(w.state, FIRE.interval * 3, spinning);
    expect(w.state.hazards).toHaveLength(4);
    expect(w.state.hazards.every((h) => h.ownerId === w.player.id)).toBe(true);
    expect(w.state.hazards.every((h) => h.faction === "ninja")).toBe(true);
  });

  it("drops nothing without an element", () => {
    const w = world(null);
    spinAndRelease(w, 40);
    expect(w.state.hazards).toHaveLength(0);
  });

  it("burns hostiles without interrupting them", () => {
    const w = world("fire");
    spinAndRelease(w, 20);
    const patch = w.state.hazards[0];
    if (!patch) throw new Error("expected a patch");
    const mob = mobAt(w, "melee", 0);
    mob.pos = { ...patch.pos };
    const hp = mob.hp;
    run(w.state, 35);
    expect(mob.hp).toBeLessThan(hp);
    expect(mob.state).not.toBe("hurt");
  });

  it("spares allies", () => {
    const w = world("fire", allyDummy);
    spinAndRelease(w, 20);
    const patch = w.state.hazards[0];
    if (!patch) throw new Error("expected a patch");
    const ally = addAlly(w, patch.pos);
    run(w.state, 35);
    expect(ally.hp).toBe(ally.maxHp);
  });

  it("hits once per re-hit interval even inside overlapping patches", () => {
    const w = world("fire");
    spinAndRelease(w, 40);
    const patch = w.state.hazards[1];
    if (!patch) throw new Error("expected patches");
    const brute = mobAt(w, "oniBrute", 0);
    brute.pos = { ...patch.pos };
    const scale = w.tuning.kits.oniBrute?.armor?.spinDamageScale ?? 1;
    const hp = brute.hp;
    run(w.state, 1);
    expect(hp - brute.hp).toBeCloseTo(FIRE.damage * scale);
  });

  it("expires after its lifetime", () => {
    const w = world("fire");
    spinAndRelease(w, 30);
    expect(w.state.hazards.length).toBeGreaterThan(0);
    run(w.state, FIRE.lifetime + 10);
    expect(w.state.hazards).toHaveLength(0);
  });

  it("is a ground hazard: airborne targets are unaffected", () => {
    const w = world("fire");
    spinAndRelease(w, 20);
    const patch = w.state.hazards[0];
    if (!patch) throw new Error("expected a patch");
    const mob = mobAt(w, "melee", 0);
    mob.pos = { ...patch.pos };
    mob.z = w.tuning.combat.airborneZ + 10;
    const hp = mob.hp;
    run(w.state, 35);
    expect(mob.hp).toBe(hp);
    mob.z = 0;
    run(w.state, 35);
    expect(mob.hp).toBeLessThan(hp);
  });
});

describe("earth burst", () => {
  it("fires when the spin ends naturally and hits inside its radius only", () => {
    const w = world("earth");
    const near = mobAt(w, "melee", 36);
    const far = mobAt(w, "melee", EARTH.radius + 20);
    w.player.combat.spinMeter = 100;
    run(w.state, 10, spinning);
    expect(near.hp).toBe(near.maxHp);
    expect(w.state.hazards).toHaveLength(0);
    run(w.state, 1);
    expect(w.state.hazards).toHaveLength(1);
    expect(near.hp).toBe(near.maxHp - EARTH.damage);
    expect(near.state).toBe("hurt");
    expect(far.hp).toBe(far.maxHp);
  });

  it("hits each target once and then expires", () => {
    const w = world("earth");
    const brute = mobAt(w, "oniBrute", 36);
    spinAndRelease(w, 10);
    const scale = w.tuning.kits.oniBrute?.armor?.spinDamageScale ?? 1;
    run(w.state, 60);
    expect(brute.maxHp - brute.hp).toBeCloseTo(EARTH.damage * scale);
    expect(w.state.hazards).toHaveLength(0);
  });

  it("does not fire when a hit breaks the spin", () => {
    const w = world("earth");
    const near = mobAt(w, "melee", 36);
    w.player.combat.spinMeter = 100;
    run(w.state, 10, spinning);
    w.player.state = "hurt";
    w.player.combat.stun = 10;
    run(w.state, 2);
    expect(w.state.hazards).toHaveLength(0);
    expect(near.hp).toBe(near.maxHp);
  });

  it("does not hit allies", () => {
    const w = world("earth", allyDummy);
    const ally = addAlly(w, { x: w.player.pos.x + 36, y: w.player.pos.y });
    spinAndRelease(w, 10);
    expect(ally.hp).toBe(ally.maxHp);
  });
});

describe("brute armor", () => {
  it("scales element damage by the spin multiplier and skips the flinch", () => {
    const w = world("earth");
    const brute = mobAt(w, "oniBrute", 36);
    spinAndRelease(w, 10);
    const scale = w.tuning.kits.oniBrute?.armor?.spinDamageScale ?? 1;
    expect(scale).toBeLessThan(1);
    expect(brute.maxHp - brute.hp).toBeCloseTo(EARTH.damage * scale);
    expect(brute.state).not.toBe("hurt");
  });
});

describe("element switching", () => {
  it("cycles none, then each element in data order, then back", () => {
    const w = world(null);
    const seen = [w.player.element];
    for (let i = 0; i < Object.keys(ELEMENTS).length + 1; i++) {
      seen.push(cycleElement(w.state, w.player));
    }
    expect(seen).toEqual([null, "fire", "earth", null]);
  });

  it("switches between spins and rejects unknown ids", () => {
    const w = world(null);
    spinAndRelease(w, 20);
    expect(w.state.hazards).toHaveLength(0);
    w.player.state = "idle";
    w.player.combat.stun = 0;
    setElement(w.state, w.player, "fire");
    w.player.combat.spinMeter = 100;
    run(w.state, 20, spinning);
    expect(w.state.hazards.length).toBeGreaterThan(0);
    expect(() => setElement(w.state, w.player, "nope")).toThrow(
      /Unknown element/,
    );
  });
});

describe("a third element as data only", () => {
  // Composes the two existing handlers with new params; no sim code changes.
  const lightning: ElementData = {
    name: "Lightning",
    color: 0xffee40,
    onSpinTick: [
      {
        id: "spawnHazard",
        params: {
          interval: 6,
          lifetime: 40,
          radius: 5,
          damage: 7,
          guardDamage: 0,
          knockback: 0,
          hitstop: 0,
          unblockable: 1,
          flinch: 0,
          hitInterval: 10,
          color: 0xffee40,
        },
      },
    ],
    onSpinEnd: [
      {
        id: "radialBurst",
        params: {
          radius: 60,
          lifetime: 8,
          damage: 6,
          guardDamage: 0,
          knockback: 50,
          hitstop: 0,
          unblockable: 0,
          flinch: 1,
          color: 0xffee40,
        },
      },
    ],
  };

  it("works through the existing handlers and joins the cycle", () => {
    const w = world(null, (t) => {
      t.elements.lightning = lightning;
    });
    expect(cycleElement(w.state, w.player)).toBe("fire");
    expect(cycleElement(w.state, w.player)).toBe("earth");
    expect(cycleElement(w.state, w.player)).toBe("lightning");
    const mob = mobAt(w, "melee", 50);
    w.player.combat.spinMeter = 100;
    run(w.state, 14, spinning);
    // Spin frames 1, 7 and 13 each drop a patch.
    const patches = w.state.hazards.filter((h) => h.style === "patch");
    expect(patches.map((h) => h.radius)).toEqual([5, 5, 5]);
    run(w.state, 1);
    const burst = w.state.hazards.find((h) => h.style === "ring");
    expect(burst?.radius).toBe(60);
    expect(mob.hp).toBe(mob.maxHp - 6);
  });
});

describe("determinism", () => {
  it("replays identically with an element and the wave flow running", () => {
    const script = (t: number) =>
      idleInput({
        moveX: Math.sin(t / 30),
        moveY: Math.cos(t / 45),
        attack: t % 50 === 0,
        spin: t % 200 < 90,
      });
    const a = createSim({ seed: 11, mode: "run", element: "fire" });
    const b = createSim({ seed: 11, mode: "run", element: "fire" });
    let spawned = 0;
    for (let t = 0; t < 900; t++) {
      step(a, script(t));
      step(b, script(t));
      spawned = Math.max(spawned, a.hazards.length);
    }
    expect(spawned).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
