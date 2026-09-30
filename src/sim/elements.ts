import { getElement } from "../data/tuning";
import type { Entity, SimState } from "./types";

export function setElement(
  state: SimState,
  entity: Entity,
  elementId: string | null,
): void {
  if (elementId !== null) getElement(state.tuning, elementId);
  entity.element = elementId;
}

/** Steps none, then each element in data order, then back to none. */
export function cycleElement(state: SimState, entity: Entity): string | null {
  const order: (string | null)[] = [
    null,
    ...Object.keys(state.tuning.elements),
  ];
  const at = order.indexOf(entity.element);
  const next = order[(at + 1) % order.length] ?? null;
  setElement(state, entity, next);
  return next;
}
