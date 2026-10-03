import {
  type BoolFlagKey,
  type FixedPointId,
  type GarmadonChoice,
  LIMITS,
  type NinjaId,
  type StoryState,
  trustKey,
  trustOf,
  type WeaponId,
} from "./state";

/** What a scene or choice does to the story state; applied by `applyEffect`. */
export type Effect =
  | { kind: "setFlag"; key: BoolFlagKey; value: boolean }
  | { kind: "setSparringPartner"; ninja: NinjaId }
  | { kind: "setWeaponGuard"; weapon: WeaponId; ninja: NinjaId }
  | { kind: "setGarmadonChoice"; choice: GarmadonChoice }
  | { kind: "trust"; ninja: NinjaId; delta: number }
  | { kind: "villageStanding"; delta: number }
  | { kind: "corruption"; delta: number }
  | { kind: "resonance"; delta: number }
  | { kind: "ghostLimit"; value: number }
  | { kind: "bladeStage"; stage: number }
  | { kind: "unlock"; id: string }
  | { kind: "rumour"; id: string; present: boolean }
  | { kind: "fixedPoint"; id: FixedPointId };

const clamp = (v: number, range: { min: number; max: number }): number =>
  Math.min(range.max, Math.max(range.min, v));

const withItem = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? [...list] : [...list, item];

/** Pure: returns a new state and never mutates its input. */
export function applyEffect(state: StoryState, effect: Effect): StoryState {
  switch (effect.kind) {
    case "setFlag":
      return { ...state, [effect.key]: effect.value };
    case "setSparringPartner":
      return { ...state, ch1_sparring_partner: effect.ninja };
    case "setWeaponGuard":
      return {
        ...state,
        ch1_weapon_guard: { weapon: effect.weapon, ninja: effect.ninja },
      };
    case "setGarmadonChoice":
      return { ...state, ch1_garmadon_choice: effect.choice };
    case "trust":
      return {
        ...state,
        [trustKey(effect.ninja)]: clamp(
          trustOf(state, effect.ninja) + effect.delta,
          LIMITS.trust,
        ),
      };
    case "villageStanding":
      return {
        ...state,
        village_standing: clamp(
          state.village_standing + effect.delta,
          LIMITS.villageStanding,
        ),
      };
    case "corruption":
      return {
        ...state,
        corruption: clamp(state.corruption + effect.delta, LIMITS.corruption),
      };
    case "resonance":
      return {
        ...state,
        resonance: clamp(state.resonance + effect.delta, LIMITS.resonance),
      };
    case "ghostLimit":
      return { ...state, ghost_limit: clamp(effect.value, LIMITS.ghostLimit) };
    case "bladeStage":
      // Stages only go up: no scene un-forges the blade.
      return {
        ...state,
        blade_stage: Math.max(
          state.blade_stage,
          clamp(effect.stage, LIMITS.bladeStage),
        ),
      };
    case "unlock":
      return { ...state, unlocks: withItem(state.unlocks, effect.id) };
    case "rumour":
      return {
        ...state,
        rumours: effect.present
          ? withItem(state.rumours, effect.id)
          : state.rumours.filter((r) => r !== effect.id),
      };
    case "fixedPoint":
      return {
        ...state,
        fixed_points_fired: withItem(state.fixed_points_fired, effect.id),
      };
  }
}

export function applyEffects(
  state: StoryState,
  effects: readonly Effect[],
): StoryState {
  return effects.reduce(applyEffect, state);
}
