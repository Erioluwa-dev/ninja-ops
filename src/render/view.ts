import type { Entity, SimState } from "../sim";

/** Everything a view needs for one render; views read it and never write. */
export interface RenderFrame {
  readonly state: SimState;
  /** Entities back to front (depthOrder), so the index is a stable draw rank. */
  readonly ordered: readonly Entity[];
  readonly player: Entity | undefined;
}

/**
 * One slice of the scene (floor, bodies, effects, HUD). A view owns the game
 * objects it creates and the depth band they live in, and rebuilds or
 * repositions them from the snapshot each `draw`.
 */
export interface RenderView {
  draw(frame: RenderFrame): void;
  destroy(): void;
}
