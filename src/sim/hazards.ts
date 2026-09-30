import type { HitData } from "../data/attacks";
import type { Box } from "./collision";
import type { SpinHookContext, SpinModifierHandler } from "./spin";
import type { Hazard, SimState } from "./types";

export function hazardBox(h: Hazard): Box {
  return {
    minX: h.pos.x - h.radius,
    maxX: h.pos.x + h.radius,
    minY: h.pos.y - h.radius,
    maxY: h.pos.y + h.radius,
  };
}

export function hazardKey(h: Hazard): string {
  return `${h.ownerId}:${h.kind}`;
}

function param(ctx: SpinHookContext, name: string): number {
  const value = ctx.params[name];
  if (value === undefined)
    throw new Error(`Spin modifier is missing "${name}"`);
  return value;
}

function hitFrom(ctx: SpinHookContext): HitData {
  return {
    damage: param(ctx, "damage"),
    guardDamage: param(ctx, "guardDamage"),
    knockback: param(ctx, "knockback"),
    hitstop: param(ctx, "hitstop"),
    unblockable: param(ctx, "unblockable") > 0,
  };
}

function addHazard(
  ctx: SpinHookContext,
  kind: string,
  style: Hazard["style"],
  hitInterval: number,
): void {
  const { state, entity } = ctx;
  const life = param(ctx, "lifetime");
  state.hazards.push({
    id: state.nextId,
    kind,
    ownerId: entity.id,
    faction: entity.faction,
    pos: { x: entity.pos.x, y: entity.pos.y },
    radius: param(ctx, "radius"),
    life,
    maxLife: life,
    hit: hitFrom(ctx),
    hitInterval,
    flinch: param(ctx, "flinch") > 0,
    style,
    color: param(ctx, "color"),
  });
  state.nextId += 1;
}

/** Drops a lingering damage zone at the spinner's feet every `interval` spin frames. */
export const spawnHazardModifier: SpinModifierHandler = {
  onSpinTick: (ctx) => {
    // The first drop lands on frame 1 so even a short spin leaves a mark.
    if ((ctx.spinFrame - 1) % param(ctx, "interval") !== 0) return;
    addHazard(ctx, "spawnHazard", "patch", param(ctx, "hitInterval"));
  },
};

/** One-off hit around the spinner; the re-hit timer outlasts the zone so each target is hit once. */
export const radialBurstModifier: SpinModifierHandler = {
  onSpinEnd: (ctx) => {
    addHazard(ctx, "radialBurst", "ring", param(ctx, "lifetime") + 1);
  },
};

export function stepHazards(state: SimState): void {
  for (const h of state.hazards) h.life -= 1;
  state.hazards = state.hazards.filter((h) => h.life > 0);
}
