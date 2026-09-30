import { ARENA_LAYOUT } from "../data/arena";
import { createTuning, type Tuning } from "../data/tuning";
import { createArena, tileCenter } from "./arena";
import { createEntity } from "./entity";
import { tickEntity } from "./fighter";
import { resolveHits } from "./hits";
import { dummyIntent, type Intent, NO_INTENT, playerIntent } from "./intent";
import { mobIntent } from "./mobAi";
import { stepProjectiles } from "./projectiles";
import { pruneTokens } from "./tokens";
import type { ActionFrame, Entity, SimState } from "./types";

const IDLE_FRAME: ActionFrame = {
  moveX: 0,
  moveY: 0,
  attack: false,
  dodge: false,
  block: false,
  jump: false,
  spin: false,
  pause: false,
};

export function createSim(opts: { seed: number; tuning?: Tuning }): SimState {
  const tuning = opts.tuning ?? createTuning();
  const arena = createArena();
  const { playerSpawn, dummySpawn } = ARENA_LAYOUT;
  const p = tileCenter(arena, playerSpawn.col, playerSpawn.row);
  const d = tileCenter(arena, dummySpawn.col, dummySpawn.row);
  const dummy = createEntity(
    2,
    "dummy",
    "neutral",
    "dummy",
    d,
    { x: -1, y: 0 },
    tuning,
  );
  syncDummyFaction(dummy, tuning);
  return {
    tick: 0,
    rngState: opts.seed >>> 0,
    nextId: 3,
    arena,
    entities: [
      createEntity(1, "player", "ninja", "ninja", p, { x: 1, y: 0 }, tuning),
      dummy,
    ],
    projectiles: [],
    tokens: [],
    defeated: false,
    tuning,
    prevInput: { ...IDLE_FRAME },
  };
}

// The dummy only fights back when scripted, and a neutral never attacks, so its
// faction follows the script toggle.
function syncDummyFaction(dummy: Entity, tuning: Tuning): void {
  const { scriptedAttack, scriptedFaction } = tuning.combat.dummy;
  dummy.faction = scriptedAttack ? scriptedFaction : "neutral";
}

function intentFor(
  state: SimState,
  entity: Entity,
  input: ActionFrame,
): Intent {
  if (entity.state === "dead") return NO_INTENT;
  if (entity.kind === "player") return playerIntent(input, state.prevInput);
  if (entity.kind === "mob") return mobIntent(state, entity);
  return dummyIntent(state, entity, state.tuning);
}

function reapDead(state: SimState): void {
  state.entities = state.entities.filter(
    (e) =>
      !(
        e.state === "dead" &&
        e.combat.stun <= 0 &&
        state.tuning.kits[e.kitId]?.removeOnDeath
      ),
  );
  state.defeated = state.entities.some(
    (e) => e.kind === "player" && e.state === "dead",
  );
}

// The sim ignores `pause`; the scene simply stops calling step.
export function step(state: SimState, input: ActionFrame): void {
  for (const entity of state.entities) {
    if (entity.kind === "dummy") syncDummyFaction(entity, state.tuning);
  }
  const intents = state.entities.map((e) => intentFor(state, e, input));
  state.entities.forEach((entity, i) => {
    const intent = intents[i];
    if (intent) tickEntity(state, entity, intent);
  });
  stepProjectiles(state);
  resolveHits(state);
  pruneTokens(state);
  reapDead(state);
  state.prevInput = { ...input };
  state.tick += 1;
}
