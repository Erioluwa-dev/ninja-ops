import type { AttackData, HitData } from "../data/attacks";
import { canDamage } from "../data/factions";
import { getAttack, getKit, type Tuning } from "../data/tuning";
import { armorScale } from "./armor";
import { activeHitbox, currentAttack } from "./attack";
import { boxesOverlap, feetBox } from "./collision";
import { onGhostHit, onPerfectDodge, registerLandedHit } from "./echo";
import { hazardBox, hazardKey } from "./hazards";
import { isAirborne } from "./jump";
import { projectileBox } from "./projectiles";
import { spinBox, spinDataOf } from "./spin";
import { enterDead, enterStun } from "./states";
import type { Entity, SimState, Vec2 } from "./types";
import { normalized } from "./vec";

export type HitOutcome = "dodged" | "iframes" | "parried" | "blocked" | "hit";

interface Contact {
  /** The fighter who swung or spun; null for a projectile. */
  attacker: Entity | null;
  target: Entity;
  hit: HitData;
  /** The attack behind the hit; null for a spin. */
  attack: AttackData | null;
  fromSpin: boolean;
  /** Where the blow comes from, for the block-facing check. */
  origin: Vec2;
  knockDir: Vec2;
  /** Spin hits skip the parry so spin keeps beating block. */
  parryable: boolean;
  /** Only normal attacks feed the spin meter, or a spin could sustain itself. */
  feedsSpin: boolean;
  /** Hazards are not attacks, so dodging into one earns no perfect-dodge reward. */
  perfectable: boolean;
  /** False for damage over time: it hurts without interrupting the target. */
  flinch: boolean;
  /** Marks this source as done with the target, or starts its re-hit timer. */
  spend: () => void;
}

function isFrontal(target: Entity, origin: Vec2, frontDot: number): boolean {
  const dx = origin.x - target.pos.x;
  const dy = origin.y - target.pos.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return true;
  return (target.facing.x * dx + target.facing.y * dy) / len > frontDot;
}

function freeze(a: Entity | null, b: Entity, frames: number): void {
  if (a) a.combat.hitstop = Math.max(a.combat.hitstop, frames);
  b.combat.hitstop = Math.max(b.combat.hitstop, frames);
}

function openCounterWindow(e: Entity, tuning: Tuning): void {
  e.combat.counterWindow = tuning.combat.counter.window;
}

function applyDamage(contact: Contact, state: SimState): void {
  const { tuning } = state;
  const { attacker, target, hit, knockDir } = contact;
  const { counter, meters } = tuning.combat;
  const kit = getKit(tuning, target.kitId);
  const isCounter = attacker?.combat.attackCounter ?? false;
  const armor = armorScale(target, contact.fromSpin, tuning);
  const counterDamage =
    isCounter && counter.bonusDamage
      ? hit.damage * counter.damageMultiplier
      : hit.damage;
  const baseDamage =
    attacker?.kind === "ghost"
      ? counterDamage * tuning.echo.ghostDamageScale
      : counterDamage;

  // The floor covers every source, so a new damage type cannot kill a canon
  // villain by accident; only `applyTeamFinisher` goes around it.
  const floor = target.canonVillain ? Math.max(kit.hpFloor, 1) : kit.hpFloor;
  target.hp = Math.max(floor, target.hp - baseDamage * (armor ?? 1));
  target.combat.hpRegenDelay = kit.regenDelay;
  target.combat.hitsTaken += 1;
  // Super armor takes the damage but shrugs off the knockback and the flinch.
  if (armor === null && contact.flinch) {
    const spinBreak = contact.attack?.spinBreakStun ?? 0;
    const wasSpinning = target.state === "spin";
    target.combat.knock = {
      x: knockDir.x * hit.knockback,
      y: knockDir.y * hit.knockback,
    };
    if (wasSpinning && spinBreak > 0) {
      enterStun(target, "dizzy", spinBreak);
    } else if (isCounter && counter.stagger) {
      enterStun(target, "stagger", counter.staggerFrames);
    } else {
      enterStun(target, "hurt", kit.hurtStun);
    }
    target.combat.hurtIframes = kit.hurtIframes;
  }
  // Spent on the first hit that connects so one counter can't multiply.
  if (attacker && isCounter) attacker.combat.attackCounter = false;
  if (attacker && contact.feedsSpin && getKit(tuning, attacker.kitId).spin) {
    attacker.combat.spinMeter = Math.min(
      meters.spinMax,
      attacker.combat.spinMeter + meters.spinGainPerHit,
    );
  }
  if (attacker?.kind === "player") registerLandedHit(state);
  if (target.hp <= 0) {
    enterDead(target, tuning);
    if (target.kind === "ghost") onGhostHit(state);
  }
}

