import { ARENA_LAYOUT } from "../data/arena";
import { getKit } from "../data/kits";
import { createArena, tileCenter } from "./arena";
import { moveAndCollide } from "./collision";
import { SIM_HZ } from "./timing";
import type { ActionFrame, Entity, SimState } from "./types";

function createEntity(
  id: number,
  kind: Entity["kind"],
  faction: Entity["faction"],
  kitId: string,
  pos: { x: number; y: number },
): Entity {
  const kit = getKit(kitId);
  return {
    id,
    kind,
    faction,
    kitId,
    pos: { x: pos.x, y: pos.y },
    z: 0,
    vel: { x: 0, y: 0 },
    feet: { w: kit.feet.w, h: kit.feet.h },
    bodyHeight: kit.bodyHeight,
    state: "idle",
  };
}

export function createSim(opts: { seed: number }): SimState {
  const arena = createArena();
  const { playerSpawn, dummySpawn } = ARENA_LAYOUT;
  const p = tileCenter(arena, playerSpawn.col, playerSpawn.row);
  const d = tileCenter(arena, dummySpawn.col, dummySpawn.row);
  return {
    tick: 0,
    rngState: opts.seed >>> 0,
    arena,
    entities: [
      createEntity(1, "player", "ninja", "ninja", p),
      createEntity(2, "dummy", "neutral", "dummy", d),
    ],
  };
}

function clampedMove(input: ActionFrame): { x: number; y: number } {
  const x = Number.isFinite(input.moveX) ? input.moveX : 0;
  const y = Number.isFinite(input.moveY) ? input.moveY : 0;
  const mag = Math.hypot(x, y);
  // Only shrink: a slight tilt must stay slower than full deflection.
  return mag > 1 ? { x: x / mag, y: y / mag } : { x, y };
}

export function step(state: SimState, input: ActionFrame): void {
  const dt = 1 / SIM_HZ;
  const move = clampedMove(input);

  for (const entity of state.entities) {
    if (entity.kind === "player") {
      const speed = getKit(entity.kitId).moveSpeed;
      entity.vel.x = move.x * speed;
      entity.vel.y = move.y * speed;
    } else {
      entity.vel.x = 0;
      entity.vel.y = 0;
    }

    moveAndCollide(
      state.arena,
      entity,
      state.entities,
      entity.vel.x * dt,
      entity.vel.y * dt,
    );
    entity.state = entity.vel.x !== 0 || entity.vel.y !== 0 ? "move" : "idle";
  }

  state.tick += 1;
}
