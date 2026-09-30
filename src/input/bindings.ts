import type { ActionFrame } from "../sim";

export type ButtonAction = Exclude<keyof ActionFrame, "moveX" | "moveY">;

export interface Bindings {
  keyboard: {
    left: readonly string[];
    right: readonly string[];
    up: readonly string[];
    down: readonly string[];
    actions: Record<ButtonAction, readonly string[]>;
    debug: readonly string[];
  };
  gamepad: {
    dpad: { left: number; right: number; up: number; down: number };
    axisX: number;
    axisY: number;
    deadzone: number;
    actions: Record<ButtonAction, readonly number[]>;
    debug: readonly number[];
  };
}

// Keyboard uses KeyboardEvent.code; gamepad uses W3C "standard" button indices.
export const DEFAULT_BINDINGS: Bindings = {
  keyboard: {
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    up: ["ArrowUp", "KeyW"],
    down: ["ArrowDown", "KeyS"],
    actions: {
      attack: ["KeyJ"],
      dodge: ["KeyK"],
      jump: ["Space"],
      block: ["KeyL"],
      spin: ["KeyI"],
      pause: ["Escape"],
    },
    debug: ["Backquote"],
  },
  gamepad: {
    dpad: { up: 12, down: 13, left: 14, right: 15 },
    axisX: 0,
    axisY: 1,
    deadzone: 0.2,
    actions: {
      attack: [0],
      dodge: [1],
      jump: [2],
      block: [4],
      spin: [5],
      pause: [9],
    },
    debug: [8],
  },
};
