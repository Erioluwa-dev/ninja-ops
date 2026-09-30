export { isHostile } from "../data/factions";
export { isSolidTile, tileCenter } from "./arena";
export { feetBox, moveAndCollide } from "./collision";
export { depthOrder } from "./depth";
export { nextFloat } from "./rng";
export { createSim, step } from "./step";
export { createFixedStepper, FIXED_DT_MS, SIM_HZ } from "./timing";
export type {
  ActionFrame,
  Arena,
  Entity,
  Faction,
  SimState,
  Vec2,
} from "./types";
