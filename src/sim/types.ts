import type { Faction } from "../data/factions";

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

export interface Entity {
  id: number;
  kind: "player" | "dummy";
  faction: Faction;
  kitId: string;
  /** Feet center on the ground plane. */
  pos: Vec2;
  z: number;
  /** Pixels per second. */
  vel: Vec2;
  feet: { w: number; h: number };
  bodyHeight: number;
  state: string;
}

export interface SimState {
  tick: number;
  rngState: number;
  arena: Arena;
  entities: Entity[];
}
