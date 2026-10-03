import { ARENA_LAYOUT } from "../data/arena";
import { WAVES, type WaveData } from "../data/mobs";
import { getMob } from "../data/tuning";
import { tileCenter } from "./arena";
import { createEntity } from "./entity";
import { nextFloat } from "./rng";
import type { Entity, SimState, Vec2 } from "./types";

export function spawnMob(state: SimState, mobType: string, pos: Vec2): Entity {
  const data = getMob(state.tuning, mobType);
  const mob = createEntity(
    state.nextId,
    "mob",
    data.faction,
    data.kitId,
    pos,
    { x: -1, y: 0 },
    state.tuning,
    mobType,
  );
  state.nextId += 1;
  if (mob.ai) {
    mob.ai.timer += Math.floor(nextFloat(state) * data.reactionJitter);
    mob.ai.strafe = nextFloat(state) < 0.5 ? 1 : -1;
  }
  state.entities.push(mob);
  return mob;
}

/** Debug spawner: places a wave at the arena's spawn points, rotated by the RNG. */
export function spawnWave(
  state: SimState,
  wave: WaveData = WAVES[0],
): Entity[] {
  const points = ARENA_LAYOUT.mobSpawns;
  const start = Math.floor(nextFloat(state) * points.length);
  const spawned: Entity[] = [];
  let n = 0;
  for (const { type, count } of wave.spawns) {
    for (let i = 0; i < count; i++) {
      const point = points[(start + n) % points.length];
      if (!point) return spawned;
      const base = tileCenter(state.arena, point.col, point.row);
      // Past one lap of the points, offset so a big wave doesn't stack.
      const lap = Math.floor(n / points.length);
      spawned.push(spawnMob(state, type, { x: base.x - lap * 12, y: base.y }));
      n += 1;
    }
  }
  return spawned;
}