function resolveContact(contact: Contact, state: SimState): HitOutcome {
  const { tuning } = state;
  const { attacker, target, hit, origin } = contact;
  const { dodge, block, parry, meters } = tuning.combat;
  const tc = target.combat;

  if (target.state === "dodge" && tc.dodgeFrame < dodge.iframes) {
    // Only a perfect dodge marks the hit as spent; an ordinary dodge leaves the
    // attack live so a long active window can still catch the dodger later. A
    // sweep never counts as perfect, or a well-timed dodge would beat it.
    if (
      contact.perfectable &&
      !contact.attack?.sweep &&
      tc.dodgeFrame < dodge.perfectWindow
    ) {
      contact.spend();
      openCounterWindow(target, tuning);
      if (target.kind === "player") onPerfectDodge(state);
      tc.spinMeter = Math.min(
        meters.spinMax,
        tc.spinMeter + meters.perfectDodgeSpinGain,
      );
    }
    return "dodged";
  }

  if (tc.hurtIframes > 0) return "iframes";

  contact.spend();

  if (
    target.state === "block" &&
    !hit.unblockable &&
    isFrontal(target, origin, block.frontDot)
  ) {
    if (contact.parryable && tc.blockFrame < block.perfectWindow) {
      openCounterWindow(target, tuning);
      if (attacker) enterStun(attacker, "stagger", parry.staggerFrames);
      freeze(attacker, target, parry.hitstop);
      return "parried";
    }
    tc.guard = Math.max(0, tc.guard - hit.guardDamage);
    tc.guardRegenDelay = block.regenDelay;
    tc.knock = {
      x: contact.knockDir.x * hit.knockback * block.pushbackScale,
      y: contact.knockDir.y * hit.knockback * block.pushbackScale,
    };
    freeze(attacker, target, hit.hitstop);
    if (tc.guard <= 0) enterStun(target, "guardBreak", block.guardBreakStun);
    return "blocked";
  }

  applyDamage(contact, state);
  freeze(attacker, target, hit.hitstop);
  return "hit";
}

function meleeContacts(state: SimState, out: Contact[]): void {
  const { tuning, entities } = state;
  for (const attacker of entities) {
    const attack = currentAttack(attacker, tuning);
    const box = activeHitbox(attacker, tuning);
    if (!attack || !box) continue;
    for (const target of entities) {
      if (target === attacker || target.state === "dead") continue;
      if (!canDamage(attacker.faction, target.faction)) continue;
      if (attacker.combat.attackHits.includes(target.id)) continue;
      if (isAirborne(target, tuning) && !attack.hitsAir) continue;
      if (!boxesOverlap(box, feetBox(target))) continue;
      out.push({
        attacker,
        target,
        hit: attack,
        attack,
        fromSpin: false,
        origin: attacker.pos,
        knockDir: attacker.facing,
        parryable: true,
        feedsSpin: true,
        perfectable: true,
        flinch: true,
        spend: () => attacker.combat.attackHits.push(target.id),
      });
    }
  }
}

