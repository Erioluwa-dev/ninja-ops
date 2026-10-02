import {
  attackPhase,
  currentAttack,
  type Entity,
  isArmored,
  type SimState,
} from "../sim";
import { actorSkin } from "./actorFrames";
import { FLASH, SWEEP_TELEGRAPH, TELEGRAPH, UNBLOCKABLE } from "./palette";
import { blinkOn } from "./util";

export const STAGGER = 0xffe060;
export const GUARD_BREAK = 0xa060ff;
export const ARMOR = 0xc8c8d8;

/** What the colored rectangles used to say, as numbers a sprite can show. */
export interface ActorCue {
  /** Solid wash laid over the sprite; null for none. */
  fill: number | null;
  /** Strength of the wash. Hitstop and blink frames go fully solid. */
  fillAlpha: number;
  /** Whole-body opacity (dodge, i-frame blink, death fade). */
  alpha: number;
  armored: boolean;
  /** Outline colour while a telegraphed swing winds up; null otherwise. */
  ring: number | null;
  /** Integer px the sprite is squashed (+) or stretched (-) at its feet. */
  squash: number;
  /** Px the sprite is pushed along its facing. */
  lunge: number;
}

const WASH = 0.7;
const SOLID = 1;
const UNBLOCKABLE_DARK = 0x200000;
const DARK_BEAT = 0.8;

function isStunned(e: Entity): boolean {
  return (
    e.state === "hurt" || e.state === "stagger" || e.state === "guardBreak"
  );
}

function wash(
  state: SimState,
  e: Entity,
): { fill: number; alpha: number } | null {
  if (e.combat.hitstop > 0) return { fill: FLASH, alpha: SOLID };
  if (isStunned(e)) {
    if (blinkOn(state.tick, 2)) return { fill: FLASH, alpha: SOLID };
    if (e.state === "stagger") return { fill: STAGGER, alpha: WASH };
    if (e.state === "guardBreak") return { fill: GUARD_BREAK, alpha: WASH };
    return null;
  }
  const telegraph = telegraphOf(state, e);
  if (!telegraph) return null;
  if (telegraph.unblockable) {
    // The off-beat is dark, not white: white is the hit flash, which on the
    // red brute would read as the same colour change.
    return blinkOn(state.tick, 3)
      ? { fill: UNBLOCKABLE, alpha: SOLID }
      : { fill: UNBLOCKABLE_DARK, alpha: DARK_BEAT };
  }
  return { fill: telegraph.color, alpha: WASH };
}

/** The colour of a telegraphed swing that is still winding up, if e is in one. */
function telegraphOf(
  state: SimState,
  e: Entity,
): { color: number; unblockable: boolean } | null {
  const attack = currentAttack(e, state.tuning);
  if (
    !attack?.telegraph ||
    attackPhase(attack, e.combat.attackFrame) !== "startup"
  ) {
    return null;
  }
  if (attack.unblockable) return { color: UNBLOCKABLE, unblockable: true };
  return {
    color: attack.ground ? SWEEP_TELEGRAPH : TELEGRAPH,
    unblockable: false,
  };
}

function bodyAlpha(state: SimState, e: Entity): number {
  if (e.state === "dodge") return 0.45;
  if (e.state === "dead") {
    const total = Math.max(1, state.tuning.combat.death.frames);
    return e.combat.stun > 0 ? (0.8 * e.combat.stun) / total : 0.3;
  }
  if (!isStunned(e) && e.combat.hurtIframes > 0 && blinkOn(state.tick, 3)) {
    return 0.55;
  }
  return 1;
}

/**
 * Windup squash and strike lunge for swings the sheet has no frames for: the
 * brute has none at all and the 16px mobs have one pose, so the body itself
 * has to crouch before a telegraphed hit and push forward when it lands.
 */
function bodyMotion(
  state: SimState,
  e: Entity,
): { squash: number; lunge: number } {
  const attack = currentAttack(e, state.tuning);
  if (!attack?.telegraph) return { squash: 0, lunge: 0 };
  const skin = actorSkin(e);
  const frame = e.combat.attackFrame;
  const phase = attackPhase(attack, frame);
  if (phase === "startup") {
    const progress = frame / Math.max(1, attack.startup);
    return { squash: Math.round(progress * skin.windupSquash), lunge: 0 };
  }
  if (phase === "active") return { squash: -1, lunge: skin.lunge };
  return { squash: 0, lunge: 0 };
}

export function actorCue(state: SimState, e: Entity): ActorCue {
  const w = wash(state, e);
  const { squash, lunge } = bodyMotion(state, e);
  return {
    fill: w?.fill ?? null,
    fillAlpha: w?.alpha ?? 0,
    alpha: bodyAlpha(state, e),
    armored: isArmored(e, state.tuning),
    ring: telegraphOf(state, e)?.color ?? null,
    squash,
    lunge,
  };
}
