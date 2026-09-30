import type { ActionFrame } from "../sim";
import type { Bindings, ButtonAction } from "./bindings";

export interface RawGamepad {
  axes: readonly number[];
  buttons: readonly boolean[];
}

export interface RawInputState {
  keys: ReadonlySet<string>;
  gamepad: RawGamepad | null;
}

const anyKey = (keys: ReadonlySet<string>, codes: readonly string[]): boolean =>
  codes.some((c) => keys.has(c));

const anyButton = (
  pad: RawGamepad | null,
  indices: readonly number[],
): boolean => pad !== null && indices.some((i) => pad.buttons[i] === true);

export function applyDeadzone(v: number, deadzone: number): number {
  return Math.abs(v) < deadzone ? 0 : v;
}

export function mapToActions(
  raw: RawInputState,
  bindings: Bindings,
): ActionFrame {
  const { keyboard: kb, gamepad: gp } = bindings;
  const pad = raw.gamepad;

  let x =
    (anyKey(raw.keys, kb.right) ? 1 : 0) - (anyKey(raw.keys, kb.left) ? 1 : 0);
  let y =
    (anyKey(raw.keys, kb.down) ? 1 : 0) - (anyKey(raw.keys, kb.up) ? 1 : 0);

  if (pad) {
    const dx =
      (pad.buttons[gp.dpad.right] ? 1 : 0) -
      (pad.buttons[gp.dpad.left] ? 1 : 0);
    const dy =
      (pad.buttons[gp.dpad.down] ? 1 : 0) - (pad.buttons[gp.dpad.up] ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      x += dx;
      y += dy;
    } else if (x === 0 && y === 0) {
      // Analog only fills in when no digital source is pushing, so keys stay full speed.
      x = applyDeadzone(pad.axes[gp.axisX] ?? 0, gp.deadzone);
      y = applyDeadzone(pad.axes[gp.axisY] ?? 0, gp.deadzone);
    }
  }

  x = Math.max(-1, Math.min(1, x));
  y = Math.max(-1, Math.min(1, y));
  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }

  const held = (a: ButtonAction): boolean =>
    anyKey(raw.keys, kb.actions[a]) || anyButton(pad, gp.actions[a]);

  return {
    moveX: x,
    moveY: y,
    attack: held("attack"),
    dodge: held("dodge"),
    block: held("block"),
    jump: held("jump"),
    spin: held("spin"),
    pause: held("pause"),
  };
}

export function keysHeld(
  raw: RawInputState,
  codes: readonly string[],
): boolean {
  return anyKey(raw.keys, codes);
}

export function debugHeld(raw: RawInputState, bindings: Bindings): boolean {
  return (
    anyKey(raw.keys, bindings.keyboard.debug) ||
    anyButton(raw.gamepad, bindings.gamepad.debug)
  );
}
