/**
 * Frame and placement math for the FX sprites. Everything is a pure function of
 * sim counters (life, age, spin frame), never of a Phaser clock, so a freeze in
 * the sim or a pause holds the effect on its current frame.
 */

/** Flame sheet: frame 0 ignites, 1-7 burn at full height, 8-11 shrink away. */
export const FIRE_FRAMES = 12;
export const FIRE_LOOP_FIRST = 1;
export const FIRE_LOOP_FRAMES = 7;
export const FIRE_FADE_FIRST = 8;
export const FIRE_FADE_FRAMES = FIRE_FRAMES - FIRE_FADE_FIRST;
export const ROCK_FRAMES = 10;
export const SPIN_FRAMES = 6;
export const PROJECTILE_FRAMES = 4;

/** Sim ticks each frame of a looping effect stays up (60 ticks per second). */
export const FIRE_TICKS_PER_FRAME = 3;
export const SPIN_TICKS_PER_FRAME = 2;
export const PROJECTILE_TICKS_PER_FRAME = 3;

export const HAZARD_FADE_FRAMES = 24;

/** Frame of a one-shot effect that plays across its whole lifetime. */
export function lifeFrame(
  life: number,
  maxLife: number,
  frames: number,
): number {
  if (maxLife <= 0) return 0;
  const progress = (maxLife - life) / maxLife;
  return Math.min(frames - 1, Math.max(0, Math.floor(progress * frames)));
}

/** Frame of a looping effect that has been running for `age` ticks. */
export function loopFrame(
  age: number,
  ticksPerFrame: number,
  frames: number,
): number {
  const step = Math.floor(age / ticksPerFrame);
  return ((step % frames) + frames) % frames;
}

/**
 * Frame of one flame in a patch: it ignites, loops at full height while the
 * patch lives, then plays the shrink frames across the patch's last
 * HAZARD_FADE_FRAMES. `offset` keeps neighbouring flames out of step.
 */
export function fireFrame(life: number, age: number, offset: number): number {
  if (life <= HAZARD_FADE_FRAMES) {
    return (
      FIRE_FADE_FIRST + lifeFrame(life, HAZARD_FADE_FRAMES, FIRE_FADE_FRAMES)
    );
  }
  if (age < FIRE_TICKS_PER_FRAME) return 0;
  return (
    FIRE_LOOP_FIRST +
    loopFrame(age + offset, FIRE_TICKS_PER_FRAME, FIRE_LOOP_FRAMES)
  );
}

/** 1 while a patch is healthy, falling to 0 over its last HAZARD_FADE_FRAMES. */
export function hazardFade(life: number): number {
  return Math.min(1, Math.max(0, life / HAZARD_FADE_FRAMES));
}

/** How far a shockwave ring has grown: 0 on its first tick, nearing 1 as it expires. */
export function ringProgress(life: number, maxLife: number): number {
  return maxLife <= 0 ? 1 : 1 - life / maxLife;
}

/** Half-extent of the ring at progress `t`; it starts at a quarter of its radius. */
export function ringHalf(radius: number, t: number): number {
  return radius * (0.25 + 0.75 * t);
}

/**
 * Where rock clusters stand around a ring of half-extent `half`: the corners
 * and edge midpoints of its square, ordered top to bottom so lower clusters
 * draw over upper ones.
 */
export function ringAnchors(
  half: number,
): readonly { readonly x: number; readonly y: number }[] {
  const anchors: { x: number; y: number }[] = [];
  for (const row of [-1, 0, 1]) {
    for (const col of [-1, 0, 1]) {
      if (row === 0 && col === 0) continue;
      anchors.push({ x: col * half, y: row * half });
    }
  }
  return anchors;
}

/**
 * The two spin slashes sit half a cycle apart, and the second is drawn turned
 * 180 degrees, so the ring reads as continuous rather than as one arc blinking.
 */
export function spinFrames(spinFrame: number): readonly [number, number] {
  const first = loopFrame(spinFrame, SPIN_TICKS_PER_FRAME, SPIN_FRAMES);
  return [first, (first + Math.floor(SPIN_FRAMES / 2)) % SPIN_FRAMES];
}

/**
 * Rotation that turns a sprite drawn heading `drawnHeading` (radians, screen
 * space, 0 = right, clockwise positive) to head along `vel`.
 */
export function headingRotation(
  vel: { readonly x: number; readonly y: number },
  drawnHeading: number,
): number {
  if (vel.x === 0 && vel.y === 0) return 0;
  return Math.atan2(vel.y, vel.x) - drawnHeading;
}

/** A strobe's own clock, so it can stop while its attacker is frozen. */
export interface StrobeClock {
  readonly tick: number;
  readonly clock: number;
}

/**
 * Advances a strobe clock to sim tick `tick`. It runs with the sim but holds
 * while the attacker is in hitstop, so a frozen windup does not keep blinking.
 */
export function advanceStrobe(
  prev: StrobeClock | undefined,
  tick: number,
  hitstop: number,
): StrobeClock {
  if (!prev) return { tick, clock: tick };
  const elapsed = Math.max(0, tick - prev.tick);
  return { tick, clock: prev.clock + (hitstop > 0 ? 0 : elapsed) };
}
