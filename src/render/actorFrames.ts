import { getKit, type Tuning } from "../data/tuning";
import { currentAttack, type Entity, type Vec2 } from "../sim";
import { ACTOR_KEY } from "./assets/actorAssets";

export interface ActorFrame {
  textureKey: string;
  frame: number;
  flipX: boolean;
}

/**
 * How a sprite sits on its entity. "ninja" is the 32x32 animated sheet, "grid"
 * the 16x16 four-facing sheets, "brute" the 50x50 single-row strips.
 */
export interface ActorSkin {
  layout: "ninja" | "grid" | "brute";
  /** The sheet the sprite starts on; the brute swaps sheets by state. */
  key: string;
  /** Texture origin y that puts the sprite's feet on the entity's feet-bottom. */
  originY: number;
  /** Opaque px from the feet to the top of the head at rest. */
  height: number;
  /** Half the opaque width, for the block shield. */
  halfWidth: number;
  /** Px the sprite squashes at the end of a telegraphed startup. */
  windupSquash: number;
  /** Px the sprite lunges along its facing during an active swing. */
  lunge: number;
}

const NINJA_SKIN: ActorSkin = {
  layout: "ninja",
  key: ACTOR_KEY.player,
  originY: 0.75,
  // Attack poses reach a few px above the idle head.
  height: 17,
  halfWidth: 8,
  windupSquash: 0,
  lunge: 0,
};

const gridSkin = (key: string): ActorSkin => ({
  layout: "grid",
  key,
  originY: 1,
  height: 16,
  halfWidth: 8,
  windupSquash: 2,
  lunge: 2,
});

const BRUTE_SKIN: ActorSkin = {
  layout: "brute",
  key: ACTOR_KEY.bruteIdle,
  originY: 43 / 50,
  height: 33,
  halfWidth: 19,
  windupSquash: 4,
  lunge: 3,
};

const MOB_SKINS: Record<string, ActorSkin> = {
  melee: gridSkin(ACTOR_KEY.melee),
  ranged: gridSkin(ACTOR_KEY.ranged),
  sweeper: gridSkin(ACTOR_KEY.sweeper),
  oniBrute: BRUTE_SKIN,
};

const DUMMY_SKIN = gridSkin(ACTOR_KEY.dummy);

export function actorSkin(e: Entity): ActorSkin {
  if (e.kind === "player") return NINJA_SKIN;
  if (e.kind === "dummy") return DUMMY_SKIN;
  return (
    (e.mobType !== null ? MOB_SKINS[e.mobType] : undefined) ??
    MOB_SKINS.melee ??
    DUMMY_SKIN
  );
}

// Sheet columns for a facing: down, up, left, right.
function dirColumn(facing: Vec2): number {
  if (Math.abs(facing.x) > Math.abs(facing.y)) return facing.x < 0 ? 2 : 3;
  return facing.y < 0 ? 1 : 0;
}

// A spinning body turns through all four facings, which is what reads as a spin.
const SPIN_COLUMNS = [0, 3, 1, 2] as const;
const SPIN_TICKS_PER_FACING = 3;

const WALK_TICKS = 7;
const IDLE_TICKS = 20;

const NINJA_COLS = 8;
const ninjaLeft = (row: number, col: number): number => row * NINJA_COLS + col;
// The attack/hit/roll/dead block starts four columns in.
const ninjaRight = (row: number, col: number): number =>
  row * NINJA_COLS + 4 + col;

const NINJA_ROW = {
  idle: 0,
  idleFrames: 4,
  walk: 4,
  walkFrames: 4,
  jumpTakeoff: 12,
  jumpPeak: 13,
  jumpFall: 14,
  strike: 1,
  hurt: 4,
  stunned: 5,
  roll: 6,
  rollFrames: 3,
  deadFalling: 13,
  deadLying: 14,
} as const;

