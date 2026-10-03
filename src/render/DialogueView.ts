import type Phaser from "phaser";
import { HUD_KEY } from "./assets";
import { DEPTH } from "./depth";
import { paginate, revealedChars, speakerName } from "./dialogueText";
import { HudLabel, registerHudFont } from "./hudLabel";

const BOX_X = 6;
const BOX_Y = 104;
const BOX_W = 228;
const BOX_H = 50;
// The panel's decorative border is 6 px deep on every side.
const SLICE = 6;
const PAD = 4;
const NAME_Y = BOX_Y + SLICE - 1;
const TEXT_Y = NAME_Y + 10;
const LINES_PER_PAGE = 3;
// 8 px glyphs inside the border and padding.
const MAX_CHARS = Math.floor((BOX_W - 2 * (SLICE + PAD)) / 8);
const FRAMES_PER_CHAR = 2;
const SPEAKER_COLOR = 0x9a2a2a;

/**
 * The GBA-style dialogue box: a speaker tag, three lines of typewriter text and
 * a blinking arrow. It holds no story logic; the scene feeds it lines and asks
 * when the player is done.
 */
export class DialogueView {
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly name: HudLabel;
  private readonly body: HudLabel;
  private readonly arrow: HudLabel;
  private pages: string[] = [];
  private page = 0;
  private frames = 0;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    registerHudFont(scene);
    this.panel = scene.add
      .nineslice(
        BOX_X,
        BOX_Y,
        HUD_KEY.panel,
        undefined,
        BOX_W,
        BOX_H,
        SLICE,
        SLICE,
        SLICE,
        SLICE,
      )
      .setOrigin(0, 0)
      .setDepth(DEPTH.panels)
      .setVisible(false);
    const left = BOX_X + SLICE + PAD;
    const top = DEPTH.panels + 1;
    this.name = new HudLabel(scene, {
      x: left,
      y: NAME_Y,
      depth: top,
      outline: false,
      color: SPEAKER_COLOR,
    }).setVisible(false);
    this.body = new HudLabel(scene, {
      x: left,
      y: TEXT_Y,
      depth: top,
      outline: false,
      color: null,
    }).setVisible(false);
    this.arrow = new HudLabel(scene, {
      x: BOX_X + BOX_W - SLICE - 8,
      y: BOX_Y + BOX_H - SLICE - 8,
      depth: top,
      outline: false,
      color: SPEAKER_COLOR,
    }).setVisible(false);
    this.arrow.setText(">");
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(speaker: string | null, text: string): void {
    this.pages = paginate(text, MAX_CHARS, LINES_PER_PAGE);
    this.page = 0;
    this.frames = 0;
    this.visible = true;
    this.panel.setVisible(true);
    this.name.setText(speakerName(speaker)).setVisible(true);
    this.body.setVisible(true);
    this.render();
  }

  hide(): void {
    this.visible = false;
    this.panel.setVisible(false);
    this.name.setVisible(false);
    this.body.setVisible(false);
    this.arrow.setVisible(false);
  }

  /** Call once per render frame while visible. */
  update(): void {
    if (!this.visible) return;
    this.frames += 1;
    this.render();
  }

  /**
   * The confirm button: finishes the typewriter first, then turns the page.
   * Returns true when the last page has been dismissed.
   */
  confirm(): boolean {
    const total = this.currentPage().length;
    if (revealedChars(this.frames, FRAMES_PER_CHAR, total) < total) {
      this.frames = total * FRAMES_PER_CHAR;
      this.render();
      return false;
    }
    if (this.page < this.pages.length - 1) {
      this.page += 1;
      this.frames = 0;
      this.render();
      return false;
    }
    return true;
  }

  destroy(): void {
    this.panel.destroy();
    this.name.destroy();
    this.body.destroy();
    this.arrow.destroy();
  }

  private currentPage(): string {
    return this.pages[this.page] ?? "";
  }

  private render(): void {
    const full = this.currentPage();
    const shown = revealedChars(this.frames, FRAMES_PER_CHAR, full.length);
    this.body.setText(full.slice(0, shown));
    const done = shown >= full.length;
    // Blinks on the page-turn cue only once the whole page is on screen.
    this.arrow.setVisible(done && Math.floor(this.frames / 20) % 2 === 0);
  }
}
