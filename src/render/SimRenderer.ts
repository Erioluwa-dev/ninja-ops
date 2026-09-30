import type Phaser from "phaser";
import {
  activeHitbox,
  attackPhase,
  currentAttack,
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
const ATTACK_BOX = 0xff4040;
const FLASH = 0xffffff;
const TELEGRAPH = 0xff8a30;
const STAGGER = 0xffe060;
const GUARD_BREAK = 0xa060ff;
const SHIELD = 0x9fe8ff;
const EYE = 0x101020;
const HP_BAR = 0x50e070;
const GUARD_BAR = 0x50c8ff;
const SPIN_BAR = 0xffd040;
const BAR_BACK = 0x000000;

const HP_BAR_W = 16;
const HUD_BAR_W = 60;
const HUD_BAR_X = 10;

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 2,
};

// Flashing every other pair of ticks reads as a blink at 60 Hz without strobing.
const blinkOn = (tick: number, period: number): boolean =>
  Math.floor(tick / period) % 2 === 0;

export class SimRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly hud: Phaser.GameObjects.Text;
  private readonly pausedLabel: Phaser.GameObjects.Text;
  private readonly labels = new Map<number, Phaser.GameObjects.Text>();
  private debug = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    this.hud = scene.add
      .text(2, 148, "", LABEL_STYLE)
      .setDepth(1000)
      .setVisible(false);
    scene.add.text(1, 0, "G", LABEL_STYLE).setDepth(1000).setColor("#50c8ff");
    scene.add.text(1, 8, "S", LABEL_STYLE).setDepth(1000).setColor("#ffd040");
    this.pausedLabel = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2, "PAUSED", {
        ...LABEL_STYLE,
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(2000)
      .setVisible(false);
  }

  toggleDebug(): void {
    this.debug = !this.debug;
    this.hud.setVisible(this.debug);
    if (!this.debug)
      for (const label of this.labels.values()) label.setVisible(false);
  }

  setPaused(paused: boolean): void {
    this.pausedLabel.setVisible(paused);
  }

  render(state: SimState, fps: number): void {
    const g = this.gfx;
    g.clear();
    this.drawArena(state);

    const ordered = depthOrder(state.entities);
    for (const e of ordered) this.drawEntity(state, e);
    for (const e of ordered) this.drawHpBar(e);

    const player = state.entities.find((e) => e.kind === "player");
    if (player) this.drawMeters(state, player);

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
    }
    const script = state.tuning.combat.dummy.scriptedAttack ? "on" : "off";
    this.hud.setText(
      `tick ${state.tick}  fps ${Math.round(fps)}  dummy atk ${script}`,
    );
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

  private bodyColor(state: SimState, e: Entity): number {
    if (e.combat.hitstop > 0) return FLASH;
    const stunned =
      e.state === "hurt" || e.state === "stagger" || e.state === "guardBreak";
    if (stunned) {
      if (blinkOn(state.tick, 2)) return FLASH;
      if (e.state === "stagger") return STAGGER;
      if (e.state === "guardBreak") return GUARD_BREAK;
    }
    const attack = currentAttack(e, state.tuning);
    if (
      attack?.telegraph &&
      attackPhase(attack, e.combat.attackFrame) === "startup"
    ) {
      return TELEGRAPH;
    }
    return FACTION_COLOR[e.faction];
  }

  private bodyAlpha(state: SimState, e: Entity): number {
    if (e.state === "dodge") return 0.45;
    const stunned =
      e.state === "hurt" || e.state === "stagger" || e.state === "guardBreak";
    if (!stunned && e.combat.hurtIframes > 0 && blinkOn(state.tick, 3)) {
      return 0.55;
    }
    return 1;
  }

  private drawEntity(state: SimState, e: Entity): void {
    const g = this.gfx;
    const footBottom = e.pos.y + e.feet.h / 2;
    const left = e.pos.x - e.feet.w / 2;
    const top = footBottom - e.z - e.bodyHeight;

    g.fillStyle(SHADOW, 0.35);
    g.fillRect(left, e.pos.y - e.feet.h / 2, e.feet.w, e.feet.h);

    g.fillStyle(this.bodyColor(state, e), this.bodyAlpha(state, e));
    g.fillRect(left, top, e.feet.w, e.bodyHeight);

    // A facing nub: without it, block direction and attack aim are unreadable.
    g.fillStyle(EYE, 1);
    if (e.facing.y > 0) g.fillRect(e.pos.x - 1, top + 3, 2, 2);
    else if (e.facing.x !== 0) {
      g.fillRect(e.pos.x + e.facing.x * (e.feet.w / 2 - 2) - 1, top + 3, 2, 2);
    }

    if (e.state === "block") {
      g.fillStyle(SHIELD, 0.8);
      const mid = top + e.bodyHeight / 2;
      if (e.facing.x !== 0) {
        const x = e.facing.x > 0 ? e.pos.x + e.feet.w / 2 : left - 2;
        g.fillRect(x, mid - 6, 2, 12);
      } else {
        const y = e.facing.y > 0 ? footBottom - 2 : top;
        g.fillRect(left - 1, y, e.feet.w + 2, 2);
      }
    }
  }

  private drawHpBar(e: Entity): void {
    const g = this.gfx;
    const top = e.pos.y + e.feet.h / 2 - e.z - e.bodyHeight;
    const x = Math.round(e.pos.x - HP_BAR_W / 2);
    const y = Math.round(top - 4);
    g.fillStyle(BAR_BACK, 0.7);
    g.fillRect(x - 1, y - 1, HP_BAR_W + 2, 4);
    g.fillStyle(HP_BAR, 1);
    g.fillRect(x, y, Math.round((HP_BAR_W * e.hp) / e.maxHp), 2);
  }

  private drawMeters(state: SimState, player: Entity): void {
    const g = this.gfx;
    const { guardMax } = state.tuning.combat.block;
    const { spinMax } = state.tuning.combat.meters;
    const bars: [number, number, number, number][] = [
      [1, player.combat.guard, guardMax, GUARD_BAR],
      [9, player.combat.spinMeter, spinMax, SPIN_BAR],
    ];
    for (const [y, value, max, color] of bars) {
      g.fillStyle(BAR_BACK, 0.7);
      g.fillRect(HUD_BAR_X - 1, y, HUD_BAR_W + 2, 6);
      g.fillStyle(color, 1);
      g.fillRect(HUD_BAR_X, y + 1, Math.round((HUD_BAR_W * value) / max), 4);
    }
  }

  private updateLabel(state: SimState, e: Entity): void {
    let label = this.labels.get(e.id);
    if (!label) {
      label = this.scene.add
        .text(0, 0, "", LABEL_STYLE)
        .setDepth(1000)
        .setOrigin(0.5, 1);
      this.labels.set(e.id, label);
    }
    const attack = currentAttack(e, state.tuning);
    const detail = attack
      ? ` ${e.combat.comboIndex + 1}${attackPhase(attack, e.combat.attackFrame)[0]}`
      : "";
    label
      .setText(`${e.state}${detail}`)
      .setPosition(
        Math.round(e.pos.x),
        Math.round(e.pos.y + e.feet.h / 2 - e.z - e.bodyHeight - 6),
      )
      .setVisible(true);
  }
}
