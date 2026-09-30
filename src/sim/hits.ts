import type { AttackData } from "../data/attacks";
import { canDamage } from "../data/factions";
import { getKit, type Tuning } from "../data/tuning";
import { activeHitbox, currentAttack } from "./attack";
import { boxesOverlap, feetBox } from "./collision";
import { enterStun } from "./states";
import type { Entity, SimState } from "./types";

interface Contact {
  attacker: Entity;
  target: Entity;
  attack: AttackData;
}

function isFrontal(
  target: Entity,
  attacker: Entity,
  frontDot: number,
): boolean {
  const dx = attacker.pos.x - target.pos.x;
  const dy = attacker.pos.y - target.pos.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return true;
  return (target.facing.x * dx + target.facing.y * dy) / len > frontDot;
}

function freeze(a: Entity, b: Entity, frames: number): void {
  a.combat.hitstop = Math.max(a.combat.hitstop, frames);
  b.combat.hitstop = Math.max(b.combat.hitstop, frames);
}

function openCounterWindow(e: Entity, tuning: Tuning): void {
  e.combat.counterWindow = tuning.combat.counter.window;
}

function applyDamage(
  { attacker, target, attack }: Contact,
  tuning: Tuning,
): void {
  const { counter } = tuning.combat;
  const kit = getKit(tuning, target.kitId);
  const isCounter = attacker.combat.attackCounter;
  const damage =
    isCounter && counter.bonusDamage
      ? attack.damage * counter.damageMultiplier
      : attack.damage;

  target.hp = Math.max(kit.hpFloor, target.hp - damage);
  target.combat.hpRegenDelay = kit.regenDelay;
  target.combat.knock = {
    x: attacker.facing.x * attack.knockback,
    y: attacker.facing.y * attack.knockback,
  };
  if (isCounter && counter.stagger) {
    enterStun(target, "stagger", counter.staggerFrames);
  } else {
    enterStun(target, "hurt", kit.hurtStun);
  }
  target.combat.hurtIframes = kit.hurtIframes;
  // Spent on the first hit that connects so one counter can't multiply.
  if (isCounter) attacker.combat.attackCounter = false;
}

function resolveContact(contact: Contact, tuning: Tuning): void {
  const { attacker, target, attack } = contact;
  const { dodge, block, parry, meters } = tuning.combat;
  const tc = target.combat;

  if (target.state === "dodge" && tc.dodgeFrame < dodge.iframes) {
    // Only a perfect dodge marks the hit as spent; an ordinary dodge leaves the
    // attack live so a long active window can still catch the dodger later.
    if (tc.dodgeFrame < dodge.perfectWindow) {
      attacker.combat.attackHits.push(target.id);
      openCounterWindow(target, tuning);
      tc.spinMeter = Math.min(
        meters.spinMax,
        tc.spinMeter + meters.perfectDodgeSpinGain,
      );
    }
    return;
  }

  if (tc.hurtIframes > 0) return;

  attacker.combat.attackHits.push(target.id);

  if (
    target.state === "block" &&
    !attack.unblockable &&
    isFrontal(target, attacker, block.frontDot)
  ) {
    if (tc.blockFrame < block.perfectWindow) {
      openCounterWindow(target, tuning);
      enterStun(attacker, "stagger", parry.staggerFrames);
      freeze(attacker, target, parry.hitstop);
      return;
    }
    tc.guard = Math.max(0, tc.guard - attack.guardDamage);
    tc.guardRegenDelay = block.regenDelay;
    tc.knock = {
      x: attacker.facing.x * attack.knockback * block.pushbackScale,
      y: attacker.facing.y * attack.knockback * block.pushbackScale,
    };
    freeze(attacker, target, attack.hitstop);
    if (tc.guard <= 0) enterStun(target, "guardBreak", block.guardBreakStun);
    return;
  }

  applyDamage(contact, tuning);
  freeze(attacker, target, attack.hitstop);
}

/** Two-phase so simultaneous swings trade instead of favouring entity order. */
export function resolveHits(state: SimState): void {
  const { tuning, entities } = state;
  const contacts: Contact[] = [];

  for (const attacker of entities) {
    const attack = currentAttack(attacker, tuning);
    const box = activeHitbox(attacker, tuning);
    if (!attack || !box) continue;
    for (const target of entities) {
      if (target === attacker) continue;
      if (!canDamage(attacker.faction, target.faction)) continue;
      if (attacker.combat.attackHits.includes(target.id)) continue;
      if (boxesOverlap(box, feetBox(target))) {
        contacts.push({ attacker, target, attack });
      }
    }
  }

  for (const contact of contacts) resolveContact(contact, tuning);
}
