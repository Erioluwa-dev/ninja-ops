/** What a contact does, shared by melee swings, spin hits and projectiles. */
export interface HitData {
  damage: number;
  /** Guard meter drained from a blocker. */
  guardDamage: number;
  /** Initial knockback speed in px/s along the hit direction. */
  knockback: number;
  /** Freeze frames applied to both sides on any contact. */
  hitstop: number;
  unblockable: boolean;
}

export interface AttackData extends HitData {
  /** Frames before the hitbox can hit; also the visible windup. */
  startup: number;
  /** Frames the hitbox is live. */
  active: number;
  recovery: number;
  /** Ground-plane rect in front of the attacker's feet. */
  hitbox: { length: number; width: number; offset: number };
  /** Renderer tints the startup so the swing is readable. */
  telegraph: boolean;
  /** Projectile fired on the first active frame; the attack then has no hitbox. */
  projectile?: string;
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
  oniSlash: {
    startup: 22,
    active: 4,
    recovery: 20,
    damage: 10,
    guardDamage: 20,
    knockback: 90,
    hitstop: 3,
    hitbox: { length: 14, width: 14, offset: 11 },
    unblockable: false,
    telegraph: true,
  },
  oniBolt: {
    startup: 34,
    active: 1,
    recovery: 26,
    damage: 8,
    guardDamage: 18,
    knockback: 60,
    hitstop: 3,
    hitbox: { length: 0, width: 0, offset: 0 },
    unblockable: false,
    telegraph: true,
    projectile: "oniBolt",
  },
} as const satisfies Record<string, AttackData>;
