import { describe, expect, it } from "vitest";
import { ARENA_LAYOUT } from "../data/arena";
import { FACTION_IDS, isHostile } from "../data/factions";
import { KITS } from "../data/kits";
import { moveAndCollide } from "./collision";
import { depthOrder } from "./depth";
import { nextFloat } from "./rng";
import { createSim, step } from "./step";
import { entityOfKind, idleInput } from "./testing";
import { createFixedStepper, FIXED_DT_MS } from "./timing";
import type { Entity } from "./types";

const ninjaSpeedPerTick = KITS.ninja.moveSpeed / 60;

function runTicks(
  count: number,
  moveX: number,
  moveY: number,
  state = createSim({ seed: 1 }),
) {
  for (let i = 0; i < count; i++) step(state, idleInput({ moveX, moveY }));
  return state;
}

function fakeEntity(id: number, y: number): Entity {
  return {
    id,
    kind: "dummy",
    faction: "neutral",
    kitId: "dummy",
    pos: { x: 0, y },
    z: 0,
    vel: { x: 0, y: 0 },
    feet: { w: 4, h: 4 },
    bodyHeight: 10,
    state: "idle",
  };
}

describe("rng", () => {
  it("produces the same sequence from the same seed", () => {
    const a = { rngState: 1234 };
    const b = { rngState: 1234 };
    const seqA = Array.from({ length: 20 }, () => nextFloat(a));
    const seqB = Array.from({ length: 20 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
    expect(a.rngState).toBe(b.rngState);
  });

  it("differs across seeds and stays in [0, 1)", () => {
    const a = { rngState: 1 };
    const b = { rngState: 2 };
    expect(nextFloat(a)).not.toBe(nextFloat(b));
    for (let i = 0; i < 1000; i++) {
      const v = nextFloat(a);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("resumes exactly from a serialized state", () => {
    const a = { rngState: 99 };
    nextFloat(a);
    const resumed = { rngState: a.rngState };
    expect(nextFloat(resumed)).toBe(nextFloat(a));
  });
});

describe("fixed stepper", () => {
  function ticksOverOneSecond(frameMs: number, frames: number): number {
    let total = 0;
    const stepper = createFixedStepper(() => {
      total += 1;
    });
    for (let i = 0; i < frames; i++) stepper.advance(frameMs);
    return total;
  }

  it("runs 60 ticks per second at both 60 Hz and 144 Hz frame rates", () => {
    expect(ticksOverOneSecond(1000 / 60, 60)).toBe(60);
    expect(ticksOverOneSecond(1000 / 144, 144)).toBe(60);
  });

  it("runs no tick until a full step has accumulated", () => {
    const stepper = createFixedStepper(() => undefined);
    expect(stepper.advance(FIXED_DT_MS / 2)).toBe(0);
    expect(stepper.advance(FIXED_DT_MS / 2)).toBe(1);
  });

  it("clamps a stall to maxTicksPerAdvance and discards the excess", () => {
    let ticks = 0;
    const stepper = createFixedStepper(
      () => {
        ticks += 1;
      },
      { maxTicksPerAdvance: 5 },
    );
    expect(stepper.advance(10_000)).toBe(5);
    expect(ticks).toBe(5);
    expect(stepper.advance(0)).toBe(0);
  });

  it("defaults the clamp to a small number of ticks", () => {
    const stepper = createFixedStepper(() => undefined);
    expect(stepper.advance(60_000)).toBeLessThanOrEqual(5);
  });

  it("ignores negative and non-finite elapsed time", () => {
    const stepper = createFixedStepper(() => undefined);
    expect(stepper.advance(-50)).toBe(0);
    expect(stepper.advance(Number.NaN)).toBe(0);
    expect(stepper.advance(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("movement", () => {
  it("starts as an idle ninja next to a neutral dummy", () => {
    const state = createSim({ seed: 1 });
    const player = entityOfKind(state, "player");
    const dummy = entityOfKind(state, "dummy");
    expect(player.faction).toBe("ninja");
    expect(player.kitId).toBe("ninja");
    expect(dummy.faction).toBe("neutral");
    expect(player.state).toBe("idle");
    expect(player.z).toBe(0);
  });

  it("builds a 15x10 arena with solid borders and pillars", () => {
    const { arena } = createSim({ seed: 1 });
    expect(arena.cols).toBe(15);
    expect(arena.rows).toBe(10);
    expect(arena.tileSize).toBe(16);
    expect(arena.solid[0]).toBe(true);
    expect(arena.solid[arena.cols * arena.rows - 1]).toBe(true);
    const interior = arena.solid.filter((s, i) => {
      const col = i % arena.cols;
      const row = Math.floor(i / arena.cols);
      return (
        s && col > 0 && row > 0 && col < arena.cols - 1 && row < arena.rows - 1
      );
    });
    expect(interior.length).toBeGreaterThanOrEqual(2);
  });

  it("moves at kit speed and reports the move state", () => {
    const state = createSim({ seed: 1 });
    const startY = entityOfKind(state, "player").pos.y;
    runTicks(10, 0, 1, state);
    const player = entityOfKind(state, "player");
    expect(player.pos.y - startY).toBeCloseTo(10 * ninjaSpeedPerTick);
    expect(player.state).toBe("move");
    step(state, idleInput());
    expect(player.state).toBe("idle");
  });

  it("moves diagonally at the same speed as straight", () => {
    const straight = createSim({ seed: 1 });
    const diagonal = createSim({ seed: 1 });
    const s0 = { ...entityOfKind(straight, "player").pos };
    const d0 = { ...entityOfKind(diagonal, "player").pos };
    runTicks(10, 0, 1, straight);
    runTicks(10, 1, 1, diagonal);
    const sp = entityOfKind(straight, "player").pos;
    const dp = entityOfKind(diagonal, "player").pos;
    const straightDist = Math.hypot(sp.x - s0.x, sp.y - s0.y);
    const diagonalDist = Math.hypot(dp.x - d0.x, dp.y - d0.y);
    expect(diagonalDist).toBeCloseTo(straightDist);
  });

  it("keeps sub-unit stick deflection slower than full speed", () => {
    const state = createSim({ seed: 1 });
    const x0 = entityOfKind(state, "player").pos.x;
    runTicks(10, -0.5, 0, state);
    expect(x0 - entityOfKind(state, "player").pos.x).toBeCloseTo(
      5 * ninjaSpeedPerTick,
    );
  });

  it("treats non-finite input as no movement", () => {
    const state = createSim({ seed: 1 });
    const before = { ...entityOfKind(state, "player").pos };
    step(
      state,
      idleInput({ moveX: Number.NaN, moveY: Number.POSITIVE_INFINITY }),
    );
    expect(entityOfKind(state, "player").pos).toEqual(before);
  });
});

describe("collision", () => {
  const { tileSize } = ARENA_LAYOUT;
  const feetW = KITS.ninja.feet.w;
  const feetH = KITS.ninja.feet.h;

  it("blocks the player at the border wall", () => {
    const state = runTicks(120, -1, 0);
    expect(entityOfKind(state, "player").pos.x).toBeCloseTo(
      tileSize + feetW / 2,
    );
  });

  it("slides along a wall while pushing diagonally into it", () => {
    const state = createSim({ seed: 1 });
    const y0 = entityOfKind(state, "player").pos.y;
    runTicks(30, -1, 1, state);
    const player = entityOfKind(state, "player");
    expect(player.pos.x).toBeCloseTo(tileSize + feetW / 2);
    expect(player.pos.y).toBeGreaterThan(y0 + 10);
  });

  it("blocks against interior pillars", () => {
    const state = createSim({ seed: 1 });
    const player = entityOfKind(state, "player");
    player.pos = { x: 40, y: 56 };
    runTicks(200, 1, 0, state);
    expect(player.pos.x).toBeCloseTo(4 * tileSize - feetW / 2);
  });

  it("does not tunnel through walls or pillars at extreme displacement", () => {
    const rightWall = createSim({ seed: 1 });
    const a = entityOfKind(rightWall, "player");
    a.pos = { x: 40, y: 24 };
    moveAndCollide(rightWall.arena, a, rightWall.entities, 1000, 0);
    expect(a.pos.x).toBeCloseTo(
      rightWall.arena.cols * tileSize - tileSize - feetW / 2,
    );

    const floor = createSim({ seed: 1 });
    const b = entityOfKind(floor, "player");
    b.pos = { x: 40, y: 88 };
    moveAndCollide(floor.arena, b, floor.entities, 0, 1000);
    expect(b.pos.y).toBeCloseTo(
      floor.arena.rows * tileSize - tileSize - feetH / 2,
    );

    const pillar = createSim({ seed: 1 });
    const c = entityOfKind(pillar, "player");
    c.pos = { x: 40, y: 56 };
    moveAndCollide(pillar.arena, c, pillar.entities, 1000, 0);
    expect(c.pos.x).toBeCloseTo(4 * tileSize - feetW / 2);
  });

  it("cannot leave the arena even with a huge negative displacement", () => {
    const state = createSim({ seed: 1 });
    const player = entityOfKind(state, "player");
    moveAndCollide(state.arena, player, state.entities, -100_000, -100_000);
    expect(player.pos.x).toBeCloseTo(tileSize + feetW / 2);
    expect(player.pos.y).toBeCloseTo(tileSize + feetH / 2);
  });

  it("stops the player against the dummy feet box", () => {
    const state = runTicks(300, 1, 0);
    const player = entityOfKind(state, "player");
    const dummy = entityOfKind(state, "dummy");
    expect(player.pos.x).toBeCloseTo(
      dummy.pos.x - dummy.feet.w / 2 - feetW / 2,
    );
  });

  it("never moves the dummy", () => {
    const state = createSim({ seed: 1 });
    const before = { ...entityOfKind(state, "dummy").pos };
    runTicks(300, 1, 0, state);
    expect(entityOfKind(state, "dummy").pos).toEqual(before);
  });
});

describe("determinism", () => {
  it("produces deep-equal state for the same seed and inputs", () => {
    const inputs = Array.from({ length: 500 }, (_, i) =>
      idleInput({
        moveX: Math.sin(i / 7),
        moveY: Math.cos(i / 11),
        attack: i % 13 === 0,
      }),
    );
    const a = createSim({ seed: 42 });
    const b = createSim({ seed: 42 });
    for (const input of inputs) {
      step(a, input);
      step(b, input);
    }
    expect(a).toEqual(b);
    expect(a.tick).toBe(500);
  });

  it("survives a JSON round trip mid-run", () => {
    const a = createSim({ seed: 7 });
    for (let i = 0; i < 50; i++) step(a, idleInput({ moveX: 1, moveY: 0.3 }));
    const restored: typeof a = JSON.parse(JSON.stringify(a));
    for (let i = 0; i < 50; i++) {
      step(a, idleInput({ moveX: -0.4, moveY: 1 }));
      step(restored, idleInput({ moveX: -0.4, moveY: 1 }));
    }
    expect(restored).toEqual(a);
  });
});

describe("depthOrder", () => {
  it("sorts by feet y ascending", () => {
    const sorted = depthOrder([
      fakeEntity(1, 30),
      fakeEntity(2, 10),
      fakeEntity(3, 20),
    ]);
    expect(sorted.map((e) => e.id)).toEqual([2, 3, 1]);
  });

  it("breaks ties by id and does not mutate the input", () => {
    const input = [fakeEntity(5, 10), fakeEntity(2, 10), fakeEntity(9, 10)];
    const sorted = depthOrder(input);
    expect(sorted.map((e) => e.id)).toEqual([2, 5, 9]);
    expect(input.map((e) => e.id)).toEqual([5, 2, 9]);
  });

  it("puts the player behind the dummy when above it and in front when below", () => {
    const state = createSim({ seed: 1 });
    const player = entityOfKind(state, "player");
    const dummy = entityOfKind(state, "dummy");
    player.pos.y = dummy.pos.y - 20;
    expect(depthOrder(state.entities)[0]).toBe(player);
    player.pos.y = dummy.pos.y + 20;
    expect(depthOrder(state.entities)[0]).toBe(dummy);
  });
});

describe("factions", () => {
  it("makes ninja and oni hostile both ways", () => {
    expect(isHostile("ninja", "oni")).toBe(true);
    expect(isHostile("oni", "ninja")).toBe(true);
  });

  it("is never hostile to itself", () => {
    expect(isHostile("ninja", "ninja")).toBe(false);
    expect(isHostile("oni", "oni")).toBe(false);
  });

  it("makes neutral hostile to nobody and nobody hostile to neutral", () => {
    for (const f of FACTION_IDS) {
      expect(isHostile("neutral", f)).toBe(false);
      expect(isHostile(f, "neutral")).toBe(false);
    }
  });
});
