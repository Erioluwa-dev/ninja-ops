import { isHostile } from "../data/factions";
import { getAttack, getProjectile, type Tuning } from "../data/tuning";
import { type Box, boxesOverlap, boxHitsWall } from "./collision";
import { spinBox } from "./spin";
import type { Entity, Projectile, SimState } from "./types";

const DT = 1 / 60;

export function projectileBox(p: Projectile, tuning: Tuning): Box {
  const { size } = getProjectile(tuning, p.kind);
  return {
    minX: p.pos.x - size.w / 2,
    maxX: p.pos.x + size.w / 2,
    minY: p.pos.y - size.h / 2,
    maxY: p.pos.y + size.h / 2,
  };
}

export function spawnProjectile(
  state: SimState,
  owner: Entity,
  kind: string,
): Projectile {
  const data = getProjectile(state.tuning, kind);
  const dir = owner.facing;
  const p: Projectile = {
    id: state.nextId,
    kind,
    ownerId: owner.id,
    faction: owner.faction,
    pos: {
      x: owner.pos.x + dir.x * data.spawnOffset,
      y: owner.pos.y + dir.y * data.spawnOffset,
    },
    vel: { x: dir.x * data.speed, y: dir.y * data.speed },
    life: data.lifetime,
    spent: [],
    deflected: false,
  };
  state.nextId += 1;
  state.projectiles.push(p);
  return p;
}

/** Fires on the first active frame of a projectile attack. */
export function fireProjectile(state: SimState, e: Entity): void {
  const id = e.combat.attackId;
  if (id === null || e.state !== "attack") return;
  const attack = getAttack(state.tuning, id);
  if (attack.projectile === undefined) return;
  if (e.combat.attackFrame !== attack.startup) return;
  spawnProjectile(state, e, attack.projectile);
}

function deflect(state: SimState): void {
  for (const spinner of state.entities) {
    const box = spinBox(spinner, state.tuning);
    const spin = state.tuning.kits[spinner.kitId]?.spin;
    if (!box || !spin?.deflect) continue;
    for (const p of state.projectiles) {
      if (!isHostile(spinner.faction, p.faction)) continue;
      if (!boxesOverlap(box, projectileBox(p, state.tuning))) continue;
      // Straight back along the path, now dangerous to whoever fired it.
      p.vel = { x: -p.vel.x, y: -p.vel.y };
      p.faction = spinner.faction;
      p.ownerId = spinner.id;
      p.spent = [];
      p.deflected = true;
      p.life = getProjectile(state.tuning, p.kind).lifetime;
    }
  }
}

export function stepProjectiles(state: SimState): void {
  for (const p of state.projectiles) {
    p.pos.x += p.vel.x * DT;
    p.pos.y += p.vel.y * DT;
    p.life -= 1;
    if (boxHitsWall(state.arena, projectileBox(p, state.tuning))) p.life = 0;
  }
  deflect(state);
  state.projectiles = state.projectiles.filter((p) => p.life > 0);
}
