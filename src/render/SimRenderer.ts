import type Phaser from "phaser";
import {
  activeHitbox,
  attackPhase,
  canRestart,
  currentAttack,
  depthOrder,
  type Entity,
  type Faction,
  feetBox,
  type Hazard,
  holdsToken,
  isAirborne,
  isArmored,
  isSolidTile,
  projectileBox,
  SIM_HZ,
  type SimState,
  spinBox,
  telegraphBox,
  tokenCapacity,
  tokensInUse,
} from "../sim";

const FACTION_COLOR: Record<Faction, number> = {
  ninja: 0x3aa0ff,
  oni: 0xd83a3a,
  neutral: 0xc8b04a,
};

// Mobs are told apart by type, not just faction.
const MOB_COLOR: Record<string, number> = {
  melee: 0xd83a3a,
  ranged: 0xb04ad8,
  sweeper: 0xd8883a,
  oniBrute: 0x8a2a2a,
};
const PROJECTILE = 0xff7a3a;
const SPIN_RING = 0xbff4ff;
const SPIN_READY = 0xfff0a0;
const DIZZY = 0xffe060;
const TOKEN = 0xffd040;

const FLOOR = 0x1c1c2a;
const WALL = 0x4a4a66;
const SHADOW = 0x000000;
const HITBOX = 0x40ff70;
const ATTACK_BOX = 0xff4040;
const FLASH = 0xffffff;
const TELEGRAPH = 0xff8a30;
const SWEEP_TELEGRAPH = 0xffc040;
const UNBLOCKABLE = 0xff1e1e;
const ARMOR = 0xc8c8d8;
const BOSS_BAR = 0xd83a3a;
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
// The boss bar sits in the top wall row, right of the meters, so its name label
// can never collide with the bottom-left debug text.
const BOSS_BAR_W = 152;
const BOSS_BAR_X = 80;
const BOSS_BAR_Y = 9;
const BOTTOM_HUD_Y = 150;
const HAZARD_FADE_FRAMES = 24;
const VICTORY = "#80ff90";
const DEFEAT = "#ff6060";

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 2,
};

const hexString = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;

// Flashing every other pair of ticks reads as a blink at 60 Hz without strobing.
const blinkOn = (tick: number, period: number): boolean =>
  Math.floor(tick / period) % 2 === 0;

