import { getKit, getMob, type Tuning } from "../data/tuning";
import type { CombatState, Entity } from "./types";

export function createCombatState(tuning: Tuning): CombatState {
  return {
    hitstop: 0,
    stun: 0,
    hurtIframes: 0,
    attackId: null,
    attackFrame: 0,
    comboIndex: 0,
    attackHits: [],
    attackCounter: false,
    attackBuffer: 0,
    dodgeBuffer: 0,
    jumpBuffer: 0,
    jumpFrame: 0,
    dodgeFrame: 0,
    dodgeDir: { x: 0, y: 0 },
    dodgeCooldown: 0,
    blockFrame: 0,
    guard: tuning.combat.block.guardMax,
    guardRegenDelay: 0,
    hpRegenDelay: 0,
    counterWindow: 0,
    spinMeter: 0,
    spinFrame: 0,
    spinHitCd: {},
    knock: { x: 0, y: 0 },
  };
}

export function createEntity(
  id: number,
  kind: Entity["kind"],
  faction: Entity["faction"],
  kitId: string,
  pos: { x: number; y: number },
  facing: { x: number; y: number },
  tuning: Tuning,
  mobType: string | null = null,
): Entity {
  const kit = getKit(tuning, kitId);
  return {
    id,
    kind,
    mobType,
    ai:
      mobType === null
        ? null
        : {
            mode: "idle",
            timer: getMob(tuning, mobType).reactionDelay,
            patience: 0,
            strafe: 1,
            move: null,
            moveSpin: false,
          },
    faction,
    kitId,
    pos: { x: pos.x, y: pos.y },
    z: 0,
    vel: { x: 0, y: 0 },
    facing: { x: facing.x, y: facing.y },
    feet: { w: kit.feet.w, h: kit.feet.h },
    bodyHeight: kit.bodyHeight,
    hp: kit.maxHp,
    maxHp: kit.maxHp,
    state: "idle",
    combat: createCombatState(tuning),
    aiTimer: tuning.combat.dummy.interval,
  };
}