const GRID_COLS = 4;
const GRID_ROW = {
  stand: 0,
  walk: [0, 1, 2, 3],
  attack: 4,
  crouch: 5,
} as const;
// Row 6 col 0 is the one squashed pose; the dummy uses it as its flinch too.
const GRID_SQUASHED = 6 * GRID_COLS;
const gridFrame = (row: number, col: number): number => row * GRID_COLS + col;

const BRUTE = {
  idleTicks: 9,
  idleFrames: 5,
  walkTicks: 6,
  walkFrames: 6,
  // The idle strip's poses stand in for a swing: crouched, reared up, settling.
  windup: 0,
  strike: 2,
  settle: 1,
  recoil: 1,
  stunned: 2,
} as const;

interface Pose {
  /** Frame index within the attack's own timeline. */
  frame: number;
  startup: number;
  active: number;
  recovery: number;
}

function attackPose(e: Entity, tuning: Tuning): Pose | null {
  const attack = currentAttack(e, tuning);
  if (!attack) return null;
  return {
    frame: e.combat.attackFrame,
    startup: attack.startup,
    active: attack.active,
    recovery: attack.recovery,
  };
}

const inStartup = (p: Pose): boolean => p.frame < p.startup;

/** Frames into recovery, or -1 while the swing has not reached it. */
const recoveryFrame = (p: Pose): number => p.frame - p.startup - p.active;

function ninjaFrame(
  e: Entity,
  tuning: Tuning,
  clock: number,
  dir: number,
): number {
  const c = e.combat;
  switch (e.state) {
    case "move":
      return ninjaLeft(
        NINJA_ROW.walk +
          (Math.floor(clock / WALK_TICKS) % NINJA_ROW.walkFrames),
        dir,
      );
    case "attack": {
      const pose = attackPose(e, tuning);
      if (!pose) return ninjaLeft(NINJA_ROW.idle, dir);
      if (inStartup(pose)) return ninjaRight(0, dir);
      if (recoveryFrame(pose) < 0) return ninjaRight(NINJA_ROW.strike, dir);
      const half = pose.recovery / 2;
      return ninjaRight(recoveryFrame(pose) < half ? 2 : 3, dir);
    }
    case "block":
      return ninjaLeft(NINJA_ROW.idle, dir);
    case "dodge": {
      const { duration } = tuning.combat.dodge;
      const step = Math.floor((c.dodgeFrame * NINJA_ROW.rollFrames) / duration);
      return ninjaRight(
        NINJA_ROW.roll + Math.min(NINJA_ROW.rollFrames - 1, step),
        dir,
      );
    }
    case "jump": {
      const jump = getKit(tuning, e.kitId).jump;
      if (!jump || c.jumpFrame >= jump.frames) {
        return ninjaLeft(NINJA_ROW.jumpTakeoff, dir);
      }
      const u = c.jumpFrame / jump.frames;
      if (u < 0.25) return ninjaLeft(NINJA_ROW.jumpTakeoff, dir);
      if (u < 0.85) return ninjaLeft(NINJA_ROW.jumpPeak, dir);
      return ninjaLeft(NINJA_ROW.jumpFall, dir);
    }
    case "spin": {
      const turn = Math.floor(c.spinFrame / SPIN_TICKS_PER_FACING);
      const col = SPIN_COLUMNS[turn % SPIN_COLUMNS.length] ?? dir;
      return ninjaRight(NINJA_ROW.strike, col);
    }
    case "hurt":
      return ninjaRight(NINJA_ROW.hurt, dir);
    case "stagger":
    case "guardBreak":
    case "dizzy":
      return ninjaRight(NINJA_ROW.stunned, dir);
    case "dead": {
      const half = tuning.combat.death.frames / 2;
      const row = c.stun > half ? NINJA_ROW.deadFalling : NINJA_ROW.deadLying;
      return ninjaRight(row, 0);
    }
    case "idle":
      return ninjaLeft(
        NINJA_ROW.idle +
          (Math.floor(clock / IDLE_TICKS) % NINJA_ROW.idleFrames),
        dir,
      );
  }
}

