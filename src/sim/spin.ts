import type { SpinData, SpinModifierData } from "../data/kits";
import { getKit, type Tuning } from "../data/tuning";
import type { Box } from "./collision";
import type { Entity, SimState } from "./types";

export type SpinHook = "onSpinTick" | "onSpinEnd";

export interface SpinHookContext {
  state: SimState;
  entity: Entity;
  spin: SpinData;
  params: Readonly<Record<string, number>>;
  /** Frames spun so far. */
  spinFrame: number;
}

export type SpinModifierHandler = Partial<
  Record<SpinHook, (ctx: SpinHookContext) => void>
>;

// Empty until Phase 8: elements register a handler here and list a
// SpinModifierData in the kit's hook arrays.
export const SPIN_MODIFIERS: Record<string, SpinModifierHandler> = {};

function runList(
  state: SimState,
  entity: Entity,
  spin: SpinData,
  list: readonly SpinModifierData[],
  hook: SpinHook,
): void {
  for (const mod of list) {
    const handler = SPIN_MODIFIERS[mod.id];
    if (!handler) throw new Error(`Unknown spin modifier: ${mod.id}`);
    handler[hook]?.({
      state,
      entity,
      spin,
      params: mod.params,
      spinFrame: entity.combat.spinFrame,
    });
  }
}

export function runSpinHooks(
  state: SimState,
  entity: Entity,
  spin: SpinData,
  hook: SpinHook,
): void {
  runList(state, entity, spin, spin[hook], hook);
}

export function spinDataOf(tuning: Tuning, e: Entity): SpinData | null {
  return getKit(tuning, e.kitId).spin;
}

/** The hit area while spinning; null otherwise or for kits without a spin. */
export function spinBox(e: Entity, tuning: Tuning): Box | null {
  if (e.state !== "spin") return null;
  const spin = spinDataOf(tuning, e);
  if (!spin) return null;
  return {
    minX: e.pos.x - spin.radius,
    maxX: e.pos.x + spin.radius,
    minY: e.pos.y - spin.radius,
    maxY: e.pos.y + spin.radius,
  };
}

export function dizzyFrames(spin: SpinData, spinFrames: number): number {
  const { base, perSecond, max } = spin.dizzy;
  return Math.min(max, Math.round(base + (perSecond * spinFrames) / 60));
}
