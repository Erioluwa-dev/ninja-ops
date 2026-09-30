import { getAttack, getKit, type Tuning } from "../data/tuning";
import { attackTotalFrames } from "./attack";
import { moveAndCollide } from "./collision";
import type { Intent } from "./intent";
import { jumpHeight } from "./jump";
import { fireProjectile } from "./projectiles";
import { dizzyFrames, runSpinHooks, spinDataOf } from "./spin";
import { canEnterState, clearAttack, clearSpin, enterStun } from "./states";
import { SIM_HZ } from "./timing";
import type { Entity, SimState } from "./types";
import { normalized, snapCardinal } from "./vec";

const DT = 1 / SIM_HZ;

function isFree(e: Entity): boolean {
  return e.state === "idle" || e.state === "move";
}

function registerPresses(e: Entity, intent: Intent, tuning: Tuning): void {
  // Runs during hitstop too: a press made while frozen must not be lost.
  if (intent.attackPress) e.combat.attackBuffer = tuning.combat.inputBuffer;
  if (intent.dodgePress) e.combat.dodgeBuffer = tuning.combat.inputBuffer;
  if (intent.jumpPress) e.combat.jumpBuffer = tuning.combat.inputBuffer;
}

function tickTimers(e: Entity, tuning: Tuning): void {
  const c = e.combat;
  const kit = getKit(tuning, e.kitId);
  const { block } = tuning.combat;

  c.attackBuffer = Math.max(0, c.attackBuffer - 1);
  c.dodgeBuffer = Math.max(0, c.dodgeBuffer - 1);
  c.jumpBuffer = Math.max(0, c.jumpBuffer - 1);
  c.dodgeCooldown = Math.max(0, c.dodgeCooldown - 1);
  c.hurtIframes = Math.max(0, c.hurtIframes - 1);
  c.counterWindow = Math.max(0, c.counterWindow - 1);
  c.guardRegenDelay = Math.max(0, c.guardRegenDelay - 1);
  c.hpRegenDelay = Math.max(0, c.hpRegenDelay - 1);
  for (const id of Object.keys(c.spinHitCd)) {
    const left = (c.spinHitCd[Number(id)] ?? 0) - 1;
    if (left > 0) c.spinHitCd[Number(id)] = left;
    else delete c.spinHitCd[Number(id)];
  }

  if (c.hpRegenDelay === 0 && kit.regenPerTick > 0) {
    e.hp = Math.min(e.maxHp, e.hp + kit.regenPerTick);
  }
  c.guard = Math.min(c.guard, block.guardMax);
  if (e.state !== "block" && c.guardRegenDelay === 0) {
    c.guard = Math.min(block.guardMax, c.guard + block.regenPerTick);
  }
}

function startAttack(
  e: Entity,
  intent: Intent,
  tuning: Tuning,
  comboIndex: number,
  opener: boolean,
): void {
  const attackId = getKit(tuning, e.kitId).comboAttacks[comboIndex];
  if (attackId === undefined) return;
  const c = e.combat;
  const wasCounter = c.counterWindow > 0;
  clearAttack(e);
  c.attackId = attackId;
  c.comboIndex = comboIndex;
  c.attackBuffer = 0;
  c.dodgeFrame = 0;
  c.blockFrame = 0;
  // Only the opener of a chain is a counter; the window is spent on use.
  c.attackCounter = wasCounter && opener;
  if (c.attackCounter) c.counterWindow = 0;
  e.state = "attack";
  if (intent.moveX !== 0 || intent.moveY !== 0) {
    e.facing = snapCardinal({ x: intent.moveX, y: intent.moveY });
  } else if (intent.aim) {
    e.facing = snapCardinal(intent.aim);
  }
}

function startDodge(e: Entity, intent: Intent, tuning: Tuning): void {
  const c = e.combat;
  const dir = normalized({ x: intent.moveX, y: intent.moveY });
  clearAttack(e);
  c.dodgeBuffer = 0;
  c.dodgeFrame = 0;
  c.blockFrame = 0;
  c.dodgeCooldown = tuning.combat.dodge.cooldown;
  c.dodgeDir = dir.x === 0 && dir.y === 0 ? { ...e.facing } : dir;
  e.state = "dodge";
}

