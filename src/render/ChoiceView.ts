import type Phaser from "phaser";
import { HUD_KEY } from "./assets";
import { DEPTH } from "./depth";
import { wrapText } from "./dialogueText";
import { HudLabel, registerHudFont } from "./hudLabel";

const PANEL_X = 6;
const PANEL_W = 228;
const SLICE = 6;
const PAD = 4;
const LINE_H = 10;
const BOTTOM = 102;
const MAX_OPTIONS = 4;
const MAX_CHARS = Math.floor((PANEL_W - 2 * (SLICE + PAD) - 10) / 8);
const INK = null;
const DISABLED = 0x8a8a9a;
const CURSOR = 0x9a2a2a;
const LEFT = PANEL_X + SLICE + PAD;

export interface ChoiceItem {
  id: string;
  label: string;
  enabled: boolean;
}

/**
 * A vertical list of 2 to 4 options in the dialogue panel's style, with a
 * cursor that skips nothing: a disabled option is shown greyed and can be
 * moved onto, but `confirm` refuses it.
 */
export class ChoiceView {
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly prompt: HudLabel;
  private readonly cursor: HudLabel;
  private readonly rows: HudLabel[] = [];
  private items: ChoiceItem[] = [];
  private index = 0;
  private firstRowY = 0;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    registerHudFont(scene);
    this.panel = scene.add
      .nineslice(
        PANEL_X,
        0,
        HUD_KEY.panel,
        undefined,
        PANEL_W,
        SLICE * 2,
        SLICE,
        SLICE,
        SLICE,
        SLICE,
      )
      .setOrigin(0, 0)
      .setDepth(DEPTH.panels)
      .setVisible(false);
    const top = DEPTH.panels + 1;
    const label = (x: number): HudLabel =>
      new HudLabel(scene, {
        x,
        y: 0,
        depth: top,
        outline: false,
        color: INK,
      }).setVisible(false);
    this.prompt = label(LEFT);
    this.cursor = new HudLabel(scene, {
      x: LEFT,
      y: 0,
      depth: top,
      outline: false,
      color: CURSOR,
    }).setVisible(false);
    this.cursor.setText(">");
    for (let i = 0; i < MAX_OPTIONS; i++) this.rows.push(label(LEFT + 10));
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(promptText: string, items: readonly ChoiceItem[]): void {
    if (items.length < 1 || items.length > MAX_OPTIONS) {
      throw new Error(`A choice shows 1 to ${MAX_OPTIONS} options`);
    }
    this.items = [...items];
    // Start on something pickable so a first confirm is never wasted.
    this.index = Math.max(
      0,
      this.items.findIndex((i) => i.enabled),
    );
    const prompt = wrapText(promptText, MAX_CHARS + 1).join("\n");
    const promptLines = prompt === "" ? 0 : prompt.split("\n").length;
    const rows = promptLines + this.items.length;
    const height = SLICE * 2 + PAD + rows * LINE_H;
    const y = BOTTOM - height;
    this.visible = true;
    this.panel
      .setPosition(PANEL_X, y)
      .setSize(PANEL_W, height)
      .setVisible(true);
    this.prompt.setText(prompt).setVisible(promptLines > 0);
    this.prompt.setPosition(undefined, y + SLICE);
    const firstRow = y + SLICE + promptLines * LINE_H;
    this.rows.forEach((row, i) => {
      const item = this.items[i];
      row.setVisible(item !== undefined);
      if (!item) return;
      row.setText(wrapText(item.label, MAX_CHARS)[0] ?? "");
      row.setColor(item.enabled ? INK : DISABLED);
      row.setPosition(undefined, firstRow + i * LINE_H);
    });
    this.cursor.setVisible(true);
    this.firstRowY = firstRow;
    this.placeCursor();
  }

  hide(): void {
    this.visible = false;
    this.panel.setVisible(false);
    this.prompt.setVisible(false);
    this.cursor.setVisible(false);
    for (const row of this.rows) row.setVisible(false);
  }

  move(delta: -1 | 1): void {
    if (!this.visible) return;
    const n = this.items.length;
    this.index = (this.index + delta + n) % n;
    this.placeCursor();
  }

  /** The highlighted option's id, or null when it is disabled or nothing shows. */
  confirm(): string | null {
    const item = this.items[this.index];
    return this.visible && item?.enabled ? item.id : null;
  }

  destroy(): void {
    this.panel.destroy();
    this.prompt.destroy();
    this.cursor.destroy();
    for (const row of this.rows) row.destroy();
  }

  private placeCursor(): void {
    this.cursor.setPosition(LEFT, this.firstRowY + this.index * LINE_H);
  }
}
