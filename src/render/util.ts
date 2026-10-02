import type Phaser from "phaser";
import type { Entity, SimState } from "../sim";

export const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 2,
};

// Flashing every other pair of ticks reads as a blink at 60 Hz without strobing.
export const blinkOn = (tick: number, period: number): boolean =>
  Math.floor(tick / period) % 2 === 0;

/** Screen y of the top of an entity's body, accounting for jump height. */
export const bodyTop = (e: Entity): number =>
  e.pos.y + e.feet.h / 2 - e.z - e.bodyHeight;

export const isBoss = (state: SimState, e: Entity): boolean =>
  e.mobType !== null && state.tuning.mobs[e.mobType]?.bossBar === true;
