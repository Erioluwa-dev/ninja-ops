import { step } from "./step";
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

/** Steps `ticks` times; `script` maps a tick index to the buttons held on it. */
export function runScript(
  state: SimState,
  script: Record<number, Partial<ActionFrame>>,
  ticks: number,
  onTick?: (tick: number) => void,
): void {
  for (let t = 0; t < ticks; t++) {
    step(state, idleInput(script[t] ?? {}));
    onTick?.(t);
  }
}

/** Holds `held` from `from` up to (not including) `to`. */
export function holdRange(
  held: Partial<ActionFrame>,
  from: number,
  to: number,
): Record<number, Partial<ActionFrame>> {
  const script: Record<number, Partial<ActionFrame>> = {};
  for (let t = from; t < to; t++) script[t] = held;
  return script;
}
