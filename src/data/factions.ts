export const FACTION_IDS = ["ninja", "oni", "neutral"] as const;
export type Faction = (typeof FACTION_IDS)[number];

// Neutral has no entries: it is hittable but never hostile, so training dummies
// and future props need no special-casing in targeting code.
export const HOSTILITY = {
  ninja: ["oni"],
  oni: ["ninja"],
  neutral: [],
} as const satisfies Record<Faction, readonly Faction[]>;

export function isHostile(a: Faction, b: Faction): boolean {
  const hostileToA: readonly Faction[] = HOSTILITY[a];
  return hostileToA.includes(b);
}

// Neutral is a valid target for anyone but never attacks, so the dummy can be
// hit by the player without being hostile to it.
export function canDamage(attacker: Faction, target: Faction): boolean {
  if (attacker === "neutral") return false;
  return target === "neutral" || isHostile(attacker, target);
}
