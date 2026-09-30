import Phaser from "phaser";
import type { TuningPanel } from "../dev/tuningPanel";
import { PhaserInput } from "../input";
import { SimRenderer } from "../render";
import {
  type ActionFrame,
  createFixedStepper,
  createSim,
  type SimState,
  step,
} from "../sim";

const SEED = 0x4e494e4a;

const IDLE: ActionFrame = {
  moveX: 0,
  moveY: 0,
  attack: false,
  dodge: false,
  block: false,
  jump: false,
  spin: false,
  pause: false,
};

// Movement is a level, so the newest reading wins; button presses are edges
// that must survive a render frame in which no sim tick ran.
function mergeButtons(older: ActionFrame, newer: ActionFrame): ActionFrame {
  return {
    ...newer,
    attack: older.attack || newer.attack,
    dodge: older.dodge || newer.dodge,
    jump: older.jump || newer.jump,
    spin: older.spin || newer.spin,
    block: older.block || newer.block,
  };
}

export class ArenaScene extends Phaser.Scene {
  private state: SimState = createSim({ seed: SEED });
  private controls: PhaserInput | null = null;
  private view: SimRenderer | null = null;
  private panel: TuningPanel | null = null;
  private actions: ActionFrame = IDLE;
  private unconsumed: ActionFrame | null = null;
  private paused = false;
  private pauseWasHeld = false;
  private readonly stepper = createFixedStepper(() =>
    step(this.state, this.actions),
  );

  constructor() {
    super("ArenaScene");
  }

  create(): void {
    this.state = createSim({ seed: SEED });
    this.controls = new PhaserInput(this);
    this.view = new SimRenderer(this);
    // Inline in the DEV branch so the bundler drops the import, and Tweakpane
    // with it, from production builds.
    if (import.meta.env.DEV) {
      const { tuning } = this.state;
      import("../dev/tuningPanel")
        .then((mod) => {
          this.panel = mod.createTuningPanel(tuning);
        })
        .catch((error: unknown) => {
          console.error("Failed to load the tuning panel", error);
        });
    }
  }

  // Phaser's delta is smoothed and clamped; the stepper needs the real elapsed
  // time so 60 Hz and 144 Hz displays run the same number of sim ticks. The
  // stepper does its own stall clamping, so the raw value is safe here.
  update(): void {
    if (!this.controls || !this.view) return;
    const snapshot = this.controls.poll();
    if (snapshot.debugPressed) this.view.toggleDebug();
    if (snapshot.tuningPanelPressed) this.panel?.toggle();
    if (snapshot.dummyAttackPressed) this.toggleDummyAttack();

    const pauseHeld = snapshot.actions.pause;
    if (pauseHeld && !this.pauseWasHeld) {
      this.paused = !this.paused;
      this.unconsumed = null;
      this.view.setPaused(this.paused);
    }
    this.pauseWasHeld = pauseHeld;

    if (!this.paused) {
      this.actions = this.unconsumed
        ? mergeButtons(this.unconsumed, snapshot.actions)
        : snapshot.actions;
      const ticks = this.stepper.advance(this.game.loop.rawDelta);
      this.unconsumed = ticks === 0 ? this.actions : null;
    }
    this.view.render(this.state, this.game.loop.actualFps);
  }

  private toggleDummyAttack(): void {
    const script = this.state.tuning.combat.dummy;
    script.scriptedAttack = !script.scriptedAttack;
    this.panel?.refresh();
  }
}
