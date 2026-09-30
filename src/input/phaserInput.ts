import Phaser from "phaser";
import type { ActionFrame } from "../sim";
import { type Bindings, DEFAULT_BINDINGS } from "./bindings";
import {
  debugHeld,
  keysHeld,
  mapToActions,
  type RawGamepad,
  type RawInputState,
} from "./mapToActions";

export interface InputSnapshot {
  actions: ActionFrame;
  debugPressed: boolean;
  tuningPanelPressed: boolean;
  dummyAttackPressed: boolean;
  spawnWavePressed: boolean;
  spawnBrutePressed: boolean;
  cycleElementPressed: boolean;
  toggleSandboxPressed: boolean;
}

export class PhaserInput {
  private readonly keys = new Set<string>();
  // A tap whose keydown and keyup both land between two polls would otherwise
  // never be seen; it counts as held for the next poll instead.
  private readonly tappedSincePoll = new Set<string>();
  private debugWasHeld = false;
  private panelWasHeld = false;
  private dummyWasHeld = false;
  private spawnWasHeld = false;
  private bruteWasHeld = false;
  private elementWasHeld = false;
  private sandboxWasHeld = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: Bindings = DEFAULT_BINDINGS,
  ) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    // F1 opens the browser's help; the dev keys must not reach the browser.
    kb.addCapture(
      [
        ...bindings.keyboard.tuningPanel,
        ...bindings.keyboard.dummyAttack,
        ...bindings.keyboard.spawnWave,
        ...bindings.keyboard.spawnBrute,
        ...bindings.keyboard.cycleElement,
        ...bindings.keyboard.toggleSandbox,
      ].join(","),
    );
    kb.on("keydown", (e: KeyboardEvent) => {
      this.keys.add(e.code);
      this.tappedSincePoll.add(e.code);
    });
    kb.on("keyup", (e: KeyboardEvent) => this.keys.delete(e.code));
    // Keyup never fires for keys released while the window is unfocused.
    scene.game.events.on(Phaser.Core.Events.BLUR, () => {
      this.keys.clear();
      this.tappedSincePoll.clear();
    });
  }

  poll(): InputSnapshot {
    const keys = new Set([...this.keys, ...this.tappedSincePoll]);
    this.tappedSincePoll.clear();
    const raw: RawInputState = { keys, gamepad: this.readGamepad() };

    const debug = debugHeld(raw, this.bindings);
    const panel = keysHeld(raw, this.bindings.keyboard.tuningPanel);
    const dummy = keysHeld(raw, this.bindings.keyboard.dummyAttack);
    const spawn = keysHeld(raw, this.bindings.keyboard.spawnWave);
    const brute = keysHeld(raw, this.bindings.keyboard.spawnBrute);
    const element = keysHeld(raw, this.bindings.keyboard.cycleElement);
    const sandbox = keysHeld(raw, this.bindings.keyboard.toggleSandbox);
    const snapshot: InputSnapshot = {
      actions: mapToActions(raw, this.bindings),
      debugPressed: debug && !this.debugWasHeld,
      tuningPanelPressed: panel && !this.panelWasHeld,
      dummyAttackPressed: dummy && !this.dummyWasHeld,
      spawnWavePressed: spawn && !this.spawnWasHeld,
      spawnBrutePressed: brute && !this.bruteWasHeld,
      cycleElementPressed: element && !this.elementWasHeld,
      toggleSandboxPressed: sandbox && !this.sandboxWasHeld,
    };
    this.debugWasHeld = debug;
    this.panelWasHeld = panel;
    this.dummyWasHeld = dummy;
    this.spawnWasHeld = spawn;
    this.bruteWasHeld = brute;
    this.elementWasHeld = element;
    this.sandboxWasHeld = sandbox;
    return snapshot;
  }

  private readGamepad(): RawGamepad | null {
    const plugin = this.scene.input.gamepad;
    if (!plugin) return null;
    const pad = plugin.getAll().find((p) => p.connected);
    if (!pad) return null;
    return {
      axes: pad.axes.map((a) => a.getValue()),
      buttons: pad.buttons.map((b) => b.pressed),
    };
  }
}
