import type { ActionFrame, Entity, SimState } from "./types";

export function idleInput(overrides: Partial<ActionFrame> = {}): ActionFrame {
  return {
    moveX: 0,
    moveY: 0,
    attack: false,
    dodge: false,
    block: false,
    jump: false,
    spin: false,
    pause: false,
    ...overrides,
  };
}

export function entityOfKind(state: SimState, kind: Entity["kind"]): Entity {
  const found = state.entities.find((e) => e.kind === kind);
  if (!found) throw new Error(`No ${kind} entity in state`);
  return found;
}
