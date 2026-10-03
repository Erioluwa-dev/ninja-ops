import type Phaser from "phaser";
import { depthOrder, type SimState } from "../sim";
import { ActorView } from "./ActorView";
import { ArenaView } from "./ArenaView";
import { DebugOverlay } from "./DebugOverlay";
import { FxView } from "./FxView";
import { HudView } from "./HudView";
import type { RenderFrame, RenderView } from "./view";

/**
 * Orchestrates the views and the debug overlay. It owns no drawing of its own,
 * so a change to how bodies, effects, tiles or the HUD look stays in that view.
 */
export class SimRenderer {
  private readonly views: readonly RenderView[];
  private readonly hud: HudView;
  private readonly debug: DebugOverlay;

  constructor(scene: Phaser.Scene) {
    this.hud = new HudView(scene);
    this.views = [
      new ArenaView(scene),
      new FxView(scene),
      new ActorView(scene),
      this.hud,
    ];
    this.debug = new DebugOverlay(scene);
  }

  toggleDebug(): void {
    this.debug.toggle();
  }

  setResultAction(label: string): void {
    this.hud.setResultAction(label);
  }

  setPaused(paused: boolean): void {
    this.hud.setPaused(paused);
  }

  render(state: SimState, fps: number): void {
    const frame: RenderFrame = {
      state,
      ordered: depthOrder(state.entities),
      player: state.entities.find((e) => e.kind === "player"),
    };
    for (const view of this.views) view.draw(frame);
    this.debug.draw(frame, fps);
  }

  destroy(): void {
    for (const view of this.views) view.destroy();
    this.debug.destroy();
  }
}
