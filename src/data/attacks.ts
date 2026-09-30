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
  /** When false, an airborne target is missed: jumping beats it. */
  hitsAir: boolean;
  /** A low, ground-hugging strike (sweep or slam); never combined with hitsAir. */
  ground: boolean;
  /**
   * A long sweep. Dodge must not beat it, so it cannot be perfect-dodged and a
   * data test checks it outlasts or outreaches a dodge.
   */
  sweep: boolean;
  /** Frames of dizzy this hit forces on a spinning target, ending the spin. */
  spinBreakStun?: number;
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
    hitsAir: false,
    ground: false,
    sweep: false,
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
    hitsAir: false,
    ground: false,
    sweep: false,
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
    hitsAir: false,
    ground: false,
    sweep: false,
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
    hitsAir: false,
    ground: false,
    sweep: false,
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
    hitsAir: false,
    ground: false,
    sweep: false,
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
    hitsAir: true,
    ground: false,
    sweep: false,
    projectile: "oniBolt",
  },
  sweeperSweep: {
    startup: 28,
    active: 14,
    recovery: 30,
    damage: 10,
    guardDamage: 22,
    knockback: 100,
    hitstop: 3,
    hitbox: { length: 56, width: 64, offset: 36 },
    unblockable: false,
    telegraph: true,
    hitsAir: false,
    ground: true,
    sweep: true,
  },
  bruteSmash: {
    startup: 28,
    active: 4,
    recovery: 30,
    damage: 16,
    guardDamage: 28,
    knockback: 150,
    hitstop: 4,
    hitbox: { length: 24, width: 24, offset: 18 },
    unblockable: false,
    telegraph: true,
    hitsAir: false,
    ground: false,
    sweep: false,
  },
  bruteSlam: {
    startup: 34,
    active: 6,
    recovery: 44,
    damage: 14,
    guardDamage: 24,
    knockback: 170,
    hitstop: 5,
    hitbox: { length: 60, width: 60, offset: 0 },
    unblockable: false,
    telegraph: true,
    hitsAir: false,
    ground: true,
    sweep: false,
    spinBreakStun: 120,
  },
  bruteCrush: {
    startup: 38,
    active: 5,
    recovery: 36,
    damage: 22,
    guardDamage: 0,
    knockback: 200,
    hitstop: 6,
    hitbox: { length: 30, width: 28, offset: 18 },
    unblockable: true,
    telegraph: true,
    hitsAir: true,
    ground: false,
    sweep: false,
  },
  bruteSweep: {
    startup: 36,
    active: 16,
    recovery: 36,
    damage: 16,
    guardDamage: 30,
    knockback: 130,
    hitstop: 4,
    hitbox: { length: 60, width: 80, offset: 38 },
    unblockable: false,
    telegraph: true,
    hitsAir: false,
    ground: true,
    sweep: true,
  },
} as const satisfies Record<string, AttackData>;
