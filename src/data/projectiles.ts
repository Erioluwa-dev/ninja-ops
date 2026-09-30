export interface ProjectileData {
  /** Px/s along its path. */
  speed: number;
  /** Frames before it expires in flight. */
  lifetime: number;
  size: { w: number; h: number };
  /** Distance from the shooter's feet to the spawn point. */
  spawnOffset: number;
  /** When false, a target with z > 0 is missed (jump beats it). */
  hitsAir: boolean;
  /** Hit data comes from this attack, so damage is tuned in one place. */
  attackId: string;
}

export const PROJECTILES = {
  oniBolt: {
    speed: 110,
    lifetime: 160,
    size: { w: 6, h: 6 },
    spawnOffset: 10,
    hitsAir: true,
    attackId: "oniBolt",
  },
} as const satisfies Record<string, ProjectileData>;
