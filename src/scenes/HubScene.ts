import Phaser from "phaser";
import { blip, confirmSfx, ensureAudio } from "../audio/sfx";
import { composeMap } from "../data/hubCompose";
import {
  DEFAULT_HUB,
  type HubDef,
  type HubDoor,
  type HubNpcDef,
  hubFor,
  type NpcSkin,
} from "../data/hubs";
import { createTuning, type Tuning } from "../data/tuning";
import { PhaserInput } from "../input";
import { actorFrame, actorSkin } from "../render/actorFrames";
import { preloadAssets } from "../render/assets";
import { DialogueView } from "../render/DialogueView";
import { actorDepth, DEPTH } from "../render/depth";
import { HubMapView } from "../render/HubMapView";
import { HudLabel, registerHudFont } from "../render/hudLabel";
import { buildNinjaTextures } from "../render/ninjaTextures";
import { browserStore, loadStory } from "../render/storyStorage";
import { TransitionView } from "../render/TransitionView";
import { type Arena, isSolidTile } from "../sim";
import { createEntity } from "../sim/entity";
import type { Entity } from "../sim/types";

const TILE = 16;
const SPEED = 62;
const TALK_DIST = 24;

const SKINS: Record<NpcSkin, { kitId: string; mobType: string }> = {
  wu: { kitId: "drillDummy", mobType: "drillDummy" },
  kai: { kitId: "allyNinja", mobType: "allyKai" },
  jay: { kitId: "allyNinja", mobType: "allyJay" },
  zane: { kitId: "allyNinja", mobType: "allyZane" },
  cole: { kitId: "allyNinja", mobType: "allyCole" },
};

const DEFAULT_RUMOURS = [
  "THE FIFTH STUDENT CAN'T CONTROL THEIR TRAIL",
  "WU IS HIDING SOMETHING",
] as const;

interface NpcActor {
  def: HubNpcDef;
  entity: Entity;
  img: Phaser.GameObjects.Image;
}

type Mode = "roam" | "talk";

function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * A walkable hub: the player roams a scrolling map, talks to NPCs,
 * reads the gossip board, and leaves through the gate. Enter with `?hub=<key>`.
 */
export class HubScene extends Phaser.Scene {
  private hub: HubDef = hubFor(DEFAULT_HUB);
  private tuning: Tuning = createTuning();
  private arena: Arena = { cols: 0, rows: 0, tileSize: TILE, solid: [] };
  private player: Entity | null = null;
  private playerImg: Phaser.GameObjects.Image | null = null;
  private npcs: NpcActor[] = [];
  private mapView: HubMapView | null = null;
  private dialogue: DialogueView | null = null;
  private transition: TransitionView | null = null;
  private titleLabel: HudLabel | null = null;
  private hintLabel: HudLabel | null = null;
  private emoteLabel: HudLabel | null = null;
  private controls: PhaserInput | null = null;
  private mode: Mode = "roam";
  private lineIdx = new Map<string, number>();
  private boardText = "";
  private tick = 0;
  private blipTick = 0;
  private lastSpeaker: string | null = null;
  private attackWasHeld = false;
  private leaving = false;
  private spawnAt: { col: number; row: number } = { col: 0, row: 0 };

  constructor() {
    super("HubScene");
  }

  init(data: unknown): void {
    let key: string | null = null;
    if (typeof data === "object" && data !== null && "hub" in data) {
      const h = (data as { hub?: unknown }).hub;
      if (typeof h === "string") key = h;
    }
    key ??= new URLSearchParams(window.location.search).get("hub");
    this.hub = hubFor(key ?? DEFAULT_HUB);
    this.spawnAt = this.hub.spawn;
    if (typeof data === "object" && data !== null && "spawn" in data) {
      const sp = (data as { spawn?: unknown }).spawn;
      if (typeof sp === "object" && sp !== null) {
        const { col, row } = sp as { col?: unknown; row?: unknown };
        if (typeof col === "number" && typeof row === "number") {
          this.spawnAt = { col, row };
        }
      }
    }
  }

