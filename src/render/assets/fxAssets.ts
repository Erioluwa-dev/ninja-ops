import { assetUrl } from "./assetUrl";
import type { AssetEntry } from "./types";

export const FX_KEY = {
  slashCircularLarge: "fx-slash-circular-large",
  fireFlicker: "fx-fire-flicker",
  rockSpike: "fx-rock-spike",
  fireball: "fx-fireball",
  energyBall: "fx-energy-ball",
} as const;

/** Every sheet is one row of frames played left to right; FxView picks the frame from sim state. */
export const FX_ASSETS = [
  // Spin: 6 frames of 63x55 of a slash circling the spinner, fitted to the spin box.
  {
    type: "spritesheet",
    key: FX_KEY.slashCircularLarge,
    url: assetUrl("fx/slash-circular-large.png"),
    frameWidth: 63,
    frameHeight: 55,
  },
  // Fire trail: 12 frames of 8x12; ignite, loop 1-7, shrink 8-11.
  {
    type: "spritesheet",
    key: FX_KEY.fireFlicker,
    url: assetUrl("fx/fire-flicker.png"),
    frameWidth: 8,
    frameHeight: 12,
  },
  // Earth shockwave: 10 frames of 54x48 of spikes rising and crumbling.
  {
    type: "spritesheet",
    key: FX_KEY.rockSpike,
    url: assetUrl("fx/rock-spike.png"),
    frameWidth: 54,
    frameHeight: 48,
  },
  // Projectiles: 4-frame loops; the cyan ball reads as "turned friendly".
  {
    type: "spritesheet",
    key: FX_KEY.fireball,
    url: assetUrl("fx/fireball.png"),
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    type: "spritesheet",
    key: FX_KEY.energyBall,
    url: assetUrl("fx/energy-ball.png"),
    frameWidth: 16,
    frameHeight: 16,
  },
] as const satisfies readonly AssetEntry[];
