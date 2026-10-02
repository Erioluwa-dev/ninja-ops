import type Phaser from "phaser";
import { canRestart, type Entity, type SimState } from "../sim";
import { HUD_KEY } from "./assets";
import { DEPTH } from "./depth";
import { HudLabel, registerHudFont } from "./hudLabel";
import {
  bannerText,
  bossName,
  INTRO_BODY,
  INTRO_TITLE,
  lineCount,
  meterWidth,
  resultBody,
  resultTitle,
  waveLabel,
} from "./hudText";
import { BAR_BACK, FLASH } from "./palette";
import { isBoss } from "./util";
import type { RenderFrame, RenderView } from "./view";

const BOSS_BAR = 0xd83a3a;
const GUARD_BAR = 0x50c8ff;
const SPIN_BAR = 0xffd040;
const SPIN_READY = 0xfff0a0;
const VICTORY = 0x80ff90;
const DEFEAT = 0xff6060;
const NO_ELEMENT = 0x8a8a9a;
// The pack's bar frame is pale; darkened, an empty meter stays visible against the green wall.
const BAR_UNDER = 0x303030;

const HUD_BAR_W = 60;
const HUD_BAR_X = 10;
const BAR_H = 6;
// The boss bar sits in the top wall row, right of the meters, so its name label
// can never collide with the bottom-left debug text.
const BOSS_BAR_W = 152;
const BOSS_BAR_X = 80;
const BOSS_BAR_Y = 9;
const BOTTOM_HUD_Y = 150;

const GLYPH = 8;
const BIG = 16;
const LINE_H = GLYPH + 1;

// The panel's decorative border is 6 px deep on every side.
const PANEL_SLICE = 6;
const PANEL_W = 200;
const PANEL_Y = 30;
const PANEL_TITLE_Y = 48;
const PANEL_BODY_Y = 68;
const PANEL_PAD = 8;

/**
 * Meters, boss bar, wave and element labels, banners and the intro/result
 * panels. Pinned to the screen, so nothing here sorts against the world. Text
 * is the pack's 8x8 bitmap font, which stays crisp at 8 px and at 16 px.
 */
export class HudView implements RenderView {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly frames: Phaser.GameObjects.NineSlice[];
  private readonly bossFrame: Phaser.GameObjects.NineSlice;
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly labels: HudLabel[];
  private readonly bossLabel: HudLabel;
  private readonly waveLabel: HudLabel;
  private readonly elementLabel: HudLabel;
  private readonly bannerLabel: HudLabel;
  private readonly panelTitle: HudLabel;
  private readonly panelBody: HudLabel;
  private readonly pausedLabel: HudLabel;
  private readonly guardLabel: HudLabel;
  private readonly spinLabel: HudLabel;
  private panelHeight = 0;

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    registerHudFont(scene);

    // Frames are created before the Graphics that fills them, so at the same
    // depth the fills draw on top.
    const barFrame = (x: number, y: number, w: number) =>
      scene.add
        .nineslice(x, y, HUD_KEY.barUnder, undefined, w, BAR_H, 1, 1, 1, 1)
        .setOrigin(0, 0)
        .setTint(BAR_UNDER)
        .setDepth(DEPTH.hud);
    this.frames = [
      barFrame(HUD_BAR_X - 1, 1, HUD_BAR_W + 2),
      barFrame(HUD_BAR_X - 1, 9, HUD_BAR_W + 2),
    ];
    this.bossFrame = barFrame(BOSS_BAR_X - 1, BOSS_BAR_Y, BOSS_BAR_W + 2);
    this.bossFrame.setVisible(false);
    this.gfx = scene.add.graphics().setDepth(DEPTH.hud);
    this.overlay = scene.add.graphics().setDepth(DEPTH.overlay);
    this.panel = scene.add
      .nineslice(
        (width - PANEL_W) / 2,
        PANEL_Y,
        HUD_KEY.panel,
        undefined,
        PANEL_W,
        BAR_H,
        PANEL_SLICE,
        PANEL_SLICE,
        PANEL_SLICE,
        PANEL_SLICE,
      )
      .setOrigin(0, 0)
      .setDepth(DEPTH.panels)
      .setVisible(false);

    const text = DEPTH.hudText;
    const top = DEPTH.panels + 1;
    this.guardLabel = new HudLabel(scene, {
      x: 1,
      y: 0,
      depth: text,
      color: GUARD_BAR,
    });
    this.guardLabel.setText("G");
    this.spinLabel = new HudLabel(scene, {
      x: 1,
      y: 8,
      depth: text,
      color: SPIN_BAR,
    });
    this.spinLabel.setText("S");
    this.bossLabel = new HudLabel(scene, {
      x: BOSS_BAR_X,
      y: BOSS_BAR_Y - 1,
      depth: text,
      originY: 1,
    }).setVisible(false);
    this.waveLabel = new HudLabel(scene, {
      x: width - 1,
      y: BOTTOM_HUD_Y,
      depth: text,
      originX: 1,
      align: "right",
    });
    this.elementLabel = new HudLabel(scene, {
      x: 2,
      y: BOTTOM_HUD_Y,
      depth: text,
    });
    this.bannerLabel = new HudLabel(scene, {
      x: width / 2,
      y: 44,
      depth: DEPTH.panels,
      size: BIG,
      originX: 0.5,
      originY: 0.5,
      align: "center",
    }).setVisible(false);
    this.panelTitle = new HudLabel(scene, {
      x: width / 2,
      y: PANEL_TITLE_Y,
      depth: top,
      size: BIG,
      originX: 0.5,
      originY: 0.5,
      align: "center",
    }).setVisible(false);
    this.panelBody = new HudLabel(scene, {
      x: width / 2,
      y: PANEL_BODY_Y,
      depth: top,
      originX: 0.5,
      align: "center",
      outline: false,
      color: null,
      // Two 25-character lines must fit the panel's inner width.
      letterSpacing: -1,
    }).setVisible(false);
    this.pausedLabel = new HudLabel(scene, {
      x: width / 2,
      y: height / 2,
      depth: DEPTH.panels,
      size: BIG,
      originX: 0.5,
      originY: 0.5,
      align: "center",
    });
    this.pausedLabel.setText("PAUSED").setVisible(false);

