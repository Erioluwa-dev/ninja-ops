import { describe, expect, it } from "vitest";
import { DEFAULT_BINDINGS } from "./bindings";
import {
  applyDeadzone,
  mapToActions,
  type RawInputState,
} from "./mapToActions";

const raw = (
  keys: string[] = [],
  gamepad: RawInputState["gamepad"] = null,
): RawInputState => ({
  keys: new Set(keys),
  gamepad,
});

const pad = (axes: number[] = [0, 0], pressed: number[] = []) => ({
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => pressed.includes(i)),
});

const map = (r: RawInputState) => mapToActions(r, DEFAULT_BINDINGS);

describe("mapToActions", () => {
  it("returns an idle frame with no input", () => {
    expect(map(raw())).toEqual({
      moveX: 0,
      moveY: 0,
      attack: false,
      dodge: false,
      block: false,
      jump: false,
      spin: false,
      pause: false,
    });
  });

  it("maps keyboard actions as held states", () => {
    const a = map(raw(["KeyA", "KeyQ", "KeyX", "KeyD", "KeyW", "Escape"]));
    expect(a).toMatchObject({
      attack: true,
      dodge: true,
      jump: true,
      block: true,
      spin: true,
      pause: true,
    });
  });

  // The owner's chosen layout; a change here must be deliberate, not a side effect.
  it("keeps the agreed keyboard layout", () => {
    const { keyboard } = DEFAULT_BINDINGS;
    expect({
      left: keyboard.left,
      right: keyboard.right,
      up: keyboard.up,
      down: keyboard.down,
      ...keyboard.actions,
    }).toEqual({
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      attack: ["KeyA"],
      dodge: ["KeyQ"],
      jump: ["KeyX"],
      block: ["KeyD"],
      spin: ["KeyW"],
      pause: ["Escape"],
    });
  });

  it("moves with arrow keys only", () => {
    expect(map(raw(["ArrowLeft"])).moveX).toBe(-1);
    expect(map(raw(["ArrowRight"])).moveX).toBe(1);
    expect(map(raw(["ArrowUp"])).moveY).toBe(-1);
    // Letter keys are all actions now, so none of them may also steer.
    expect(map(raw(["KeyA", "KeyD", "KeyW", "KeyS"]))).toMatchObject({
      moveX: 0,
      moveY: 0,
    });
    expect(map(raw(["ArrowDown"])).moveY).toBe(1);
  });

  it("cancels opposing directions", () => {
    expect(map(raw(["ArrowLeft", "ArrowRight"])).moveX).toBe(0);
  });

  it("normalizes keyboard diagonals to magnitude 1", () => {
    const a = map(raw(["ArrowRight", "ArrowDown"]));
    expect(Math.hypot(a.moveX, a.moveY)).toBeCloseTo(1, 10);
    expect(a.moveX).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it("maps gamepad buttons", () => {
    const a = map(raw([], pad([0, 0], [0, 1, 2, 4, 5, 9])));
    expect(a).toMatchObject({
      attack: true,
      dodge: true,
      jump: true,
      block: true,
      spin: true,
      pause: true,
    });
  });

  it("maps the D-pad to movement", () => {
    expect(map(raw([], pad([0, 0], [14]))).moveX).toBe(-1);
  });

  it("applies the analog deadzone", () => {
    expect(applyDeadzone(0.1, 0.2)).toBe(0);
    expect(applyDeadzone(-0.19, 0.2)).toBe(0);
    expect(applyDeadzone(0.5, 0.2)).toBe(0.5);
    const a = map(raw([], pad([0.1, -0.15])));
    expect(a.moveX).toBe(0);
    expect(a.moveY).toBe(0);
  });

  it("passes analog values through and clamps corner magnitude to 1", () => {
    expect(map(raw([], pad([0.5, 0]))).moveX).toBe(0.5);
    const corner = map(raw([], pad([1, 1])));
    expect(Math.hypot(corner.moveX, corner.moveY)).toBeCloseTo(1, 10);
  });

  it("merges keyboard and D-pad without exceeding magnitude 1", () => {
    const a = map(raw(["ArrowRight"], pad([0, 0], [13])));
    expect(a.moveX).toBeGreaterThan(0);
    expect(a.moveY).toBeGreaterThan(0);
    expect(Math.hypot(a.moveX, a.moveY)).toBeCloseTo(1, 10);
  });

  it("ORs keyboard and gamepad actions", () => {
    const a = map(raw(["KeyA"], pad([0, 0], [2])));
    expect(a.attack).toBe(true);
    expect(a.jump).toBe(true);
    expect(a.dodge).toBe(false);
  });

  it("prefers keyboard over the analog stick when both push", () => {
    expect(map(raw(["ArrowLeft"], pad([1, 0]))).moveX).toBe(-1);
  });
});
