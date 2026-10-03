/**
 * The one serialisable store for story flags and meters. Key names follow
 * docs/PRD.md §6 exactly; this file covers the Chapter 1 subset and the shared
 * meters, and a new key is added here in the same change that first uses it.
 */

/** `ch{N}_s{M}` as in the Bible, e.g. `ch1_s6`. */
export type SceneId = `ch${number}_s${number}`;

const SCENE_ID_PATTERN = /^ch[1-9]\d*_s[1-9]\d*$/;

export function isSceneId(value: string): value is SceneId {
  return SCENE_ID_PATTERN.test(value);
}

export const NINJA_IDS = ["kai", "jay", "zane", "cole"] as const;
export type NinjaId = (typeof NINJA_IDS)[number];

/** Canon Golden Weapons (Bible §4). */
export const WEAPON_IDS = [
  "scythe_of_quakes",
  "sword_of_fire",
  "nunchucks_of_lightning",
  "shurikens_of_ice",
] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

export const GARMADON_CHOICES = ["chase", "stay"] as const;
export type GarmadonChoice = (typeof GARMADON_CHOICES)[number];

/** Canon events that must fire in every branch (PRD §7). */
export const FIXED_POINT_IDS = [
  "ch1_weapons_gathered",
  "ch1_garmadon_escapes",
] as const;
export type FixedPointId = (typeof FIXED_POINT_IDS)[number];

export const BOOL_FLAG_KEYS = ["dragon_ignored_you", "wu_knows_blade"] as const;
export type BoolFlagKey = (typeof BOOL_FLAG_KEYS)[number];

export interface WeaponGuard {
  weapon: WeaponId;
  ninja: NinjaId;
}

/** Meter ranges; the reducer clamps to them so no effect can leave the range. */
export const LIMITS = {
  corruption: { min: 0, max: 100 },
  resonance: { min: 0, max: 4 },
  // PRD Q5 default: 0-10 with perks at 3 and 6.
  trust: { min: 0, max: 10 },
  // Not set by the PRD; same scale as trust, floor 0 until a scene needs worse.
  villageStanding: { min: 0, max: 10 },
  ghostLimit: { min: 1, max: 2 },
  bladeStage: { min: 0, max: 3 },
} as const;

export interface StoryState {
  chapter: number;
  /** The scene to play next, or being played; null before the story starts or after it ends. */
  scene: SceneId | null;

  dragon_ignored_you: boolean;
  wu_knows_blade: boolean;
  ch1_sparring_partner: NinjaId | null;
  ch1_weapon_guard: WeaponGuard | null;
  ch1_garmadon_choice: GarmadonChoice | null;

  corruption: number;
  resonance: number;
  ghost_limit: number;
  trust_kai: number;
  trust_jay: number;
  trust_zane: number;
  trust_cole: number;
  village_standing: number;
  blade_stage: number;

  rumours: string[];
  unlocks: string[];
  fixed_points_fired: FixedPointId[];
}

export function createStoryState(): StoryState {
  return {
    chapter: 1,
    scene: null,
    dragon_ignored_you: false,
    wu_knows_blade: false,
    ch1_sparring_partner: null,
    ch1_weapon_guard: null,
    ch1_garmadon_choice: null,
    corruption: 0,
    resonance: 0,
    ghost_limit: 1,
    trust_kai: 0,
    trust_jay: 0,
    trust_zane: 0,
    trust_cole: 0,
    village_standing: 0,
    blade_stage: 0,
    rumours: [],
    unlocks: [],
    fixed_points_fired: [],
  };
}

export type TrustKey = `trust_${NinjaId}`;
export const trustKey = (ninja: NinjaId): TrustKey => `trust_${ninja}`;
export const trustOf = (s: StoryState, ninja: NinjaId): number =>
  s[trustKey(ninja)];
