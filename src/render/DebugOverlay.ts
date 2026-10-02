import type Phaser from "phaser";
import {
  activeHitbox,
  attackPhase,
  currentAttack,
  type Entity,
  feetBox,
  holdsToken,
  isAirborne,
  projectileBox,
  type SimState,
  spinBox,
  tokenCapacity,
  tokensInUse,
} from "../sim";
import { DEPTH } from "./depth";
import { bodyTop, LABEL_STYLE } from "./util";
import type { RenderFrame } from "./view";

const HITBOX = 0x40ff70;
const BODY_BOX = 0xff40ff;
const ATTACK_BOX = 0xff4040;
const TOKEN = 0xffd040;

/**
 * Everything the sim knows that art hides: body and feet rectangles, attack
 * and spin areas, projectile boxes, token holders, state labels and the stats
 * line. Hidden until toggled so the sprites carry the normal view.
 */
export class DebugOverlay {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly stats: Phaser.GameObjects.Text;
  private readonly labels = new Map<number, Phaser.GameObjects.Text>();
  private on = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.debug);
    this.stats = scene.add
      .text(2, 140, "", LABEL_STYLE)
      .setDepth(DEPTH.hudText)
      .setVisible(false);
  }

  toggle(): boolean {
    this.on = !this.on;
    this.stats.setVisible(this.on);
    if (!this.on) {
      this.gfx.clear();
      this.pruneLabels(new Set());
    }
    return this.on;
  }

  draw({ state, ordered }: RenderFrame, fps: number): void {
    if (!this.on) return;
    const g = this.gfx;
    g.clear();
    const seen = new Set<number>();
    for (const e of ordered) {
      this.drawBodyBox(e);
      const b = feetBox(e);
      g.lineStyle(1, HITBOX, 1);
      g.strokeRect(
        b.minX + 0.5,
        b.minY + 0.5,
        b.maxX - b.minX - 1,
        b.maxY - b.minY - 1,
      );
      if (holdsToken(state, e)) {
        g.fillStyle(TOKEN, 1);
        const top = bodyTop(e);
        g.fillTriangle(
          e.pos.x,
          top - 9,
          e.pos.x - 3,
          top - 13,
          e.pos.x + 3,
          top - 13,
        );
      }
      const spinArea = spinBox(e, state.tuning);
      if (spinArea) {
        g.lineStyle(1, ATTACK_BOX, 1);
        g.strokeRect(
          spinArea.minX + 0.5,
          spinArea.minY + 0.5,
          spinArea.maxX - spinArea.minX - 1,
          spinArea.maxY - spinArea.minY - 1,
        );
      }
      const hit = activeHitbox(e, state.tuning);
      if (hit) {
        g.fillStyle(ATTACK_BOX, 0.3);
        g.fillRect(
          hit.minX,
          hit.minY,
          hit.maxX - hit.minX,
          hit.maxY - hit.minY,
        );
        g.lineStyle(1, ATTACK_BOX, 1);
        g.strokeRect(
          hit.minX + 0.5,
          hit.minY + 0.5,
          hit.maxX - hit.minX - 1,
          hit.maxY - hit.minY - 1,
        );
      }
      this.updateLabel(state, e);
      seen.add(e.id);
    }
    for (const p of state.projectiles) {
      const b = projectileBox(p, state.tuning);
      g.lineStyle(1, ATTACK_BOX, 1);
      g.strokeRect(
        b.minX + 0.5,
        b.minY + 0.5,
        b.maxX - b.minX - 1,
        b.maxY - b.minY - 1,
      );
    }
    this.pruneLabels(seen);
    const script = state.tuning.combat.dummy.scriptedAttack ? "on" : "off";
    this.stats.setText(
      `tick ${state.tick}  fps ${Math.round(fps)}  dummy atk ${script}  tokens ${tokensInUse(state)}/${tokenCapacity(state.tuning)}`,
    );
  }

  destroy(): void {
    this.gfx.destroy();
    this.stats.destroy();
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear();
  }

  // The sim's body rectangle, so a sprite's art can be checked against it.
  private drawBodyBox(e: Entity): void {
    const top = bodyTop(e);
    this.gfx.lineStyle(1, BODY_BOX, 1);
    this.gfx.strokeRect(
      e.pos.x - e.feet.w / 2 + 0.5,
      top + 0.5,
      e.feet.w - 1,
      e.bodyHeight - 1,
    );
  }

  private updateLabel(state: SimState, e: Entity): void {
    let label = this.labels.get(e.id);
    if (!label) {
      label = this.scene.add
        .text(0, 0, "", LABEL_STYLE)
        .setDepth(DEPTH.hudText)
        .setOrigin(0.5, 1);
      this.labels.set(e.id, label);
    }
    const attack = currentAttack(e, state.tuning);
    const air = isAirborne(e, state.tuning) ? " AIR" : "";
    const detail = attack
      ? ` ${e.combat.comboIndex + 1}${attackPhase(attack, e.combat.attackFrame)[0]}`
      : "";
    label
      .setText(
        `${e.state}${air}${detail}${e.ai ? ` ${e.ai.mode}` : ""}${e.z > 0 ? ` z${e.z.toFixed(0)}` : ""}`,
      )
      .setPosition(Math.round(e.pos.x), Math.round(bodyTop(e) - 6))
      .setVisible(true);
  }

  // Labels of entities that left the arena are dropped rather than left behind.
  private pruneLabels(keep: ReadonlySet<number>): void {
    for (const [id, label] of this.labels) {
      if (keep.has(id)) continue;
      label.destroy();
      this.labels.delete(id);
    }
  }
}
