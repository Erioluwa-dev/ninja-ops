export const SIM_HZ = 60 as const;
export const FIXED_DT_MS: number = 1000 / SIM_HZ;

// Summing 1000/60 sixty times lands a hair under 1000; without slack a whole
// second of frames would yield 59 ticks depending on the display rate.
const EPSILON_MS = 1e-6;
const DEFAULT_MAX_TICKS_PER_ADVANCE = 5;

export function createFixedStepper(
  onTick: () => void,
  opts: { maxTicksPerAdvance?: number } = {},
): { advance(elapsedMs: number): number } {
  const maxTicks = opts.maxTicksPerAdvance ?? DEFAULT_MAX_TICKS_PER_ADVANCE;
  let accumulator = 0;

  return {
    advance(elapsedMs: number): number {
      if (Number.isFinite(elapsedMs) && elapsedMs > 0) {
        accumulator += elapsedMs;
      }
      let ticks = 0;
      while (accumulator + EPSILON_MS >= FIXED_DT_MS && ticks < maxTicks) {
        onTick();
        accumulator -= FIXED_DT_MS;
        ticks += 1;
      }
      if (accumulator + EPSILON_MS >= FIXED_DT_MS) {
        // Stalled tab: drop the backlog instead of replaying it in a burst.
        accumulator %= FIXED_DT_MS;
      }
      if (accumulator < 0) accumulator = 0;
      return ticks;
    },
  };
}
