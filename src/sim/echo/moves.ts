import type { EchoMoveId } from "../../data/echo";
import { getKit } from "../../data/tuning";
import type { Intent } from "../intent";
import { canEnterState, clearAttack } from "../states";
import type { Entity, SimState } from "../types";
import { liveGhosts, removeGhost, spawnGhost } from "./ghost";
import { frameAt } from "./recorder";
import { canSpend, spendPips } from "./resonance";

export function hasMove(state: SimState, move: EchoMoveId): boolean {
  return state.echo.unlocked.includes(move);
}

function paid(state: SimState, cost: number): boolean {
  if (!canSpend(state, cost)) return false;
  spendPips(state, cost);
  return true;
}

/**
 * Rewind Step: a dodge press soon after Afterstep, while its ghost stands,
 * puts the player where the ghost is instead of dodging. Returns the intent
 * with the press consumed, or unchanged when the move does not apply.
 */
export function rewindIntent(
  state: SimState,
  player: Entity,
  intent: Intent,
): Intent {
  const { echo, tuning } = state;
  if (!intent.dodgePress || !hasMove(state, "rewindStep")) return intent;
  if (state.tick > echo.rewindUntil) return intent;
  if (!canEnterState(player.state, "dodge")) return intent;
  const ghost = liveGhosts(state).at(-1);
  if (!ghost || !paid(state, tuning.echo.rewindStep.cost)) return intent;

  clearAttack(player);
  player.pos = { x: ghost.pos.x, y: ghost.pos.y };
  player.vel = { x: 0, y: 0 };
  player.combat.knock = { x: 0, y: 0 };
  player.state = "idle";
  // The ghost has delivered the player to itself, so it is spent.
  removeGhost(state, ghost);
  echo.rewindUntil = -1;
  return { ...intent, dodgePress: false };
}

function queue(
  state: SimState,
  player: Entity,
  move: EchoMoveId,
  delay: number,
  attackId: string | null,
): void {
  const startTick = state.tick;
  state.echo.pending.push({
    move,
    startTick,
    // The ghost's first action lands `delay` ticks after the player's own.
    spawnTick: startTick + delay - 1,
    facing: { ...player.facing },
    attackId,
  });
}

function detectTriggers(state: SimState, player: Entity): void {
  const { echo, tuning } = state;
  const cfg = tuning.echo;

  const dodging = player.state === "dodge";
  if (
    dodging &&
    !echo.wasDodging &&
    hasMove(state, "afterstep") &&
    paid(state, cfg.afterstep.cost)
  ) {
    queue(state, player, "afterstep", cfg.afterstep.delayFrames, null);
    if (hasMove(state, "rewindStep")) {
      echo.rewindUntil = state.tick + cfg.rewindStep.windowFrames;
    }
  }
  echo.wasDodging = dodging;

  const combo = getKit(tuning, player.kitId).comboAttacks;
  const lastIndex = combo.length - 1;
  const finisher =
    player.state === "attack" && player.combat.comboIndex === lastIndex;
  if (
    finisher &&
    !echo.wasFinisher &&
    hasMove(state, "twinStrike") &&
    paid(state, cfg.twinStrike.cost)
  ) {
    queue(
      state,
      player,
      "twinStrike",
      cfg.ghostDelayFrames,
      combo[lastIndex] ?? null,
    );
  }
  echo.wasFinisher = finisher;

  echo.stillFrames = player.state === "idle" ? echo.stillFrames + 1 : 0;
  if (
    echo.stillFrames === cfg.decoyVeil.standStillFrames &&
    hasMove(state, "decoyVeil") &&
    paid(state, cfg.decoyVeil.cost)
  ) {
    spawnGhost(state, {
      owner: player,
      move: "decoyVeil",
      pos: player.pos,
      facing: player.facing,
      replayTick: -1,
      actFrames: 0,
      follow: false,
      press: null,
      attackId: null,
      ttl: cfg.decoyVeil.tauntFrames,
      taunt: true,
    });
  }
}

function spawnDue(state: SimState, player: Entity): void {
  const { echo, tuning } = state;
  const due = echo.pending.filter((p) => p.spawnTick <= state.tick);
  echo.pending = echo.pending.filter((p) => p.spawnTick > state.tick);
  for (const p of due) {
    const origin = frameAt(echo, p.startTick)?.pos ?? player.pos;
    const isDash = p.move === "afterstep";
    spawnGhost(state, {
      owner: player,
      move: p.move,
      pos: origin,
      facing: p.facing,
      replayTick: p.startTick,
      actFrames: isDash ? tuning.echo.afterstep.replayFrames : 1,
      // Only Afterstep's ghost shadows the player's path, which is what gives
      // Rewind Step somewhere meaningful to snap back to.
      follow: isDash,
      press: isDash ? "dodge" : "attack",
      attackId: p.attackId,
      ttl: isDash
        ? tuning.echo.afterstep.lingerFrames
        : tuning.echo.twinStrike.lingerFrames,
      taunt: false,
      flicker: p.move === "twinStrike" && echo.twinStrikeFlicker,
    });
  }
}

function expireGhosts(state: SimState): void {
  for (const e of state.entities) {
    if (e.kind !== "ghost" || !e.ghost || e.state === "dead") continue;
    e.ghost.ttl -= 1;
    if (e.ghost.ttl <= 0) removeGhost(state, e);
  }
}

/** Runs after the tick's movement and before hits, so a new ghost first acts next tick. */
export function stepEcho(state: SimState): void {
  const player = state.entities.find((e) => e.kind === "player");
  if (player && player.state !== "dead") {
    detectTriggers(state, player);
    spawnDue(state, player);
  }
  expireGhosts(state);
}
