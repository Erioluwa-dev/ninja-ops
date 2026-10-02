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
    /** Dev tools: F1 toggles the tuning panel, F2 the dummy's scripted attack, F3 spawns a wave, F4 a brute, F5 cycles the element, F6 toggles sandbox mode. */
    tuningPanel: readonly string[];
    dummyAttack: readonly string[];
    spawnWave: readonly string[];
    spawnBrute: readonly string[];
    cycleElement: readonly string[];
    toggleSandbox: readonly string[];
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
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    actions: {
      attack: ["KeyA"],
      dodge: ["KeyQ"],
      jump: ["KeyX"],
      block: ["KeyD"],
      spin: ["KeyW"],
      pause: ["Escape"],
    },
    debug: ["Backquote"],
    tuningPanel: ["F1"],
    dummyAttack: ["F2"],
    spawnWave: ["F3"],
    spawnBrute: ["F4"],
    cycleElement: ["F5"],
    toggleSandbox: ["F6"],
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
