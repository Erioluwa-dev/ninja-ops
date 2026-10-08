/**
 * Draw bands, lowest first. Every view puts its game objects in its own band,
 * so a sprite can sort by depth instead of by the order it was drawn in.
 * Objects at the same depth sort by creation order.
 */
export const DEPTH = {
  floor: 0,
  /** Hazards and telegraphs: on the ground, under every body. */
  groundFx: 100,
  /** Actors and the wall tiles that can stand in front of them; see actorDepth. */
  actors: 200,
  /** Spin, dizzy, projectiles: above every body. */
  overheadFx: 1300,
  hpBars: 1400,
  debug: 1500,
  hud: 1600,
  hudText: 1610,
  /** The dim backdrop behind the intro and result panels. */
  overlay: 2500,
  panels: 3000,
} as const;

/** Depth units reserved inside the actor band for y-sorting; covers the tallest hub map (576 px) with room to grow. */
export const ACTOR_DEPTH_SPAN = 1024;

/**
 * Depth of anything standing on the ground at feet-center `y`; larger y is
 * nearer the camera. `id` breaks exact ties the same way depthOrder does.
 */
export function actorDepth(y: number, id = 0): number {
  const offset = Math.min(Math.max(y, 0), ACTOR_DEPTH_SPAN - 1) + id * 1e-6;
  return DEPTH.actors + offset;
}

/**
 * Depth of a wall tile. One with open floor to its south sorts as if standing
 * on its bottom edge, so an actor below a pillar draws over it and an actor
 * above it draws behind it. One with a wall to its south is part of a face
 * that no actor can stand behind, so it stays under every actor; y-sorting it
 * would cut wide sprites at the tile seams along a side wall.
 */
export function wallDepth(
  row: number,
  tileSize: number,
  southOpen: boolean,
): number {
  return southOpen ? actorDepth((row + 1) * tileSize) : DEPTH.actors;
}