function startJump(e: Entity): void {
  clearAttack(e);
  const c = e.combat;
  c.attackBuffer = 0;
  c.dodgeBuffer = 0;
  c.jumpBuffer = 0;
  c.dodgeFrame = 0;
  c.blockFrame = 0;
  c.jumpFrame = 0;
  e.state = "jump";
}

/** The chosen attack's slot in the kit, or the first when none was asked for. */
function openerIndex(e: Entity, intent: Intent, tuning: Tuning): number {
  if (intent.attackId === null) return 0;
  const index = getKit(tuning, e.kitId).comboAttacks.indexOf(intent.attackId);
  return Math.max(0, index);
}

function startSpin(e: Entity): void {
  clearAttack(e);
  clearSpin(e);
  const c = e.combat;
  c.attackBuffer = 0;
  c.dodgeBuffer = 0;
  c.dodgeFrame = 0;
  c.blockFrame = 0;
  e.state = "spin";
}

function startBlock(e: Entity): void {
  clearAttack(e);
  e.combat.blockFrame = 0;
  e.state = "block";
}

function advanceJump(e: Entity, tuning: Tuning): void {
  const jump = getKit(tuning, e.kitId).jump;
  const c = e.combat;
  if (!jump) {
    e.state = "idle";
    e.z = 0;
    return;
  }
  c.jumpFrame += 1;
  e.z = jumpHeight(jump, c.jumpFrame);
  if (c.jumpFrame >= jump.frames + jump.landingRecovery) {
    c.jumpFrame = 0;
    e.state = "idle";
  }
}

/** Advances the state the entity was already in; may free it. */
function advanceSpin(state: SimState, e: Entity, intent: Intent): void {
  const c = e.combat;
  const spin = spinDataOf(state.tuning, e);
  if (!spin) {
    e.state = "idle";
    return;
  }
  c.spinMeter = Math.max(0, c.spinMeter - spin.drainPerTick);
  if (intent.spinHeld && c.spinMeter > 0) {
    c.spinFrame += 1;
    runSpinHooks(state, e, spin, "onSpinTick");
    return;
  }
  // Hooks run before the stun clears the spin counters they read. A hit that
  // interrupts a spin skips them: the spin never reached its natural end.
  runSpinHooks(state, e, spin, "onSpinEnd");
  enterStun(e, "dizzy", dizzyFrames(spin, c.spinFrame));
}

function advanceState(
  state: SimState,
  e: Entity,
  intent: Intent,
  tuning: Tuning,
): void {
  const c = e.combat;
  switch (e.state) {
    case "hurt":
    case "stagger":
    case "guardBreak":
    case "dizzy":
      c.stun -= 1;
      if (c.stun <= 0) e.state = "idle";
      break;
    case "attack": {
      c.attackFrame += 1;
      if (c.attackId === null) {
        e.state = "idle";
        break;
      }
      const total = attackTotalFrames(getAttack(tuning, c.attackId));
      if (c.attackFrame < total) break;
      const next = c.comboIndex + 1;
      const hasNext = next < getKit(tuning, e.kitId).comboAttacks.length;
      if (c.attackBuffer > 0 && hasNext) {
        startAttack(e, intent, tuning, next, false);
      } else {
        clearAttack(e);
        e.state = "idle";
      }
      break;
    }
    case "dodge":
      c.dodgeFrame += 1;
      if (c.dodgeFrame >= tuning.combat.dodge.duration) e.state = "idle";
      break;
    case "block":
      if (intent.blockHeld) c.blockFrame += 1;
      else e.state = "idle";
      break;
    case "spin":
      advanceSpin(state, e, intent);
      break;
    case "jump":
      advanceJump(e, tuning);
      break;
    default:
      break;
  }
}

