import type { HitData } from "../data/attacks";
import type { Faction } from "../data/factions";
import type { Tuning } from "../data/tuning";

export type { Faction };

export type Vec2 = { x: number; y: number };

export interface ActionFrame {
  moveX: number;
  moveY: number;
  attack: boolean;
  dodge: boolean;
  block: boolean;
  jump: boolean;
  spin: boolean;
  pause: boolean;
}

/** Row-major: index = row * cols + col. */
export interface Arena {
  cols: number;
  rows: number;
  tileSize: number;
  solid: readonly boolean[];
}

export type EntityState =
  | "idle"
  | "move"
  | "attack"
  | "block"
  | "dodge"
  | "jump"
  | "spin"
  | "dizzy"
  | "stagger"
  | "guardBreak"
  | "hurt"
  | "dead";

export type AttackPhase = "startup" | "active" | "recovery";

/** Per-entity combat timers, all in sim frames. */
export interface CombatState {
  /** Freeze frames left; a frozen entity advances no timers and does not move. */
  hitstop: number;
  /** Frames left in hurt, stagger, guard break or dizzy; a corpse's frames until removal. */
  stun: number;
  hurtIframes: number;
  attackId: string | null;
  attackFrame: number;
  comboIndex: number;
  /** Target ids this attack instance has already hit. */
  attackHits: number[];
  attackCounter: boolean;
  attackBuffer: number;
  dodgeBuffer: number;
  jumpBuffer: number;
  /** Frames since takeoff; runs on through the landing recovery. */
  jumpFrame: number;
  dodgeFrame: number;
  dodgeDir: Vec2;
  dodgeCooldown: number;
  blockFrame: number;
  guard: number;
  guardRegenDelay: number;
  hpRegenDelay: number;
  counterWindow: number;
  spinMeter: number;
  /** Frames spent in the current spin. */
  spinFrame: number;
  /** Frames until a spinner may hit each target id again. */
  spinHitCd: Record<number, number>;
  /** Frames until a hazard source (`ownerId:kind`) may hit this entity again. */
  hazardHitCd: Record<string, number>;
  /** Hits that got through defenses and did damage; a run-summary stat. */
  hitsTaken: number;
  /** Px/s impulse that decays each tick; still collides with walls. */
  knock: Vec2;
}

export type MobMode =
  | "idle"
  | "chase"
  | "reposition"
  | "circle"
  | "telegraph"
  | "attack"
  | "recover";

/** Brain state of a mob; the body's state machine stays in Entity.state. */
export interface MobAi {
  mode: MobMode;
  /** Reaction delay, token retry or post-attack cooldown, depending on mode. */
  timer: number;
  /** Frames left to start an attack before a held token is given back. */
  patience: number;
  /** Circling direction, 1 or -1. */
  strafe: number;
  /** Attack id chosen for the next swing; null uses the kit's first attack. */
  move: string | null;
  /** Whether the target was spinning when `move` was picked. */
  moveSpin: boolean;
}

export interface Entity {
  id: number;
  /** Which driver feeds intents: input, a script, or the mob AI. */
  kind: "player" | "dummy" | "mob";
  mobType: string | null;
  ai: MobAi | null;
  /** Key into tuning.elements whose spin modifiers this entity gets; null for none. */
  element: string | null;
  faction: Faction;
  kitId: string;
  /** Feet center on the ground plane. */
  pos: Vec2;
  z: number;
  /** Self-propelled velocity in px/s; knockback lives in combat.knock. */
  vel: Vec2;
  /** Cardinal unit vector. */
  facing: Vec2;
  feet: { w: number; h: number };
  bodyHeight: number;
  hp: number;
  maxHp: number;
  state: EntityState;
  combat: CombatState;
  /** Frames until the scripted dummy starts its next swing. */
  aiTimer: number;
}

export interface Projectile {
  id: number;
  /** Key into tuning.projectiles. */
  kind: string;
  ownerId: number;
  faction: Faction;
  pos: Vec2;
  /** Px/s. */
  vel: Vec2;
  /** Frames until it expires. */
  life: number;
  /** Target ids it has passed through (a perfect dodge). */
  spent: number[];
  deflected: boolean;
}

/** Ground zone that hits hostiles standing in it; shared by trails and bursts. */
export interface Hazard {
  id: number;
  /** The spin modifier that made it; with the owner, keys the target's re-hit timer. */
  kind: string;
  ownerId: number;
  faction: Faction;
  pos: Vec2;
  /** Half-extent of the square hit area. */
  radius: number;
  /** Frames left; it hits on the tick it spawns and expires when this runs out. */
  life: number;
  maxLife: number;
  hit: HitData;
  /** Frames before the same source may hit the same target again. */
  hitInterval: number;
  /** Whether a hit interrupts the target; false makes it pure damage over time. */
  flinch: boolean;
  /** "patch" is a lingering zone; "ring" is a burst drawn expanding. */
  style: "patch" | "ring";
  color: number;
}

export type FlowPhase =
  | "sandbox"
  | "intro"
  | "wave"
  | "breather"
  | "boss"
  | "victory"
  | "defeat";

/** The run's state machine; "sandbox" is inert so debug play and scripted tests are untouched. */
export interface ArenaFlow {
  phase: FlowPhase;
  /** 1-based index of the wave in play or last played; 0 before the first. */
  wave: number;
  wavesCleared: number;
  /** Ticks spent in the current phase. */
  phaseTicks: number;
  /** Ticks from the start of the run to its end. */
  runTicks: number;
}

export interface TokenHold {
  entityId: number;
  weight: number;
}

export interface SimState {
  tick: number;
  rngState: number;
  nextId: number;
  arena: Arena;
  entities: Entity[];
  projectiles: Projectile[];
  hazards: Hazard[];
  arenaFlow: ArenaFlow;
  /** Attack tokens currently held; capacity comes from tuning. */
  tokens: TokenHold[];
  /** The input-driven entity has died; the scene owns what happens next. */
  defeated: boolean;
  tuning: Tuning;
  /** Last tick's input, so presses are derived as rising edges inside the sim. */
  prevInput: ActionFrame;
}
