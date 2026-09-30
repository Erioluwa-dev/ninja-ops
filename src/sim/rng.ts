// mulberry32 with the state held in the caller's object so the whole sim
// stays serializable; returns a float in [0, 1).
export function nextFloat(holder: { rngState: number }): number {
  holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0;
  let t = holder.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A well-mixed seed for run `index`, so restarts differ but stay reproducible. */
export function deriveSeed(base: number, index: number): number {
  const holder = { rngState: (base + Math.imul(index, 0x9e3779b1)) >>> 0 };
  return Math.floor(nextFloat(holder) * 4294967296) >>> 0;
}
