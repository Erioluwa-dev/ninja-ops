export interface AttackData {
  /** Frames before the hitbox can hit; also the visible windup. */
  startup: number;
  /** Frames the hitbox is live. */
  active: number;
  recovery: number;
  damage: number;
  /** Guard meter drained from a blocker. */
  guardDamage: number;
  /** Initial knockback speed in px/s along the attacker's facing. */
  knockback: number;
  /** Freeze frames applied to both attacker and target on any contact. */
  hitstop: number;
  /** Ground-plane rect in front of the attacker's feet. */
  hitbox: { length: number; width: number; offset: number };
  unblockable: boolean;
  /** Renderer tints the startup so the swing is readable. */
  telegraph: boolean;
}

export const ATTACKS = {
  ninjaHit1: {
    startup: 4,
    active: 3,
    recovery: 10,
    damage: 8,
    guardDamage: 10,
    knockback: 30,
    hitstop: 3,
    hitbox: { length: 16, width: 14, offset: 13 },
    unblockable: false,
    telegraph: false,
  },
  ninjaHit2: {
    startup: 4,
    active: 3,
    recovery: 10,
    damage: 8,
    guardDamage: 10,
    knockback: 40,
    hitstop: 3,
    hitbox: { length: 16, width: 16, offset: 13 },
    unblockable: false,
    telegraph: false,
  },
  ninjaHit3: {
    startup: 6,
    active: 4,
    recovery: 16,
    damage: 14,
    guardDamage: 20,
    knockback: 160,
    hitstop: 4,
    hitbox: { length: 20, width: 18, offset: 15 },
    unblockable: false,
    telegraph: false,
  },
  dummySwing: {
    startup: 30,
    active: 4,
    recovery: 20,
    damage: 12,
    guardDamage: 25,
    knockback: 110,
    hitstop: 4,
    hitbox: { length: 16, width: 18, offset: 13 },
    unblockable: false,
    telegraph: true,
  },
} as const satisfies Record<string, AttackData>;
