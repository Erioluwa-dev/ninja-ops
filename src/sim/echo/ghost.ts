import type { EchoMoveId } from "../../data/echo";
import { createEntity } from "../entity";
import { type Intent, NO_INTENT, playerIntent } from "../intent";
import type { ActionFrame, Entity, GhostState, SimState, Vec2 } from "../types";
import { frameAt, IDLE_FRAME } from "./recorder";

export const GHOST_KIT = "echoGhost";

export interface GhostSpec {
  owner: Entity;
  move: EchoMoveId;
  pos: Vec2;
  facing: Vec2;
  /** Tick of the first recorded frame to replay; -1 for a ghost that replays nothing. */
  replayTick: number;
  actFrames: number;
  follow: boolean;
  press: GhostState["press"];
  attackId: string | null;
  ttl: number;
  taunt: boolean;
}

/** Living ghosts, oldest first; a dissolving one no longer counts toward the limit. */
export function liveGhosts(state: SimState): Entity[] {
  return state.entities.filter((e) => e.kind === "ghost" && e.state !== "dead");
}

/** Silent removal: expiry and replacement cost nothing, only being hit does. */
export function removeGhost(state: SimState, ghost: Entity): void {
  state.entities = state.entities.filter((e) => e !== ghost);
}

export function spawnGhost(state: SimState, spec: GhostSpec): Entity {
  const alive = liveGhosts(state);
  const over = alive.length - state.echo.ghostLimit + 1;
  for (const old of alive.slice(0, Math.max(0, over))) removeGhost(state, old);

  const ghost = createEntity(
    state.nextId,
    "ghost",
    spec.owner.faction,
    GHOST_KIT,
    spec.pos,
    spec.facing,
    state.tuning,
  );
  state.nextId += 1;
  ghost.element = spec.owner.element;
  ghost.ghost = {
    ownerId: spec.owner.id,
    move: spec.move,
    replayTick: spec.replayTick,
    actFrames: spec.actFrames,
    follow: spec.follow,
    press: spec.press,
    cursor: 0,
    prev: { ...IDLE_FRAME },
    attackId: spec.attackId,
    ttl: spec.ttl,
    taunt: spec.taunt,
  };
  state.entities.push(ghost);
  return ghost;
}

/** The recorded frame the ghost repeats this tick, trimmed to what the move replays. */
function replayedFrame(state: SimState, g: GhostState): ActionFrame {
  const recorded =
    (g.replayTick >= 0
      ? frameAt(state.echo, g.replayTick)?.input
      : undefined) ?? IDLE_FRAME;
  if (g.cursor === 0 && g.press) return { ...recorded, [g.press]: true };
  if (g.cursor < g.actFrames) return recorded;
  if (!g.follow) return IDLE_FRAME;
  // Movement only: a following ghost shadows the path, not the player's buttons.
  return { ...IDLE_FRAME, moveX: recorded.moveX, moveY: recorded.moveY };
}

/** Feeds a ghost the recorded frame through the same Intent the player uses. */
export function ghostIntent(state: SimState, ghost: Entity): Intent {
  const g = ghost.ghost;
  if (!g) return NO_INTENT;
  const frame = replayedFrame(state, g);
  g.cursor += 1;
  if (g.replayTick >= 0) g.replayTick += 1;
  const intent = playerIntent(frame, g.prev);
  g.prev = frame;
  return g.attackId !== null && intent.attackPress
    ? { ...intent, attackId: g.attackId }
    : intent;
}
