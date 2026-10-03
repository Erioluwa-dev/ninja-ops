import type {
  BoolFlagKey,
  GarmadonChoice,
  NinjaId,
  StoryState,
  WeaponId,
} from "./state";
import { trustOf } from "./state";

/** A test on the story state, used to show, enable or select content. */
export type Condition =
  | { kind: "flag"; key: BoolFlagKey; value: boolean }
  | { kind: "sparringPartner"; ninja: NinjaId }
  | { kind: "garmadonChoice"; choice: GarmadonChoice }
  | { kind: "weaponGuard"; ninja?: NinjaId; weapon?: WeaponId }
  | { kind: "trust"; ninja: NinjaId; min: number }
  | { kind: "villageStanding"; min: number }
  | { kind: "corruption"; atLeast?: number; atMost?: number }
  | { kind: "unlocked"; id: string }
  | { kind: "not"; of: Condition }
  | { kind: "all"; of: readonly Condition[] }
  | { kind: "any"; of: readonly Condition[] };

export function holds(state: StoryState, c: Condition): boolean {
  switch (c.kind) {
    case "flag":
      return state[c.key] === c.value;
    case "sparringPartner":
      return state.ch1_sparring_partner === c.ninja;
    case "garmadonChoice":
      return state.ch1_garmadon_choice === c.choice;
    case "weaponGuard": {
      const guard = state.ch1_weapon_guard;
      if (!guard) return false;
      return (
        (c.ninja === undefined || guard.ninja === c.ninja) &&
        (c.weapon === undefined || guard.weapon === c.weapon)
      );
    }
    case "trust":
      return trustOf(state, c.ninja) >= c.min;
    case "villageStanding":
      return state.village_standing >= c.min;
    case "corruption":
      return (
        (c.atLeast === undefined || state.corruption >= c.atLeast) &&
        (c.atMost === undefined || state.corruption <= c.atMost)
      );
    case "unlocked":
      return state.unlocks.includes(c.id);
    case "not":
      return !holds(state, c.of);
    case "all":
      return c.of.every((inner) => holds(state, inner));
    case "any":
      return c.of.some((inner) => holds(state, inner));
  }
}