function chooseState(e: Entity, intent: Intent, tuning: Tuning): void {
  const c = e.combat;
  const { spin, jump } = getKit(tuning, e.kitId);

  if (
    c.dodgeBuffer > 0 &&
    c.dodgeCooldown === 0 &&
    canEnterState(e.state, "dodge")
  ) {
    startDodge(e, intent, tuning);
  }
  // Block outranks attack, but a block held through a counter attack must not
  // cancel it every tick; interrupting a swing takes a fresh press.
  const blockCanStart = e.state !== "attack" || intent.blockPress;
  if (intent.blockHeld && blockCanStart && canEnterState(e.state, "block")) {
    startBlock(e);
  }

  // Spin outranks block, so holding both lands in spin.
  if (
    spin &&
    intent.spinHeld &&
    c.spinMeter >= spin.minMeter &&
    canEnterState(e.state, "spin")
  ) {
    startSpin(e);
  }

  if (jump && c.jumpBuffer > 0 && canEnterState(e.state, "jump")) {
    startJump(e);
  }

  // A live counter window lets the punish cut through block and dodge; a plain
  // attack press still loses to them by priority.
  const counterCut =
    c.counterWindow > 0 && (e.state === "block" || e.state === "dodge");
  if (c.attackBuffer > 0 && (canEnterState(e.state, "attack") || counterCut)) {
    startAttack(e, intent, tuning, openerIndex(e, intent, tuning), true);
  }
}

function applyVelocity(e: Entity, intent: Intent, tuning: Tuning): void {
  const speed = getKit(tuning, e.kitId).moveSpeed;
  const { dodge, block } = tuning.combat;
  switch (e.state) {
    case "idle":
    case "move":
      e.vel.x = intent.moveX * speed;
      e.vel.y = intent.moveY * speed;
      break;
    case "block":
      e.vel.x = intent.moveX * speed * block.moveSpeedScale;
      e.vel.y = intent.moveY * speed * block.moveSpeedScale;
      break;
    case "spin": {
      const scale = getKit(tuning, e.kitId).spin?.moveSpeedScale ?? 0;
      e.vel.x = intent.moveX * speed * scale;
      e.vel.y = intent.moveY * speed * scale;
      break;
    }
    case "jump": {
      const jump = getKit(tuning, e.kitId).jump;
      const steering = jump !== null && e.combat.jumpFrame < jump.frames;
      const scale = steering ? jump.airSteerScale : 0;
      e.vel.x = intent.moveX * speed * scale;
      e.vel.y = intent.moveY * speed * scale;
      break;
    }
    case "dodge":
      e.vel.x = e.combat.dodgeDir.x * dodge.speed;
      e.vel.y = e.combat.dodgeDir.y * dodge.speed;
      break;
    default:
      e.vel.x = 0;
      e.vel.y = 0;
  }
}

function integrate(state: SimState, e: Entity): void {
  const c = e.combat;
  const { hurt } = state.tuning.combat;
  moveAndCollide(
    state.arena,
    e,
    state.entities,
    (e.vel.x + c.knock.x) * DT,
    (e.vel.y + c.knock.y) * DT,
  );
  c.knock.x *= hurt.knockbackDecay;
  c.knock.y *= hurt.knockbackDecay;
  if (Math.hypot(c.knock.x, c.knock.y) < hurt.knockbackStop) {
    c.knock.x = 0;
    c.knock.y = 0;
  }
}

export function tickEntity(state: SimState, e: Entity, intent: Intent): void {
  const { tuning } = state;
  const c = e.combat;

  if (c.hitstop > 0) {
    c.hitstop -= 1;
    registerPresses(e, intent, tuning);
    return;
  }

  if (e.state === "dead") {
    c.stun = Math.max(0, c.stun - 1);
    e.vel.x = 0;
    e.vel.y = 0;
    integrate(state, e);
    return;
  }

  tickTimers(e, tuning);
  registerPresses(e, intent, tuning);
  advanceState(state, e, intent, tuning);
  chooseState(e, intent, tuning);
  fireProjectile(state, e);

  const moving = intent.moveX !== 0 || intent.moveY !== 0;
  if (moving && (isFree(e) || e.state === "block")) {
    e.facing = snapCardinal({ x: intent.moveX, y: intent.moveY });
  } else if (!moving && isFree(e) && intent.aim) {
    e.facing = snapCardinal(intent.aim);
  }

  applyVelocity(e, intent, tuning);
  if (isFree(e)) {
    e.state = e.vel.x !== 0 || e.vel.y !== 0 ? "move" : "idle";
  }

  integrate(state, e);
}
