import { ECHO, ECHO_MOVE_IDS, type EchoMoveId } from "../data/echo";
import { TRUST_PERKS, TRUST_TIERS } from "../data/perks";
import type { EncounterContext } from "../sim/encounter";
import type { NinjaId, StoryState } from "./state";
import { trustOf } from "./state";

/** 0 below the first tier, 1 at the first, 2 at the second. */
export function perkLevel(trust: number): number {
  return TRUST_TIERS.filter((tier) => trust >= tier).length;
}

const ALLY_MOB: Record<NinjaId, string> = {
  kai: "allyKai",
  jay: "allyJay",
  zane: "allyZane",
  cole: "allyCole",
};

export const allyMobType = (ninja: NinjaId): string => ALLY_MOB[ninja];

function unlockedMoves(story: StoryState): EchoMoveId[] {
  return ECHO_MOVE_IDS.filter((id) => story.unlocks.includes(id));
}

export function encounterContext(
  story: StoryState,
  guardAlly: boolean,
): EncounterContext {
  const allies: string[] = [];
  if (guardAlly && story.ch1_weapon_guard) {
    allies.push(allyMobType(story.ch1_weapon_guard.ninja));
  }
  return {
    echoMoves: unlockedMoves(story),
    resonance: story.resonance,
    ghostLimit: story.ghost_limit,
    allyMobTypes: allies,
    twinStrikeFlicker:
      perkLevel(trustOf(story, "kai")) >= 1 &&
      TRUST_PERKS.kai.twinStrikeFlicker,
    rewindWindowFrames:
      perkLevel(trustOf(story, "jay")) >= 1
        ? TRUST_PERKS.jay.rewindWindowFrames
        : ECHO.rewindStep.windowFrames,
  };
}