export class SimRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly hud: Phaser.GameObjects.Text;
  private readonly pausedLabel: Phaser.GameObjects.Text;
  private readonly bossLabel: Phaser.GameObjects.Text;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly waveLabel: Phaser.GameObjects.Text;
  private readonly elementLabel: Phaser.GameObjects.Text;
  private readonly bannerLabel: Phaser.GameObjects.Text;
  private readonly panelTitle: Phaser.GameObjects.Text;
  private readonly panelBody: Phaser.GameObjects.Text;
  private readonly labels = new Map<number, Phaser.GameObjects.Text>();
  private debug = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    this.hud = scene.add
      .text(2, 140, "", LABEL_STYLE)
      .setDepth(1000)
      .setVisible(false);
    scene.add.text(1, 0, "G", LABEL_STYLE).setDepth(1000).setColor("#50c8ff");
    scene.add.text(1, 8, "S", LABEL_STYLE).setDepth(1000).setColor("#ffd040");
    this.bossLabel = scene.add
      .text(BOSS_BAR_X, BOSS_BAR_Y - 1, "", LABEL_STYLE)
      .setOrigin(0, 1)
      .setDepth(1000)
      .setVisible(false);
    this.overlay = scene.add.graphics().setDepth(1500);
    this.waveLabel = scene.add
      .text(scene.scale.width - 2, BOTTOM_HUD_Y, "", LABEL_STYLE)
      .setOrigin(1, 0)
      .setDepth(1000);
    this.elementLabel = scene.add
      .text(2, BOTTOM_HUD_Y, "", LABEL_STYLE)
      .setDepth(1000);
    this.bannerLabel = scene.add
      .text(scene.scale.width / 2, 44, "", { ...LABEL_STYLE, fontSize: "16px" })
      .setOrigin(0.5)
      .setDepth(2000)
      .setVisible(false);
    this.panelTitle = scene.add
      .text(scene.scale.width / 2, 48, "", { ...LABEL_STYLE, fontSize: "16px" })
      .setOrigin(0.5)
      .setDepth(2000)
      .setVisible(false);
    this.panelBody = scene.add
      .text(scene.scale.width / 2, 80, "", { ...LABEL_STYLE, align: "center" })
      .setOrigin(0.5, 0)
      .setDepth(2000)
      .setVisible(false);
    this.pausedLabel = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2, "PAUSED", {
        ...LABEL_STYLE,
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(2000)
      .setVisible(false);
  }

  private drawSpin(state: SimState, e: Entity): void {
    const box = spinBox(e, state.tuning);
    if (!box) return;
    const g = this.gfx;
    const cx = e.pos.x;
    const cy = e.pos.y;
    const r = (box.maxX - box.minX) / 2;
    g.lineStyle(1, SPIN_RING, blinkOn(state.tick, 2) ? 1 : 0.6);
    g.strokeRect(box.minX + 0.5, box.minY + 0.5, r * 2 - 1, r * 2 - 1);
    const a = state.tick * 0.6;
    for (const off of [0, Math.PI / 2]) {
      const dx = Math.cos(a + off) * r;
      const dy = Math.sin(a + off) * r;
      g.lineBetween(cx - dx, cy - dy, cx + dx, cy + dy);
    }
  }

  private drawDizzy(state: SimState, e: Entity): void {
    if (e.state !== "dizzy") return;
    const top = e.pos.y + e.feet.h / 2 - e.z - e.bodyHeight;
    this.gfx.fillStyle(DIZZY, 1);
    for (let i = 0; i < 3; i++) {
      const a = state.tick * 0.2 + (i * Math.PI * 2) / 3;
      this.gfx.fillRect(
        Math.round(e.pos.x + Math.cos(a) * 6) - 1,
        Math.round(top - 2 + Math.sin(a) * 2) - 1,
        2,
        2,
      );
    }
  }

  private drawTelegraph(state: SimState, e: Entity): void {
    const g = this.gfx;
    const attack = currentAttack(e, state.tuning);
    if (!attack?.telegraph) return;
    const box = telegraphBox(e, state.tuning);
    const progress = (e.combat.attackFrame + 1) / attack.startup;
    if (box && attack.unblockable) {
      // Red and strobing is reserved for "block will not save you".
      const lit = blinkOn(state.tick, 3);
      g.fillStyle(lit ? UNBLOCKABLE : FLASH, lit ? 0.35 + 0.4 * progress : 0.5);
      g.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
    } else if (box && attack.sweep) {
      this.drawSweepBar(e, box, progress);
    } else if (box && attack.ground) {
      // A slam has no front: pulse an outline around the whole area.
      const w = box.maxX - box.minX;
      const h = box.maxY - box.minY;
      g.fillStyle(SWEEP_TELEGRAPH, 0.1 + 0.25 * progress);
      g.fillRect(box.minX, box.minY, w, h);
      g.lineStyle(1, SWEEP_TELEGRAPH, 0.9);
      g.strokeRect(box.minX + 0.5, box.minY + 0.5, w - 1, h - 1);
    } else if (box) {
      g.fillStyle(TELEGRAPH, 0.15 + 0.35 * progress);
      g.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
    } else if (attack.projectile !== undefined && progress <= 1) {
      // A projectile has no box yet, so show the lane it will fly along.
      const len = 120 * progress;
      g.fillStyle(TELEGRAPH, 0.2 + 0.3 * progress);
      const w = e.facing.x !== 0 ? len : 2;
      const h = e.facing.x !== 0 ? 2 : len;
      const x =
        e.facing.x > 0 ? e.pos.x : e.facing.x < 0 ? e.pos.x - len : e.pos.x - 1;
      const y =
        e.facing.y > 0 ? e.pos.y : e.facing.y < 0 ? e.pos.y - len : e.pos.y - 1;
      g.fillRect(x, y, w, h);
    }
  }

  // A sweep is wide and low: outline the whole reach, then fill a thin bar
  // that advances from the attacker's feet as the windup runs out.
  private drawSweepBar(
    e: Entity,
    box: { minX: number; maxX: number; minY: number; maxY: number },
    progress: number,
  ): void {
    const g = this.gfx;
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    g.lineStyle(1, SWEEP_TELEGRAPH, 0.6);
    g.strokeRect(box.minX + 0.5, box.minY + 0.5, w - 1, h - 1);
    g.fillStyle(SWEEP_TELEGRAPH, 0.35 + 0.4 * progress);
    if (e.facing.x !== 0) {
      const reach = w * progress;
      const x = e.facing.x > 0 ? box.minX : box.maxX - reach;
      g.fillRect(x, box.minY, reach, h);
    } else {
      const reach = h * progress;
      const y = e.facing.y > 0 ? box.minY : box.maxY - reach;
      g.fillRect(box.minX, y, w, reach);
    }
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
    this.drawHazards(state);

    const ordered = depthOrder(state.entities);
    for (const e of ordered) this.drawTelegraph(state, e);
    for (const e of ordered) {
      this.drawEntity(state, e);
      this.drawSpin(state, e);
      this.drawDizzy(state, e);
    }
    this.drawProjectiles(state);
    for (const e of ordered) {
      if (e.state !== "dead" && !this.isBoss(state, e)) this.drawHpBar(e);
    }
    this.drawBossBar(state, ordered);

    const player = state.entities.find((e) => e.kind === "player");
    if (player) this.drawMeters(state, player);
    this.drawFlowHud(state, player);

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
      if (holdsToken(state, e)) {
        g.fillStyle(TOKEN, 1);
        const top = e.pos.y + e.feet.h / 2 - e.z - e.bodyHeight;
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
    }
    const script = state.tuning.combat.dummy.scriptedAttack ? "on" : "off";
    this.hud.setText(
      `tick ${state.tick}  fps ${Math.round(fps)}  dummy atk ${script}  tokens ${tokensInUse(state)}/${tokenCapacity(state.tuning)}`,
    );
  }

  private drawHazards(state: SimState): void {
    for (const h of state.hazards) this.drawHazard(state, h);
  }

  private drawHazard(state: SimState, h: Hazard): void {
    const g = this.gfx;
    if (h.style === "ring") {
      // The hit lands on the first tick; the ring only sells the shockwave.
      const t = 1 - h.life / h.maxLife;
      const half = h.radius * (0.25 + 0.75 * t);
      g.fillStyle(h.color, 0.25 * (1 - t));
      g.fillRect(h.pos.x - half, h.pos.y - half, half * 2, half * 2);
      g.lineStyle(2, h.color, 1 - t * 0.7);
      g.strokeRect(h.pos.x - half, h.pos.y - half, half * 2, half * 2);
      return;
    }
    const fade = Math.min(1, h.life / HAZARD_FADE_FRAMES);
    const flicker = blinkOn(state.tick + h.id, 4) ? 0.45 : 0.6;
    g.fillStyle(h.color, flicker * fade);
    g.fillRect(
      h.pos.x - h.radius,
      h.pos.y - h.radius,
      h.radius * 2,
      h.radius * 2,
    );
    g.fillStyle(FLASH, 0.25 * fade);
    const core = h.radius / 2;
    g.fillRect(h.pos.x - core, h.pos.y - core, core * 2, core * 2);
  }

  private drawFlowHud(state: SimState, player: Entity | undefined): void {
    const { arenaFlow: flow, tuning } = state;
    const { phase } = flow;
    const total = tuning.flow.waves.length;
    const active = phase === "wave" || phase === "breather";

    this.waveLabel.setText(
      phase === "sandbox"
        ? "SANDBOX"
        : active
          ? `WAVE ${flow.wave}/${total}`
          : phase === "boss"
            ? "BOSS"
            : "",
    );

    const element = player?.element
      ? tuning.elements[player.element]
      : undefined;
    this.elementLabel
      .setText(element ? element.name.toUpperCase() : "NO ELEMENT")
      .setColor(element ? hexString(element.color) : "#8a8a9a");

    const bannerUp = flow.phaseTicks < tuning.flow.bannerFrames;
    const banner =
      phase === "wave" && bannerUp
        ? `WAVE ${flow.wave}`
        : phase === "boss" && bannerUp
          ? "BOSS"
          : phase === "breather" && bannerUp
            ? `WAVE ${flow.wave} CLEAR`
            : "";
    this.bannerLabel.setText(banner).setVisible(banner !== "");

    const o = this.overlay;
    o.clear();
    const showPanel =
      phase === "intro" || phase === "victory" || phase === "defeat";
    this.panelTitle.setVisible(showPanel);
    this.panelBody.setVisible(showPanel);
    if (!showPanel) return;
    o.fillStyle(BAR_BACK, 0.65);
    o.fillRect(0, 0, state.arena.cols * state.arena.tileSize, 160);

    if (phase === "intro") {
      this.panelTitle.setText("NINJA OPS").setColor("#ffffff");
      this.panelBody.setText(
        "ATTACK  start the run\nF5  element   F6  sandbox",
      );
      return;
    }
    const won = phase === "victory";
    const cleared = won
      ? `${flow.wavesCleared}/${total} + BOSS`
      : `${flow.wavesCleared}/${total}`;
    const seconds = (flow.runTicks / SIM_HZ).toFixed(1);
    const hits = player?.combat.hitsTaken ?? 0;
    this.panelTitle
      .setText(won ? "VICTORY" : "DEFEATED")
      .setColor(won ? VICTORY : DEFEAT);
    this.panelBody.setText(
      `Waves cleared  ${cleared}\nTime  ${seconds}s\nHits taken  ${hits}\n\n${canRestart(state) ? "ATTACK  restart" : ""}`,
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
      if (attack.unblockable) {
        return blinkOn(state.tick, 3) ? UNBLOCKABLE : FLASH;
      }
      return attack.ground ? SWEEP_TELEGRAPH : TELEGRAPH;
    }
    if (e.mobType !== null)
      return MOB_COLOR[e.mobType] ?? FACTION_COLOR[e.faction];
    return FACTION_COLOR[e.faction];
  }

  private drawProjectiles(state: SimState): void {
    const g = this.gfx;
    for (const p of state.projectiles) {
      const b = projectileBox(p, state.tuning);
      g.fillStyle(p.deflected ? FACTION_COLOR[p.faction] : PROJECTILE, 1);
      g.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
      if (this.debug) {
        g.lineStyle(1, ATTACK_BOX, 1);
        g.strokeRect(
          b.minX + 0.5,
          b.minY + 0.5,
          b.maxX - b.minX - 1,
          b.maxY - b.minY - 1,
        );
      }
    }
  }

  private bodyAlpha(state: SimState, e: Entity): number {
    if (e.state === "dodge") return 0.45;
    if (e.state === "dead") {
      const total = Math.max(1, state.tuning.combat.death.frames);
      return e.combat.stun > 0 ? (0.8 * e.combat.stun) / total : 0.3;
    }
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

    // The shadow stays on the ground and shrinks as the body rises, which is
    // what tells the eye how high a jump is.
    const lift = Math.min(0.5, e.z / 60);
    g.fillStyle(SHADOW, 0.4 * (1 - lift));
    g.fillEllipse(
      e.pos.x,
      e.pos.y,
      (e.feet.w + 4) * (1 - lift),
      (e.feet.h + 2) * (1 - lift),
    );

    g.fillStyle(this.bodyColor(state, e), this.bodyAlpha(state, e));
    g.fillRect(left, top, e.feet.w, e.bodyHeight);

    if (isArmored(e, state.tuning)) {
      g.lineStyle(1, ARMOR, 1);
      g.strokeRect(left + 0.5, top + 0.5, e.feet.w - 1, e.bodyHeight - 1);
    }

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

  private isBoss(state: SimState, e: Entity): boolean {
    return e.mobType !== null && state.tuning.mobs[e.mobType]?.bossBar === true;
  }

  private drawBossBar(state: SimState, entities: readonly Entity[]): void {
    const boss = entities.find(
      (e) => e.state !== "dead" && this.isBoss(state, e),
    );
    this.bossLabel.setVisible(boss !== undefined);
    if (!boss) return;
    const g = this.gfx;
    const x = BOSS_BAR_X;
    g.fillStyle(BAR_BACK, 0.8);
    g.fillRect(x - 1, BOSS_BAR_Y, BOSS_BAR_W + 2, 6);
    g.fillStyle(BOSS_BAR, 1);
    g.fillRect(
      x,
      BOSS_BAR_Y + 1,
      Math.round((BOSS_BAR_W * boss.hp) / boss.maxHp),
      4,
    );
    this.bossLabel.setText(boss.kitId);
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
    const spin = state.tuning.kits[player.kitId]?.spin;
    const ready =
      spin !== undefined &&
      spin !== null &&
      player.combat.spinMeter >= spin.minMeter;
    const bars: [number, number, number, number][] = [
      [1, player.combat.guard, guardMax, GUARD_BAR],
      [9, player.combat.spinMeter, spinMax, ready ? SPIN_READY : SPIN_BAR],
    ];
    for (const [y, value, max, color] of bars) {
      g.fillStyle(BAR_BACK, 0.7);
      g.fillRect(HUD_BAR_X - 1, y, HUD_BAR_W + 2, 6);
      g.fillStyle(color, 1);
      g.fillRect(HUD_BAR_X, y + 1, Math.round((HUD_BAR_W * value) / max), 4);
    }
    if (spin) {
      // The notch marks how much meter a spin needs to start.
      g.fillStyle(FLASH, 1);
      g.fillRect(
        HUD_BAR_X + Math.round((HUD_BAR_W * spin.minMeter) / spinMax),
        9,
        1,
        6,
      );
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
    const air = isAirborne(e, state.tuning) ? " AIR" : "";
    const detail = attack
      ? ` ${e.combat.comboIndex + 1}${attackPhase(attack, e.combat.attackFrame)[0]}`
      : "";
    label
      .setText(
        `${e.state}${air}${detail}${e.ai ? ` ${e.ai.mode}` : ""}${e.z > 0 ? ` z${e.z.toFixed(0)}` : ""}`,
      )
      .setPosition(
        Math.round(e.pos.x),
        Math.round(e.pos.y + e.feet.h / 2 - e.z - e.bodyHeight - 6),
      )
      .setVisible(true);
  }
}