function gridFrameFor(
  e: Entity,
  tuning: Tuning,
  clock: number,
  dir: number,
): number {
  switch (e.state) {
    case "move": {
      const step = Math.floor(clock / WALK_TICKS) % GRID_ROW.walk.length;
      return gridFrame(GRID_ROW.walk[step] ?? GRID_ROW.stand, dir);
    }
    case "attack": {
      const pose = attackPose(e, tuning);
      if (!pose || inStartup(pose)) return gridFrame(GRID_ROW.stand, dir);
      // The pose holds through the first third of recovery as follow-through,
      // which also keeps a one-frame bolt shot visible.
      const follow = Math.ceil(pose.recovery / 3);
      return recoveryFrame(pose) < follow
        ? gridFrame(GRID_ROW.attack, dir)
        : gridFrame(GRID_ROW.stand, dir);
    }
    case "dodge":
    case "jump":
      return gridFrame(GRID_ROW.crouch, dir);
    case "spin": {
      const turn = Math.floor(e.combat.spinFrame / SPIN_TICKS_PER_FACING);
      const col = SPIN_COLUMNS[turn % SPIN_COLUMNS.length] ?? dir;
      return gridFrame(GRID_ROW.stand, col);
    }
    case "hurt":
    case "stagger":
    case "guardBreak":
    case "dizzy":
      return e.kind === "dummy"
        ? GRID_SQUASHED
        : gridFrame(GRID_ROW.crouch, dir);
    case "dead":
      return GRID_SQUASHED;
    case "block":
    case "idle":
      return gridFrame(GRID_ROW.stand, dir);
  }
}

function bruteFrame(e: Entity, tuning: Tuning, clock: number): ActorFrame {
  const flipX = e.facing.x < 0;
  const idle = (frame: number): ActorFrame => ({
    textureKey: ACTOR_KEY.bruteIdle,
    frame,
    flipX,
  });
  switch (e.state) {
    case "move":
      return {
        textureKey: ACTOR_KEY.bruteWalk,
        frame: Math.floor(clock / BRUTE.walkTicks) % BRUTE.walkFrames,
        flipX,
      };
    case "attack": {
      const pose = attackPose(e, tuning);
      if (!pose || inStartup(pose)) return idle(BRUTE.windup);
      return idle(recoveryFrame(pose) < 0 ? BRUTE.strike : BRUTE.settle);
    }
    case "hurt":
      return { textureKey: ACTOR_KEY.bruteHit, frame: BRUTE.recoil, flipX };
    case "stagger":
    case "guardBreak":
    case "dizzy":
    case "dead":
      return { textureKey: ACTOR_KEY.bruteHit, frame: BRUTE.stunned, flipX };
    case "dodge":
    case "jump":
    case "spin":
    case "block":
    case "idle":
      return idle(Math.floor(clock / BRUTE.idleTicks) % BRUTE.idleFrames);
  }
}

/**
 * Which sprite frame an entity shows. Poses come from sim state and sim timers
 * (attack frame, dodge/jump/spin frame, stun), so the strike frame lines up
 * with the live hitbox. Those poses read sim timers that stop during hitstop,
 * so they hold on their own.
 *
 * `tick` only drives the idle breath and the walk cycle: the sim keeps no
 * clock for either. During hitstop it is pinned to 0, so those two cycles snap
 * to their first frame for the freeze rather than holding the one they were on.
 */
export function actorFrame(
  e: Entity,
  tuning: Tuning,
  tick: number,
): ActorFrame {
  const clock = e.combat.hitstop > 0 ? 0 : tick;
  const skin = actorSkin(e);
  const dir = dirColumn(e.facing);
  switch (skin.layout) {
    case "ninja":
      return {
        textureKey: skin.key,
        frame: ninjaFrame(e, tuning, clock, dir),
        flipX: false,
      };
    case "grid":
      return {
        textureKey: skin.key,
        frame: gridFrameFor(e, tuning, clock, dir),
        flipX: false,
      };
    case "brute":
      return bruteFrame(e, tuning, clock);
  }
}
