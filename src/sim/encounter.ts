import type { EchoMoveId } from "../data/echo";
import { ENCOUNTERS, type EncounterId } from "../data/encounters";
import { createTuning, type Tuning } from "../data/tuning";
import { tileCenter } from "./arena";
import { spawnMob } from "./spawner";
import { createSim } from "./step";
import type { SimState } from "./types";

/** What a story fight needs from the story, with no story types in the sim. */
export interface EncounterContext {
  echoMoves: readonly EchoMoveId[];
  resonance: number;
  ghostLimit: number;
  allyMobTypes: readonly string[];
  twinStrikeFlicker: boolean;
  rewindWindowFrames: number;
}

// Long enough that no fight outlasts a trap.
const TRAP_LIFE = 1_000_000;
const TRAP_HIT_INTERVAL = 45;
const TRAP_COLOR = 0xff6a30;
const ALLY_OFFSET = { x: -14, y: 10 };

/** A run of one story encounter: its waves, traps and allies, with the player's Echo state carried in. */
export function createEncounterSim(opts: {
  encounter: EncounterId;
  seed: number;
  context: EncounterContext;
  tuning?: Tuning;
}): SimState {
  const data = ENCOUNTERS[opts.encounter];
  const { context } = opts;
  const tuning = opts.tuning ?? createTuning();
  tuning.flow = {
    ...tuning.flow,
    waves: data.waves,
    boss: data.boss,
  };
  tuning.echo.rewindStep.windowFrames = context.rewindWindowFrames;

  const state = createSim({
    seed: opts.seed,
    tuning,
    mode: "run",
    echoMoves: context.echoMoves,
  });
  state.echo.resonance = context.resonance;
  state.echo.ghostLimit = context.ghostLimit;
  state.echo.twinStrikeFlicker = context.twinStrikeFlicker;

  const player = state.entities.find((e) => e.kind === "player");
  if (player) {
    for (const type of context.allyMobTypes) {
      spawnMob(state, type, {
        x: player.pos.x + ALLY_OFFSET.x,
        y: player.pos.y + ALLY_OFFSET.y,
      });
    }
  }
  data.traps.forEach((trap, i) => {
    const pos = tileCenter(state.arena, trap.col, trap.row);
    state.hazards.push({
      id: state.nextId,
      // Unique per trap so standing between two still hurts from each.
      kind: `trap_${i}`,
      ownerId: 0,
      faction: "skulkin",
      pos,
      radius: trap.radius,
      life: TRAP_LIFE,
      maxLife: TRAP_LIFE,
      hit: {
        damage: trap.damage,
        guardDamage: 0,
        knockback: 0,
        hitstop: 0,
        unblockable: true,
      },
      hitInterval: TRAP_HIT_INTERVAL,
      flinch: false,
      style: "patch",
      color: TRAP_COLOR,
    });
    state.nextId += 1;
  });
  return state;
}