  preload(): void {
    preloadAssets(this);
  }

  create(): void {
    buildNinjaTextures(this);
    registerHudFont(this);
    this.tuning = createTuning();
    this.buildArena();
    this.mapView = new HubMapView(this, this.composed());
    this.spawnActors();
    this.buildMarkers();
    this.controls = new PhaserInput(this);
    this.dialogue = new DialogueView(this);
    this.dialogue.setScrollFactor(0);
    this.transition = new TransitionView(this);
    this.titleLabel = new HudLabel(this, { x: 4, y: 4, depth: DEPTH.hudText });
    this.titleLabel.setText(this.hub.title.toUpperCase());
    this.titleLabel.setScrollFactor(0);
    this.hintLabel = new HudLabel(this, {
      x: 236,
      y: 4,
      depth: DEPTH.hudText,
      originX: 1,
      align: "right",
    });
    this.hintLabel.setScrollFactor(0);
    this.emoteLabel = new HudLabel(this, {
      x: 0,
      y: 0,
      depth: DEPTH.overheadFx + 10,
      originX: 0.5,
      originY: 1,
      align: "center",
    });
    this.emoteLabel.setVisible(false);
    this.boardText = this.readBoard();
    this.mode = "roam";
    this.leaving = false;
    this.tick = 0;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.arena.cols * TILE, this.arena.rows * TILE);
    if (this.playerImg) cam.startFollow(this.playerImg);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.mapView?.destroy();
      this.dialogue?.destroy();
      this.transition?.destroy();
      this.titleLabel?.destroy();
      this.hintLabel?.destroy();
      this.emoteLabel?.destroy();
      this.mapView = null;
      this.dialogue = null;
      this.transition = null;
      this.titleLabel = null;
      this.hintLabel = null;
      this.emoteLabel = null;
      this.player = null;
      this.playerImg = null;
      this.npcs = [];
    });
    void this.transition?.fadeIn(320);
  }

  update(_time: number, delta: number): void {
    if (!this.controls || !this.player || !this.playerImg) return;
    const { actions } = this.controls.poll();
    const confirm = actions.attack && !this.attackWasHeld;
    this.attackWasHeld = actions.attack;
    this.tick += 1;
    this.dialogue?.update();
    if (this.mode === "talk") {
      if (this.dialogue?.isVisible) {
        this.blipTick += 1;
        if (this.blipTick % 4 === 0) blip(this.lastSpeaker);
      }
      if (confirm) {
        ensureAudio();
        confirmSfx();
        if (this.dialogue?.confirm()) {
          this.dialogue.hide();
          this.mode = "roam";
          this.hintLabel?.setVisible(true);
        }
      }
      return;
    }
    this.movePlayer(actions.moveX, actions.moveY, delta);
    this.paintPlayer();
    const npc = this.nearestNpc();
    const board = this.nearBoard();
    const exit = this.inExit();
    const door = this.inDoor();
    if (npc) {
      this.placeEmote(npc.entity);
      this.hintLabel?.setText("A: TALK");
    } else if (board) {
      this.emoteLabel?.setVisible(false);
      this.hintLabel?.setText("A: READ");
    } else if (door) {
      this.emoteLabel?.setVisible(false);
      this.hintLabel?.setText(`A: ${door.label}`);
    } else if (exit) {
      this.emoteLabel?.setVisible(false);
      this.hintLabel?.setText(`A: ${this.hub.exitLabel ?? "LEAVE"}`);
    } else {
      this.emoteLabel?.setVisible(false);
      this.hintLabel?.setText("ARROWS: MOVE");
    }
    if (!confirm) return;
    ensureAudio();
    if (npc) {
      confirmSfx();
      this.openNpc(npc);
    } else if (board) {
      confirmSfx();
      this.openBoard();
    } else if (door) {
      confirmSfx();
      this.useDoor(door);
    } else if (exit) {
      confirmSfx();
      this.scene.start("StoryScene");
    }
  }

  private composed(): ReturnType<typeof composeMap> {
    return composeMap(this.hub.layout.rows, this.hub.layout.stamps);
  }

  private buildArena(): void {
    const map = this.composed();
    this.arena = {
      cols: map.cols,
      rows: map.rows,
      tileSize: TILE,
      solid: map.solid,
    };
  }

  private useDoor(door: HubDoor): void {
    // Confirm can repeat during the fade; start only one restart.
    if (this.leaving) return;
    this.leaving = true;
    const go = (): void => {
      this.scene.start("HubScene", { hub: door.to, spawn: door.spawn });
    };
    // A failed fade must not strand the player in the door.
    (this.transition?.fadeOut(240) ?? Promise.resolve()).then(go, (err) => {
      console.error("hub door fade failed", err);
      go();
    });
  }

  private spawnActors(): void {
    let nextId = 1;
    const spawn = tileCenter(this.spawnAt.col, this.spawnAt.row);
    this.player = createEntity(
      nextId++,
      "player",
      "ninja",
      "ninja",
      spawn,
      { x: 0, y: 1 },
      this.tuning,
      null,
    );
    this.playerImg = this.paintNew(this.player);
    this.npcs = [];
    for (const def of this.hub.npcs) {
      const skin = SKINS[def.skin];
      const entity = createEntity(
        nextId++,
        "mob",
        "ninja",
        skin.kitId,
        tileCenter(def.col, def.row),
        { ...def.facing },
        this.tuning,
        skin.mobType,
      );
      entity.state = "idle";
      this.npcs.push({ def, entity, img: this.paintNew(entity) });
    }
  }

  private paintNew(entity: Entity): Phaser.GameObjects.Image {
    const skin = actorSkin(entity);
    const look = actorFrame(entity, this.tuning, 0);
    const img = this.add
      .image(
        Math.round(entity.pos.x),
        Math.round(entity.pos.y + entity.feet.h / 2),
        look.textureKey,
        look.frame,
      )
      .setOrigin(0.5, skin.originY)
      .setDepth(actorDepth(entity.pos.y, entity.id));
    img.setFlipX(look.flipX);
    return img;
  }

  private paintPlayer(): void {
    if (!this.player || !this.playerImg) return;
    const look = actorFrame(this.player, this.tuning, this.tick);
    this.playerImg
      .setTexture(look.textureKey, look.frame)
      .setFlipX(look.flipX)
      .setPosition(
        Math.round(this.player.pos.x),
        Math.round(this.player.pos.y + this.player.feet.h / 2),
      )
      .setDepth(actorDepth(this.player.pos.y, this.player.id));
  }

  private buildMarkers(): void {
    // The board is drawn by its map stamp, so only the exit needs a marker.
    if (!this.hub.exit) return;
    const { col, row, w, h } = this.hub.exit;
    this.add
      .rectangle(
        col * TILE + (w * TILE) / 2,
        row * TILE + (h * TILE) / 2,
        w * TILE,
        h * TILE,
        0x3a8a3a,
        0.35,
      )
      .setDepth(DEPTH.groundFx);
  }

  private movePlayer(moveX: number, moveY: number, delta: number): void {
    if (!this.player) return;
    const step = (SPEED * Math.min(delta, 50)) / 1000;
    const w = this.player.feet.w - 2;
    const h = this.player.feet.h - 1;
    const dx = moveX * step;
    const dy = moveY * step;
    if (
      dx !== 0 &&
      !this.boxHits(this.player.pos.x + dx, this.player.pos.y, w, h)
    ) {
      this.player.pos.x += dx;
    }
    if (
      dy !== 0 &&
      !this.boxHits(this.player.pos.x, this.player.pos.y + dy, w, h)
    ) {
      this.player.pos.y += dy;
    }
    const moving = dx !== 0 || dy !== 0;
    this.player.state = moving ? "move" : "idle";
    if (Math.abs(moveX) > Math.abs(moveY) && moveX !== 0) {
      this.player.facing = { x: Math.sign(moveX), y: 0 };
    } else if (moveY !== 0) {
      this.player.facing = { x: 0, y: Math.sign(moveY) };
    }
  }

  private boxHits(cx: number, cy: number, w: number, h: number): boolean {
    const corners = [
      { x: cx - w / 2, y: cy - h / 2 },
      { x: cx + w / 2, y: cy - h / 2 },
      { x: cx - w / 2, y: cy + h / 2 },
      { x: cx + w / 2, y: cy + h / 2 },
    ];
    return corners.some(({ x, y }) => {
      const col = Math.floor(x / TILE);
      const row = Math.floor(y / TILE);
      return isSolidTile(this.arena, col, row);
    });
  }

  private nearestNpc(): NpcActor | null {
    if (!this.player) return null;
    let best: NpcActor | null = null;
    let bestDist = TALK_DIST;
    for (const npc of this.npcs) {
      const d = dist(this.player.pos, npc.entity.pos);
      if (d < bestDist) {
        best = npc;
        bestDist = d;
      }
    }
    return best;
  }

  private nearBoard(): boolean {
    if (!this.player || !this.hub.board) return false;
    return (
      dist(
        this.player.pos,
        tileCenter(this.hub.board.col, this.hub.board.row),
      ) < TALK_DIST
    );
  }

  private inZone(zone: {
    col: number;
    row: number;
    w: number;
    h: number;
  }): boolean {
    if (!this.player) return false;
    const { col, row, w, h } = zone;
    const { x, y } = this.player.pos;
    return (
      x >= col * TILE &&
      x < (col + w) * TILE &&
      y >= row * TILE &&
      y < (row + h) * TILE
    );
  }

  private inExit(): boolean {
    return this.hub.exit ? this.inZone(this.hub.exit) : false;
  }

  private inDoor(): HubDoor | null {
    return this.hub.doors.find((d) => this.inZone(d)) ?? null;
  }

  private placeEmote(entity: Entity): void {
    this.emoteLabel?.setText("!");
    this.emoteLabel?.setPosition(entity.pos.x, entity.pos.y - 22);
    this.emoteLabel?.setVisible(true);
  }

  private openNpc(npc: NpcActor): void {
    const lines = npc.def.lines;
    if (lines.length === 0) return;
    const idx = this.lineIdx.get(npc.def.id) ?? 0;
    const line = lines[idx % lines.length];
    if (line === undefined) return;
    this.lineIdx.set(npc.def.id, idx + 1);
    if (this.player) {
      const dx = this.player.pos.x - npc.entity.pos.x;
      const dy = this.player.pos.y - npc.entity.pos.y;
      npc.entity.facing =
        Math.abs(dx) > Math.abs(dy)
          ? { x: Math.sign(dx), y: 0 }
          : { x: 0, y: Math.sign(dy) };
      const look = actorFrame(npc.entity, this.tuning, this.tick);
      npc.img.setTexture(look.textureKey, look.frame).setFlipX(look.flipX);
    }
    this.lastSpeaker = npc.def.name;
    this.mode = "talk";
    this.blipTick = 0;
    this.emoteLabel?.setVisible(false);
    this.hintLabel?.setText("A: NEXT");
    this.dialogue?.show(npc.def.name, line);
  }

  private openBoard(): void {
    this.lastSpeaker = null;
    this.mode = "talk";
    this.blipTick = 0;
    this.hintLabel?.setText("A: NEXT");
    this.dialogue?.show(null, this.boardText);
  }

  private readBoard(): string {
    const store = browserStore();
    const saved = store ? loadStory(store) : null;
    const rumours =
      saved?.ok && saved.state.rumours.length > 0
        ? saved.state.rumours.map((r) => r.toUpperCase())
        : [...DEFAULT_RUMOURS];
    return rumours.join("\n");
  }
}
