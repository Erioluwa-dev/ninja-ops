import type { MobData } from "../data/mobs";
import { getMob } from "../data/tuning";
import { attackPhase, currentAttack } from "./attack";
import { type Intent, NO_INTENT, nearestHostile } from "./intent";
import { navigate } from "./nav";
import { nextFloat } from "./rng";
import { isStunned } from "./states";
import { holdsToken, releaseToken, tryAcquireToken } from "./tokens";
import type { Entity, MobAi, SimState, Vec2 } from "./types";
import { normalized, snapCardinal } from "./vec";

interface EngageRange {
  minRange: number;
  maxRange: number;
  alignTolerance: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

function separation(state: SimState, mob: Entity): Vec2 {
  const { separationRadius, separationWeight } = state.tuning.combat.crowd;
  let x = 0;
  let y = 0;
  for (const other of state.entities) {
    if (other === mob || other.kind !== "mob" || other.state === "dead") {
      continue;
    }
    const dx = mob.pos.x - other.pos.x;
    const dy = mob.pos.y - other.pos.y;
    const d = Math.hypot(dx, dy);
    if (d >= separationRadius) continue;
    // Exactly stacked mobs have no direction; split them along an id-based axis.
    const push = 1 - d / separationRadius;
    if (d === 0) x += mob.id > other.id ? push : -push;
    else {
      x += (dx / d) * push;
      y += (dy / d) * push;
    }
  }
  return { x: x * separationWeight, y: y * separationWeight };
}

function steer(state: SimState, mob: Entity, desired: Vec2, aim: Vec2): Intent {
  const sep = separation(state, mob);
  const x = desired.x + sep.x;
  const y = desired.y + sep.y;
  const mag = Math.hypot(x, y);
  const scale = mag > 1 ? 1 / mag : 1;
  return { ...NO_INTENT, moveX: x * scale, moveY: y * scale, aim };
}

function circleMove(data: MobData, toTarget: Vec2, dist: number, ai: MobAi) {
  const dir = normalized(toTarget);
  const radial = clamp((dist - data.holdDistance) / data.holdDistance, -1, 1);
  const s = data.circleSpeedScale;
  return {
    x: (-dir.y * ai.strafe + dir.x * radial) * s,
    y: (dir.x * ai.strafe + dir.y * radial) * s,
  };
}

/** Moves toward the firing or striking spot; null once the attack lines up. */
function engageMove(data: EngageRange, toTarget: Vec2): Vec2 | null {
  const f = snapCardinal(toTarget);
  const horizontal = f.x !== 0;
  const along = Math.abs(horizontal ? toTarget.x : toTarget.y);
  const perp = horizontal ? toTarget.y : toTarget.x;
  const lined = Math.abs(perp) <= data.alignTolerance;
  if (lined && along >= data.minRange && along <= data.maxRange) return null;

  const dir = normalized(toTarget);
  const alongDir = horizontal ? { x: dir.x, y: 0 } : { x: 0, y: dir.y };
  const perpStep = lined ? 0 : clamp(perp / 8, -1, 1);
  const alongSign = along > data.maxRange ? 1 : along < data.minRange ? -1 : 0;
  const along1 = normalized(alongDir);
  return horizontal
    ? { x: along1.x * alongSign, y: perpStep }
    : { x: perpStep, y: along1.y * alongSign };
}

/** The spot an attack needs: the chosen move's, or the mob's own default. */
function rangeFor(data: MobData, ai: MobAi): EngageRange {
  const move = ai.move === null ? undefined : data.moves?.[ai.move];
  return move ?? data;
}

/**
 * Weighted pick among the mob's moves, by the target's distance and whether it
 * is spinning. Returns null for a mob with no move table.
 */
export function pickMove(
  state: SimState,
  mob: Entity,
  data: MobData,
  target: Entity,
): string | null {
  if (!data.moves) return null;
  const dist = Math.hypot(target.pos.x - mob.pos.x, target.pos.y - mob.pos.y);
  const spinning = target.state === "spin";
  const weighted = Object.entries(data.moves).map(([id, move]) => {
    const inRange = dist >= move.pickMinDist && dist <= move.pickMaxDist;
    return {
      id,
      weight: inRange ? (spinning ? move.spinWeight : move.weight) : 0,
    };
  });
  let total = weighted.reduce((sum, m) => sum + m.weight, 0);
  // Nothing fits the distance: fall back to the weights alone rather than idle.
  if (total <= 0) {
    for (const m of weighted) {
      const move = data.moves[m.id];
      m.weight = move ? (spinning ? move.spinWeight : move.weight) : 0;
    }
    total = weighted.reduce((sum, m) => sum + m.weight, 0);
  }
  let roll = nextFloat(state) * total;
  for (const m of weighted) {
    if (m.weight <= 0) continue;
    roll -= m.weight;
    if (roll < 0) return m.id;
  }
  return weighted.find((m) => m.weight > 0)?.id ?? null;
}

function stepCooldown(ai: MobAi): boolean {
  ai.timer -= 1;
  return ai.timer > 0;
}

/** Drives a mob through the same Intent the player and dummy use. */
export function mobIntent(state: SimState, mob: Entity): Intent {
  const { ai } = mob;
  if (!ai || mob.mobType === null || mob.state === "dead") return NO_INTENT;
  if (mob.combat.hitstop > 0) return NO_INTENT;
  const { tuning } = state;
  const data = getMob(tuning, mob.mobType);

  if (mob.state === "attack") {
    const attack = currentAttack(mob, tuning);
    const phase = attack
      ? attackPhase(attack, mob.combat.attackFrame)
      : "recovery";
    ai.mode =
      phase === "startup"
        ? "telegraph"
        : phase === "active"
          ? "attack"
          : "recover";
    ai.timer = data.cooldown;
    return NO_INTENT;
  }
  if (isStunned(mob)) {
    releaseToken(state, mob);
    ai.mode = "recover";
    ai.timer = data.cooldown;
    return NO_INTENT;
  }

  const target = nearestHostile(state, mob);
  if (!target) {
    releaseToken(state, mob);
    ai.mode = "idle";
    return NO_INTENT;
  }
  const toTarget = { x: target.pos.x - mob.pos.x, y: target.pos.y - mob.pos.y };
  const dist = Math.hypot(toTarget.x, toTarget.y);

  if (ai.mode === "telegraph" || ai.mode === "attack") {
    // The attack ended without passing through recovery, e.g. it was cancelled.
    ai.mode = "recover";
    ai.timer = data.cooldown;
  }
  if (ai.mode === "recover") {
    releaseToken(state, mob);
    if (stepCooldown(ai)) return steer(state, mob, { x: 0, y: 0 }, toTarget);
    ai.mode = "idle";
    ai.timer = 0;
  }

  if (ai.mode === "idle" && ai.timer > 0) {
    ai.timer -= 1;
    return steer(state, mob, { x: 0, y: 0 }, toTarget);
  }
  if (dist > data.sightRange) {
    releaseToken(state, mob);
    ai.mode = "idle";
    return NO_INTENT;
  }

  const engaged = dist <= data.engageRange;
  if (!holdsToken(state, mob) && engaged) {
    ai.timer -= 1;
    if (ai.timer <= 0) {
      if (tryAcquireToken(state, mob, data.tokenWeight)) {
        ai.patience = data.approachTimeout;
        // Each token starts a fresh choice, so a finished move is never repeated by default.
        ai.move = null;
      } else {
        ai.timer =
          data.tokenRetry +
          Math.floor(nextFloat(state) * data.tokenRetryJitter);
        if (nextFloat(state) < 0.3) ai.strafe = -ai.strafe;
      }
    }
  }

  if (!holdsToken(state, mob)) {
    if (!engaged) {
      ai.mode = "chase";
      const heading = navigate(
        state.arena,
        mob,
        target.pos,
        normalized(toTarget),
      );
      return steer(state, mob, heading, toTarget);
    }
    ai.mode = "circle";
    return steer(state, mob, circleMove(data, toTarget, dist, ai), toTarget);
  }

  // Re-pick when the target starts or stops spinning, so the punish is chosen
  // against what the target is doing now rather than what it did at the token.
  const spinning = target.state === "spin";
  if (data.moves && (ai.move === null || ai.moveSpin !== spinning)) {
    ai.move = pickMove(state, mob, data, target);
    ai.moveSpin = spinning;
  }

  ai.patience -= 1;
  if (ai.patience <= 0) {
    releaseToken(state, mob);
    ai.timer = data.tokenRetry;
    ai.mode = "circle";
    return steer(state, mob, circleMove(data, toTarget, dist, ai), toTarget);
  }

  const move = engageMove(rangeFor(data, ai), toTarget);
  if (move === null) {
    ai.mode = "telegraph";
    return {
      ...NO_INTENT,
      aim: toTarget,
      attackPress: true,
      attackId: ai.move,
    };
  }
  ai.mode = data.role === "ranged" ? "reposition" : "chase";
  // The lining-up moves are axis-aligned and would pin a mob against a pillar
  // between it and the target, so route around first.
  return steer(
    state,
    mob,
    navigate(state.arena, mob, target.pos, move),
    toTarget,
  );
}