function spinContacts(state: SimState, out: Contact[]): void {
  const { tuning, entities } = state;
  for (const attacker of entities) {
    const box = spinBox(attacker, tuning);
    const spin = spinDataOf(tuning, attacker);
    if (!box || !spin) continue;
    for (const target of entities) {
      if (target === attacker || target.state === "dead") continue;
      if (!canDamage(attacker.faction, target.faction)) continue;
      if ((attacker.combat.spinHitCd[target.id] ?? 0) > 0) continue;
      // A spin sweeps the ground around the feet, so a jump clears it.
      if (isAirborne(target, tuning)) continue;
      if (!boxesOverlap(box, feetBox(target))) continue;
      const away = normalized({
        x: target.pos.x - attacker.pos.x,
        y: target.pos.y - attacker.pos.y,
      });
      out.push({
        attacker,
        target,
        hit: spin.hit,
        attack: null,
        fromSpin: true,
        origin: attacker.pos,
        knockDir: away.x === 0 && away.y === 0 ? attacker.facing : away,
        parryable: false,
        feedsSpin: false,
        perfectable: true,
        flinch: true,
        spend: () => {
          attacker.combat.spinHitCd[target.id] = spin.hitInterval;
        },
      });
    }
  }
}

function hazardContacts(state: SimState, out: Contact[]): void {
  const { tuning, entities } = state;
  // Contacts are collected before any timer is set, so overlapping zones of one
  // source would all land in the same tick without this.
  const queued = new Set<string>();
  for (const h of state.hazards) {
    const box = hazardBox(h);
    const owner = entities.find((e) => e.id === h.ownerId) ?? null;
    const key = hazardKey(h);
    for (const target of entities) {
      if (target.state === "dead") continue;
      if (!canDamage(h.faction, target.faction)) continue;
      if ((target.combat.hazardHitCd[key] ?? 0) > 0) continue;
      if (queued.has(`${target.id}|${key}`)) continue;
      // Hazards lie on the ground, so a jump clears them.
      if (isAirborne(target, tuning)) continue;
      if (!boxesOverlap(box, feetBox(target))) continue;
      queued.add(`${target.id}|${key}`);
      const away = normalized({
        x: target.pos.x - h.pos.x,
        y: target.pos.y - h.pos.y,
      });
      out.push({
        attacker: owner,
        target,
        hit: h.hit,
        attack: null,
        // Hazards come from spin modifiers, so armor treats them as spin damage.
        fromSpin: true,
        origin: h.pos,
        knockDir: away.x === 0 && away.y === 0 ? { x: 1, y: 0 } : away,
        parryable: false,
        feedsSpin: false,
        perfectable: false,
        flinch: h.flinch,
        spend: () => {
          target.combat.hazardHitCd[key] = h.hitInterval;
        },
      });
    }
  }
}

function projectileContacts(state: SimState): void {
  const { tuning, entities } = state;
  for (const p of state.projectiles) {
    const data = tuning.projectiles[p.kind];
    if (!data) throw new Error(`Unknown projectile id: ${p.kind}`);
    const hit = getAttack(tuning, data.attackId);
    const box = projectileBox(p, tuning);
    const dir = normalized(p.vel);
    for (const target of entities) {
      if (p.life <= 0) break;
      if (target.state === "dead" || p.spent.includes(target.id)) continue;
      if (!canDamage(p.faction, target.faction)) continue;
      if (isAirborne(target, tuning) && !data.hitsAir) continue;
      if (!boxesOverlap(box, feetBox(target))) continue;
      const outcome = resolveContact(
        {
          attacker: null,
          target,
          hit,
          attack: hit,
          fromSpin: false,
          origin: p.pos,
          knockDir: dir,
          parryable: true,
          feedsSpin: false,
          perfectable: true,
          flinch: true,
          spend: () => p.spent.push(target.id),
        },
        state,
      );
      // A dodge or hurt i-frames let it fly on; anything else consumes it.
      if (outcome !== "dodged" && outcome !== "iframes") p.life = 0;
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.life > 0);
}

/** Two-phase so simultaneous swings trade instead of favouring entity order. */
export function resolveHits(state: SimState): void {
  const contacts: Contact[] = [];
  meleeContacts(state, contacts);
  spinContacts(state, contacts);
  hazardContacts(state, contacts);
  for (const contact of contacts) resolveContact(contact, state);
  projectileContacts(state);
}
