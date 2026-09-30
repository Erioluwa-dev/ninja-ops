import Phaser from "phaser";
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

export class ArenaScene extends Phaser.Scene {
  private state: SimState = createSim({ seed: SEED });
  private controls: PhaserInput | null = null;
  private view: SimRenderer | null = null;
  private actions: ActionFrame = IDLE;
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
  }

  // Phaser's delta is smoothed and clamped; the stepper needs the real elapsed
  // time so 60 Hz and 144 Hz displays run the same number of sim ticks. The
  // stepper does its own stall clamping, so the raw value is safe here.
  update(): void {
    if (!this.controls || !this.view) return;
    const snapshot = this.controls.poll();
    if (snapshot.debugPressed) this.view.toggleDebug();
    this.actions = snapshot.actions;
    this.stepper.advance(this.game.loop.rawDelta);
    this.view.render(this.state, this.game.loop.actualFps);
  }
}
