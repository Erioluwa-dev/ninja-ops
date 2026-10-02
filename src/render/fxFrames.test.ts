import { describe, expect, it } from "vitest";
import {
  advanceStrobe,
  FIRE_FADE_FIRST,
  FIRE_FRAMES,
  FIRE_LOOP_FIRST,
  FIRE_LOOP_FRAMES,
  fireFrame,
  HAZARD_FADE_FRAMES,
  hazardFade,
  headingRotation,
  lifeFrame,
  loopFrame,
  ROCK_FRAMES,
  ringAnchors,
  ringHalf,
  ringProgress,
  SPIN_FRAMES,
  spinFrames,
} from "./fxFrames";

describe("lifeFrame", () => {
  it("starts on the first frame and ends on the last", () => {
    expect(lifeFrame(14, 14, ROCK_FRAMES)).toBe(0);
    expect(lifeFrame(1, 14, ROCK_FRAMES)).toBe(ROCK_FRAMES - 1);
  });

  it("never leaves the sheet, even for a stray life value", () => {
    expect(lifeFrame(0, 14, ROCK_FRAMES)).toBe(ROCK_FRAMES - 1);
    expect(lifeFrame(99, 14, ROCK_FRAMES)).toBe(0);
    expect(lifeFrame(5, 0, ROCK_FRAMES)).toBe(0);
  });

  it("only moves forward as life runs out", () => {
    let last = -1;
    for (let life = 14; life >= 1; life -= 1) {
      const frame = lifeFrame(life, 14, ROCK_FRAMES);
      expect(frame).toBeGreaterThanOrEqual(last);
      last = frame;
    }
  });
});

describe("loopFrame", () => {
  it("holds each frame for its ticks, then wraps", () => {
    expect(loopFrame(0, 3, FIRE_FRAMES)).toBe(0);
    expect(loopFrame(2, 3, FIRE_FRAMES)).toBe(0);
    expect(loopFrame(3, 3, FIRE_FRAMES)).toBe(1);
    expect(loopFrame(3 * FIRE_FRAMES, 3, FIRE_FRAMES)).toBe(0);
  });

  it("stays in range for negative ages", () => {
    expect(loopFrame(-1, 3, FIRE_FRAMES)).toBe(FIRE_FRAMES - 1);
  });

  it("maps an age to a fixed frame, so a frozen sim holds still", () => {
    expect(loopFrame(41, 3, FIRE_FRAMES)).toBe(1);
  });
});

describe("hazardFade", () => {
  it("is full until the last stretch, then falls to nothing", () => {
    expect(hazardFade(150)).toBe(1);
    expect(hazardFade(HAZARD_FADE_FRAMES)).toBe(1);
    expect(hazardFade(HAZARD_FADE_FRAMES / 2)).toBeCloseTo(0.5);
    expect(hazardFade(0)).toBe(0);
    expect(hazardFade(-3)).toBe(0);
  });
});

describe("fireFrame", () => {
  const MAX_LIFE = 150;

  it("ignites on frame 0, then loops the full-height frames", () => {
    expect(fireFrame(MAX_LIFE, 0, 0)).toBe(0);
    for (let age = 3; age < 100; age += 1) {
      const frame = fireFrame(MAX_LIFE - age, age, 7);
      expect(frame).toBeGreaterThanOrEqual(FIRE_LOOP_FIRST);
      expect(frame).toBeLessThan(FIRE_LOOP_FIRST + FIRE_LOOP_FRAMES);
    }
  });

  it("plays the shrink frames across the last HAZARD_FADE_FRAMES, in order", () => {
    expect(fireFrame(HAZARD_FADE_FRAMES, 100, 0)).toBe(FIRE_FADE_FIRST);
    expect(fireFrame(1, 100, 0)).toBe(FIRE_FRAMES - 1);
    let last = FIRE_FADE_FIRST;
    for (let life = HAZARD_FADE_FRAMES; life >= 1; life -= 1) {
      const frame = fireFrame(life, 100, 3);
      expect(frame).toBeGreaterThanOrEqual(last);
      last = frame;
    }
  });
});

describe("advanceStrobe", () => {
  it("starts in step with the sim tick", () => {
    expect(advanceStrobe(undefined, 40, 0)).toEqual({ tick: 40, clock: 40 });
  });

  it("runs with the sim while the attacker is free", () => {
    const first = advanceStrobe(undefined, 40, 0);
    expect(advanceStrobe(first, 43, 0).clock).toBe(43);
  });

  it("holds its phase while the attacker is in hitstop, then resumes", () => {
    const first = advanceStrobe(undefined, 40, 0);
    const held = advanceStrobe(advanceStrobe(first, 41, 3), 42, 2);
    expect(held.clock).toBe(40);
    expect(advanceStrobe(held, 43, 0).clock).toBe(41);
  });

  it("never runs backwards if the tick does", () => {
    const first = advanceStrobe(undefined, 40, 0);
    expect(advanceStrobe(first, 10, 0).clock).toBe(40);
  });
});

describe("shockwave ring", () => {
  it("grows from a quarter of its radius to the full area", () => {
    expect(ringProgress(14, 14)).toBe(0);
    expect(ringHalf(44, 0)).toBe(11);
    expect(ringHalf(44, 1)).toBe(44);
  });

  it("places eight clusters around the square, top row first", () => {
    const anchors = ringAnchors(10);
    expect(anchors).toHaveLength(8);
    expect(anchors[0]).toEqual({ x: -10, y: -10 });
    expect(anchors[7]).toEqual({ x: 10, y: 10 });
    const ys = anchors.map((a) => a.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });
});

describe("spinFrames", () => {
  it("keeps both slashes on the sheet and half a cycle apart", () => {
    for (let spinFrame = 0; spinFrame < 60; spinFrame += 1) {
      const [a, b] = spinFrames(spinFrame);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(SPIN_FRAMES);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(SPIN_FRAMES);
      expect(a).not.toBe(b);
    }
  });
});

describe("headingRotation", () => {
  const UP = -Math.PI / 2;
  const DIAGONAL = -Math.PI / 4;

  it("needs no turn when the sprite already heads that way", () => {
    expect(headingRotation({ x: 0, y: -50 }, UP)).toBeCloseTo(0);
  });

  it("turns an up-heading sprite a quarter turn to fly right", () => {
    expect(headingRotation({ x: 50, y: 0 }, UP)).toBeCloseTo(Math.PI / 2);
  });

  it("turns an up-right comet to every cardinal heading", () => {
    expect(headingRotation({ x: 50, y: 0 }, DIAGONAL)).toBeCloseTo(Math.PI / 4);
    expect(headingRotation({ x: 0, y: 50 }, DIAGONAL)).toBeCloseTo(
      (3 * Math.PI) / 4,
    );
  });

  it("leaves a stationary projectile unturned", () => {
    expect(headingRotation({ x: 0, y: 0 }, DIAGONAL)).toBe(0);
  });
});
