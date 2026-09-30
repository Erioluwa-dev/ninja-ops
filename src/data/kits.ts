export interface KitData {
  /** Pixels per second at full stick deflection. */
  moveSpeed: number;
  feet: { w: number; h: number };
  bodyHeight: number;
}

export const KITS = {
  ninja: {
    moveSpeed: 60,
    feet: { w: 10, h: 6 },
    bodyHeight: 20,
  },
  dummy: {
    moveSpeed: 0,
    feet: { w: 12, h: 8 },
    bodyHeight: 22,
  },
} as const satisfies Record<string, KitData>;

export type KitId = keyof typeof KITS;

function isKitId(kitId: string): kitId is KitId {
  return Object.hasOwn(KITS, kitId);
}

export function getKit(kitId: string): KitData {
  if (!isKitId(kitId)) {
    throw new Error(`Unknown kit id: ${kitId}`);
  }
  return KITS[kitId];
}