    this.labels = [
      this.guardLabel,
      this.spinLabel,
      this.bossLabel,
      this.waveLabel,
      this.elementLabel,
      this.bannerLabel,
      this.panelTitle,
      this.panelBody,
      this.pausedLabel,
    ];
  }

  setPaused(paused: boolean): void {
    this.pausedLabel.setVisible(paused);
  }

  draw({ state, ordered, player }: RenderFrame): void {
    this.gfx.clear();
    this.drawBossBar(state, ordered);
    this.drawMeters(state, player);
    this.drawFlowHud(state, player);
  }

  destroy(): void {
    for (const object of [
      this.gfx,
      this.overlay,
      this.bossFrame,
      this.panel,
      ...this.frames,
    ]) {
      object.destroy();
    }
    for (const label of this.labels) label.destroy();
  }

  private drawBossBar(state: SimState, entities: readonly Entity[]): void {
    const boss = entities.find((e) => e.state !== "dead" && isBoss(state, e));
    this.bossFrame.setVisible(boss !== undefined);
    this.bossLabel.setVisible(boss !== undefined);
    if (!boss) return;
    this.gfx.fillStyle(BOSS_BAR, 1);
    this.gfx.fillRect(
      BOSS_BAR_X,
      BOSS_BAR_Y + 1,
      meterWidth(boss.hp, boss.maxHp, BOSS_BAR_W),
      BAR_H - 2,
    );
    this.bossLabel.setText(bossName(boss.kitId));
  }

  private drawMeters(state: SimState, player: Entity | undefined): void {
    const shown = player !== undefined;
    for (const frame of this.frames) frame.setVisible(shown);
    this.guardLabel.setVisible(shown);
    this.spinLabel.setVisible(shown);
    if (!player) return;
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
      g.fillStyle(color, 1);
      g.fillRect(
        HUD_BAR_X,
        y + 1,
        meterWidth(value, max, HUD_BAR_W),
        BAR_H - 2,
      );
    }
    if (spin) {
      // The notch marks how much meter a spin needs to start.
      g.fillStyle(FLASH, 1);
      g.fillRect(
        HUD_BAR_X + meterWidth(spin.minMeter, spinMax, HUD_BAR_W),
        9,
        1,
        BAR_H,
      );
    }
  }

  private drawFlowHud(state: SimState, player: Entity | undefined): void {
    const { arenaFlow: flow, tuning } = state;
    const { phase } = flow;
    const total = tuning.flow.waves.length;

    this.waveLabel.setText(waveLabel(phase, flow.wave, total));

    const element = player?.element
      ? tuning.elements[player.element]
      : undefined;
    this.elementLabel
      .setText(element ? element.name.toUpperCase() : "NO ELEMENT")
      .setColor(element ? element.color : NO_ELEMENT);

    const banner = bannerText(
      phase,
      flow.wave,
      flow.phaseTicks,
      tuning.flow.bannerFrames,
    );
    this.bannerLabel.setText(banner).setVisible(banner !== "");

    const o = this.overlay;
    o.clear();
    const showPanel =
      phase === "intro" || phase === "victory" || phase === "defeat";
    this.panel.setVisible(showPanel);
    this.panelTitle.setVisible(showPanel);
    this.panelBody.setVisible(showPanel);
    if (!showPanel) return;
    o.fillStyle(BAR_BACK, 0.65);
    o.fillRect(0, 0, state.arena.cols * state.arena.tileSize, 160);

    if (phase === "intro") {
      this.panelTitle.setText(INTRO_TITLE).setColor(0xffffff);
      this.panelBody.setText(INTRO_BODY);
      this.fitPanel(INTRO_BODY);
      return;
    }
    const won = phase === "victory";
    const body = resultBody({
      won,
      wavesCleared: flow.wavesCleared,
      totalWaves: total,
      runTicks: flow.runTicks,
      hitsTaken: player?.combat.hitsTaken ?? 0,
      canRestart: canRestart(state),
    });
    this.panelTitle.setText(resultTitle(won)).setColor(won ? VICTORY : DEFEAT);
    this.panelBody.setText(body);
    this.fitPanel(body);
  }

  // Sized to the body so the intro's two lines don't float in a result-sized box.
  private fitPanel(body: string): void {
    const height =
      PANEL_BODY_Y - PANEL_Y + lineCount(body) * LINE_H + PANEL_PAD;
    if (height === this.panelHeight) return;
    this.panelHeight = height;
    this.panel.setSize(PANEL_W, height);
  }
}
