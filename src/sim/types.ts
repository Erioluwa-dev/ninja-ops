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
  | "stagger"
  | "guardBreak"
  | "hurt";

export type AttackPhase = "startup" | "active" | "recovery";

/** Per-entity combat timers, all in sim frames. */
export interface CombatState {
  /** Freeze frames left; a frozen entity advances no timers and does not move. */
  hitstop: number;
  /** Frames left in hurt, stagger or guard break. */
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
  dodgeFrame: number;
  dodgeDir: Vec2;
  dodgeCooldown: number;
  blockFrame: number;
  guard: number;
  guardRegenDelay: number;
  hpRegenDelay: number;
  counterWindow: number;
  spinMeter: number;
  /** Px/s impulse that decays each tick; still collides with walls. */
  knock: Vec2;
}

export interface Entity {
  id: number;
  kind: "player" | "dummy";
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

export interface SimState {
  tick: number;
  rngState: number;
  arena: Arena;
  entities: Entity[];
  tuning: Tuning;
  /** Last tick's input, so presses are derived as rising edges inside the sim. */
  prevInput: ActionFrame;
}
