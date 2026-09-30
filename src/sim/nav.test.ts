import { describe, expect, it } from "vitest";
import { createTuning } from "../data/tuning";
import { tileCenter } from "./arena";
import { hasClearPath, nextWaypoint } from "./nav";
import { spawnMob } from "./spawner";
import { createSim, step } from "./step";
import { entityOfKind, idleInput } from "./testing";

// The arena has a pillar at col 4, row 3; tiles directly above and below it
// have no straight line between them.
const ABOVE = { col: 4, row: 1 };
const BELOW = { col: 4, row: 5 };

function pillarWorld(mobType: string) {
  const tuning = createTuning();
  for (const mob of Object.values(tuning.mobs)) {
    mob.reactionDelay = 0;
    mob.reactionJitter = 0;
  }
  const state = createSim({ seed: 11, tuning });
  state.entities = state.entities.filter((e) => e.kind !== "dummy");
  const player = entityOfKind(state, "player");
  player.hp = 1_000_000;
  player.maxHp = 1_000_000;
  player.pos = tileCenter(state.arena, BELOW.col, BELOW.row);
  const mob = spawnMob(
    state,
    mobType,
    tileCenter(state.arena, ABOVE.col, ABOVE.row),
  );
  return { state, player, mob };
}

describe("navigation", () => {
  it("sees the pillar between the two tiles", () => {
    const { state, player, mob } = pillarWorld("oniBrute");
    expect(hasClearPath(state.arena, mob, player.pos)).toBe(false);
    expect(nextWaypoint(state.arena, mob.pos, player.pos)).not.toBeNull();
  });

  it("returns no waypoint once mover and goal share a tile", () => {
    const { state, player } = pillarWorld("melee");
    expect(nextWaypoint(state.arena, player.pos, player.pos)).toBeNull();
  });

  for (const mobType of ["oniBrute", "melee"]) {
    it(`routes a ${mobType} around a pillar to reach its target`, () => {
      const { state, player, mob } = pillarWorld(mobType);
      let closest = Number.POSITIVE_INFINITY;
      for (let t = 0; t < 600; t++) {
        step(state, idleInput());
        closest = Math.min(
          closest,
          Math.hypot(mob.pos.x - player.pos.x, mob.pos.y - player.pos.y),
        );
      }
      expect(closest).toBeLessThan(32);
    });
  }
});
