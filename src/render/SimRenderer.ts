import type Phaser from "phaser";
import {
  depthOrder,
  type Entity,
  type Faction,
  feetBox,
  isSolidTile,
  type SimState,
} from "../sim";

const FACTION_COLOR: Record<Faction, number> = {
  ninja: 0x3aa0ff,
  oni: 0xd83a3a,
  neutral: 0xc8b04a,
};

const FLOOR = 0x1c1c2a;
const WALL = 0x4a4a66;
const SHADOW = 0x000000;
const HITBOX = 0x40ff70;

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 2,
};

export class SimRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly hud: Phaser.GameObjects.Text;
  private readonly labels = new Map<number, Phaser.GameObjects.Text>();
  private debug = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    this.hud = scene.add
      .text(2, 2, "", LABEL_STYLE)
      .setDepth(1000)
      .setVisible(false);
  }

  toggleDebug(): void {
    this.debug = !this.debug;
    this.hud.setVisible(this.debug);
    if (!this.debug)
      for (const label of this.labels.values()) label.setVisible(false);
  }

  render(state: SimState, fps: number): void {
    const g = this.gfx;
    g.clear();
    this.drawArena(state);

    const ordered = depthOrder(state.entities);
    for (const e of ordered) this.drawEntity(e);

    if (!this.debug) return;
    for (const e of ordered) {
      const b = feetBox(e);
      g.lineStyle(1, HITBOX, 1);
      g.strokeRect(
        b.minX + 0.5,
        b.minY + 0.5,
        b.maxX - b.minX - 1,
        b.maxY - b.minY - 1,
      );
      this.updateLabel(e);
    }
    this.hud.setText(`tick ${state.tick}  fps ${Math.round(fps)}`);
  }

  private drawArena(state: SimState): void {
    const { arena } = state;
    const g = this.gfx;
    g.fillStyle(FLOOR, 1);
    g.fillRect(0, 0, arena.cols * arena.tileSize, arena.rows * arena.tileSize);
    g.fillStyle(WALL, 1);
    for (let row = 0; row < arena.rows; row++) {
      for (let col = 0; col < arena.cols; col++) {
        if (isSolidTile(arena, col, row)) {
          g.fillRect(
            col * arena.tileSize,
            row * arena.tileSize,
            arena.tileSize,
            arena.tileSize,
          );
        }
      }
    }
  }

  private drawEntity(e: Entity): void {
    const g = this.gfx;
    const footBottom = e.pos.y + e.feet.h / 2;
    const left = e.pos.x - e.feet.w / 2;

    g.fillStyle(SHADOW, 0.35);
    g.fillRect(left, e.pos.y - e.feet.h / 2, e.feet.w, e.feet.h);

    g.fillStyle(FACTION_COLOR[e.faction], 1);
    g.fillRect(left, footBottom - e.z - e.bodyHeight, e.feet.w, e.bodyHeight);
  }

  private updateLabel(e: Entity): void {
    let label = this.labels.get(e.id);
    if (!label) {
      label = this.scene.add
        .text(0, 0, "", LABEL_STYLE)
        .setDepth(1000)
        .setOrigin(0.5, 1);
      this.labels.set(e.id, label);
    }
    label
      .setText(e.state)
      .setPosition(
        Math.round(e.pos.x),
        Math.round(e.pos.y + e.feet.h / 2 - e.z - e.bodyHeight - 1),
      )
      .setVisible(true);
  }
}
