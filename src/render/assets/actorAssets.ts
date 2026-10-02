import { assetUrl } from "./assetUrl";
import type { AssetEntry } from "./types";

export const ACTOR_KEY = {
  player: "actor-player",
  dummy: "actor-dummy",
  melee: "actor-mob-melee",
  ranged: "actor-mob-ranged",
  sweeper: "actor-mob-sweeper",
  bruteIdle: "actor-brute-idle",
  bruteWalk: "actor-brute-walk",
  bruteHit: "actor-brute-hit",
} as const;

/**
 * The 16x16 character sheets share one layout: 4 columns are the facings (down,
 * up, left, right), rows 0-3 walk (rows 0 and 2 are the standing pose), row 4
 * attack, row 5 jump, row 6 dead, item, special 1, special 2 (no facing). The
 * player is the richer 32x32 "animated" sheet and the brute is three strips of
 * 50x50 frames with no facings; the exact frame tables are in the asset picks.
 */
export const ACTOR_ASSETS = [
  {
    type: "spritesheet",
    key: ACTOR_KEY.player,
    url: assetUrl("actors/player-ninja-green.png"),
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    type: "spritesheet",
    key: ACTOR_KEY.dummy,
    url: assetUrl("actors/dummy-gold-statue.png"),
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    type: "spritesheet",
    key: ACTOR_KEY.melee,
    url: assetUrl("actors/mob-melee-tengu.png"),
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    type: "spritesheet",
    key: ACTOR_KEY.ranged,
    url: assetUrl("actors/mob-ranged-ninja-dark.png"),
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    type: "spritesheet",
    key: ACTOR_KEY.sweeper,
    url: assetUrl("actors/mob-sweeper-boxer-red.png"),
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    type: "spritesheet",
    key: ACTOR_KEY.bruteIdle,
    url: assetUrl("actors/boss-brute-demon-cyclops-idle.png"),
    frameWidth: 50,
    frameHeight: 50,
  },
  {
    type: "spritesheet",
    key: ACTOR_KEY.bruteWalk,
    url: assetUrl("actors/boss-brute-demon-cyclops-walk.png"),
    frameWidth: 50,
    frameHeight: 50,
  },
  {
    type: "spritesheet",
    key: ACTOR_KEY.bruteHit,
    url: assetUrl("actors/boss-brute-demon-cyclops-hit.png"),
    frameWidth: 50,
    frameHeight: 50,
  },
] as const satisfies readonly AssetEntry[];
