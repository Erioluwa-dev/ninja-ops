import Phaser from "phaser";
import type { Entity, SimState } from "../sim";
import { ARMOR, actorCue } from "./actorCues";
import { actorFrame, actorSkin } from "./actorFrames";
import { ACTOR_KEY } from "./assets";
import { actorDepth, DEPTH } from "./depth";
import { BAR_BACK, TELEGRAPH } from "./palette";
import { blinkOn, isBoss } from "./util";
import type { RenderFrame, RenderView } from "./view";

const DIZZY = 0xffe060;
const DUMMY_HOSTILE = 0xff8080;
const SHADOW = 0x000000;
const SHIELD = 0x9fe8ff;
const HP_BAR = 0x50e070;
// An Echo ghost is a faint, cool-tinted afterimage of the player.
const GHOST_TINT = 0x7fe0ff;
const GHOST_ALPHA = 0.45;
// Kai's trust perk lights Twin Strike's ghost with fire.
const GHOST_FLICKER = 0xff8a30;
const HP_BAR_W = 16;
const OUTLINE_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
const RING_OFFSETS = [
  [-2, 0],
  [2, 0],
  [0, -2],
  [0, 2],
] as const;
const BRUTE_FACING = 0x101020;
// Horizontal reach of the brute's legs from its centre; a wedge any nearer
// would hide behind the body, which is much wider than its feet.
const BRUTE_LEG_REACH = 12;
const SILHOUETTE_ALPHA = 0.35;
const FACING_WEDGE_HALF_BASE = 2;
const FACING_WEDGE_LENGTH = 2;
// Layers of one actor share a depth band; these sit just under and over the
// body without reaching the next entity id's slot (ids are 1e-6 apart).
const LAYER_EPSILON = 5e-7;

/** The images that make up one entity on screen. */
interface ActorSprite {
  /** Kept so a restart that reuses an id gets fresh images, not stale ones. */
  owner: Entity;
  body: Phaser.GameObjects.Image;
  /** The body again as a flat colour wash: telegraph, stun and hitstop cues. */
  wash: Phaser.GameObjects.Image;
  outline: Phaser.GameObjects.Image[];
  /** A wider outline in the telegraph colour, behind the armor outline. */
  ring: Phaser.GameObjects.Image[];
}

function setFlat(
  image: Phaser.GameObjects.Image,
  color: number,
): Phaser.GameObjects.Image {
  return image.setTint(color).setTintMode(Phaser.TintModes.FILL);
}

/**
 * One sprite per entity id, plus its ground shadow, armor outline, block
 * shield, dizzy stars and HP bar. Frames come from `actorFrame`, so they follow
 * sim state rather than a Phaser animation clock.
 */
export class ActorView implements RenderView {
  private readonly scene: Phaser.Scene;
  private readonly sprites = new Map<number, ActorSprite>();
  private readonly shadows: Phaser.GameObjects.Graphics;
  private readonly overhead: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  /** Pooled: the player's pose drawn over whatever body is hiding them. */
  private readonly silhouette: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Shadows lie on the floor, under hazards and telegraphs, so a body never
    // hides the ground cue it is standing in.
    this.shadows = scene.add.graphics().setDepth(DEPTH.groundFx - 1);
    this.overhead = scene.add.graphics().setDepth(DEPTH.overheadFx);
    this.bars = scene.add.graphics().setDepth(DEPTH.hpBars);
    this.silhouette = setFlat(
      scene.add.image(0, 0, ACTOR_KEY.player, 0),
      0xffffff,
    )
      .setAlpha(SILHOUETTE_ALPHA)
      .setDepth(DEPTH.overheadFx - 1)
      .setVisible(false);
  }

  draw({ state, ordered }: RenderFrame): void {
    this.shadows.clear();
    this.overhead.clear();
    this.bars.clear();
    this.dropGone(ordered);
    for (const e of ordered) {
      this.drawEntity(state, e);
      this.drawShield(e);
      this.drawDizzy(state, e);
    }
    for (const e of ordered) {
      if (e.state !== "dead" && e.kind !== "ghost" && !isBoss(state, e)) {
        this.drawHpBar(e);
      }
    }
    this.drawSilhouette(ordered);
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) this.destroySprite(sprite);
    this.sprites.clear();
    this.shadows.destroy();
    this.overhead.destroy();
    this.bars.destroy();
    this.silhouette.destroy();
  }

  private spriteFor(e: Entity): ActorSprite {
    const existing = this.sprites.get(e.id);
    if (existing?.owner === e) return existing;
    if (existing) this.destroySprite(existing);
    const { key, originY } = actorSkin(e);
    const make = (): Phaser.GameObjects.Image =>
      this.scene.add.image(0, 0, key, 0).setOrigin(0.5, originY);
    const created: ActorSprite = {
      owner: e,
      body: make(),
      wash: setFlat(make(), 0xffffff).setVisible(false),
      outline: OUTLINE_OFFSETS.map(() =>
        setFlat(make(), ARMOR).setVisible(false),
      ),
      ring: RING_OFFSETS.map(() =>
        setFlat(make(), TELEGRAPH).setVisible(false),
      ),
    };
    this.sprites.set(e.id, created);
    return created;
  }

  private destroySprite(sprite: ActorSprite): void {
    sprite.body.destroy();
    sprite.wash.destroy();
    for (const image of sprite.outline) image.destroy();
    for (const image of sprite.ring) image.destroy();
  }

  /** Entities that left the sim (a removed corpse, a restart) lose their images. */
  private dropGone(ordered: readonly Entity[]): void {
    const live = new Set<number>();
    for (const e of ordered) live.add(e.id);
    for (const [id, sprite] of this.sprites) {
      if (live.has(id)) continue;
      this.destroySprite(sprite);
      this.sprites.delete(id);
    }
  }

  private drawEntity(state: SimState, e: Entity): void {
    const sprite = this.spriteFor(e);
    const skin = actorSkin(e);
    const look = actorFrame(e, state.tuning, state.tick);
    const cue = actorCue(state, e);
    const footBottom = e.pos.y + e.feet.h / 2;

    // The shadow stays on the ground and shrinks as the body rises, which is
    // what tells the eye how high a jump is.
    const lift = Math.min(0.5, e.z / 60);
    this.shadows.fillStyle(SHADOW, 0.4 * (1 - lift) * cue.alpha);
    this.shadows.fillEllipse(
      e.pos.x,
      e.pos.y,
      (e.feet.w + 4) * (1 - lift),
      (e.feet.h + 2) * (1 - lift),
    );
    if (skin.layout === "brute") this.drawFacingWedge(e, cue.alpha);

    const alpha = e.kind === "ghost" ? cue.alpha * GHOST_ALPHA : cue.alpha;
    const x = Math.round(e.pos.x + e.facing.x * cue.lunge);
    const y = Math.round(footBottom - e.z + e.facing.y * cue.lunge);
    const scaleY = (skin.height - cue.squash) / skin.height;
    const depth = actorDepth(e.pos.y, e.id);

    const place = (
      image: Phaser.GameObjects.Image,
      dx: number,
      dy: number,
      layerDepth: number,
    ): void => {
      if (
        image.texture.key !== look.textureKey ||
        String(image.frame.name) !== String(look.frame)
      ) {
        image.setTexture(look.textureKey, look.frame);
      }
      image
        .setPosition(x + dx, y + dy)
        .setFlipX(look.flipX)
        .setScale(1, scaleY)
        .setAlpha(alpha)
        .setDepth(layerDepth);
    };

    place(sprite.body, 0, 0, depth);
    // The dummy's colour used to follow its faction: red once it is scripted to
    // attack. A multiply tint keeps the statue's gold readable under it.
    if (e.kind === "dummy" && e.faction === "oni") {
      sprite.body.setTint(DUMMY_HOSTILE);
    } else if (e.kind === "ghost") {
      const burning = e.ghost?.flicker === true && blinkOn(state.tick, 4);
      sprite.body.setTint(burning ? GHOST_FLICKER : GHOST_TINT);
    } else if (skin.tint !== null) {
      sprite.body.setTint(skin.tint);
    } else {
      sprite.body.clearTint();
    }

    sprite.wash.setVisible(cue.fill !== null);
    if (cue.fill !== null) {
      place(sprite.wash, 0, 0, depth + LAYER_EPSILON);
      sprite.wash.setTint(cue.fill).setAlpha(alpha * cue.fillAlpha);
    }

    sprite.outline.forEach((image, i) => {
      image.setVisible(cue.armored);
      const offset = OUTLINE_OFFSETS[i];
      if (!cue.armored || !offset) return;
      place(image, offset[0], offset[1], depth - LAYER_EPSILON);
    });

    sprite.ring.forEach((image, i) => {
      image.setVisible(cue.ring !== null);
      const offset = RING_OFFSETS[i];
      if (cue.ring === null || !offset) return;
      place(image, offset[0], offset[1], depth - 2 * LAYER_EPSILON);
      image.setTint(cue.ring);
    });
  }

  // The brute's sheet is front-facing and nearly symmetric, so its heading is
  // drawn as a dark wedge sticking out past its feet. Facing up points behind
  // the body, where the sprite covers it.
  private drawFacingWedge(e: Entity, alpha: number): void {
    const horizontal = Math.abs(e.facing.x) > Math.abs(e.facing.y);
    const dx = horizontal ? Math.sign(e.facing.x) : 0;
    const dy = horizontal ? 0 : Math.sign(e.facing.y);
    const reach = horizontal ? BRUTE_LEG_REACH : e.feet.h / 2 + 1;
    const baseX = e.pos.x + dx * reach;
    const baseY = e.pos.y + dy * reach;
    const half = FACING_WEDGE_HALF_BASE;
    const g = this.shadows;
    g.fillStyle(BRUTE_FACING, 0.8 * alpha);
    g.fillTriangle(
      Math.round(baseX + dy * half),
      Math.round(baseY + dx * half),
      Math.round(baseX - dy * half),
      Math.round(baseY - dx * half),
      Math.round(baseX + dx * FACING_WEDGE_LENGTH),
      Math.round(baseY + dy * FACING_WEDGE_LENGTH),
    );
  }

  // The player vanishes behind a body drawn in front of them, so the pose is
  // repeated on top as a pale silhouette while any such body overlaps.
  private drawSilhouette(ordered: readonly Entity[]): void {
    const playerIndex = ordered.findIndex((e) => e.kind === "player");
    const player = ordered[playerIndex];
    const sprite = player ? this.sprites.get(player.id) : undefined;
    if (!player || !sprite || player.state === "dead") {
      this.silhouette.setVisible(false);
      return;
    }
    const mine = this.footprint(player);
    let hidden = false;
    for (let i = playerIndex + 1; i < ordered.length && !hidden; i++) {
      const other = ordered[i];
      if (!other || other.state === "dead") continue;
      const box = this.footprint(other);
      hidden =
        mine.left < box.right &&
        box.left < mine.right &&
        mine.top < box.bottom &&
        box.top < mine.bottom;
    }
    this.silhouette.setVisible(hidden);
    if (!hidden) return;
    const { body } = sprite;
    if (
      this.silhouette.texture.key !== body.texture.key ||
      String(this.silhouette.frame.name) !== String(body.frame.name)
    ) {
      this.silhouette.setTexture(body.texture.key, body.frame.name);
    }
    this.silhouette
      .setOrigin(body.originX, body.originY)
      .setPosition(body.x, body.y)
      .setFlipX(body.flipX)
      .setScale(body.scaleX, body.scaleY)
      .setAlpha(SILHOUETTE_ALPHA * body.alpha);
  }

  /** The opaque screen rectangle an entity's sprite covers. */
  private footprint(e: Entity): {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } {
    const skin = actorSkin(e);
    const bottom = e.pos.y + e.feet.h / 2 - e.z;
    return {
      left: e.pos.x - skin.halfWidth,
      right: e.pos.x + skin.halfWidth,
      top: bottom - skin.height,
      bottom,
    };
  }

  private drawShield(e: Entity): void {
    if (e.state !== "block") return;
    const skin = actorSkin(e);
    const footBottom = e.pos.y + e.feet.h / 2 - e.z;
    const top = footBottom - skin.height;
    const g = this.overhead;
    g.fillStyle(SHIELD, 0.8);
    if (e.facing.x !== 0) {
      const edge = e.pos.x + e.facing.x * skin.halfWidth;
      const x = e.facing.x > 0 ? edge : edge - 2;
      g.fillRect(
        Math.round(x),
        Math.round(footBottom - skin.height / 2 - 6),
        2,
        12,
      );
    } else {
      const y = e.facing.y > 0 ? footBottom - 2 : top;
      g.fillRect(
        Math.round(e.pos.x - skin.halfWidth - 1),
        Math.round(y),
        skin.halfWidth * 2 + 2,
        2,
      );
    }
  }

  private drawDizzy(state: SimState, e: Entity): void {
    if (e.state !== "dizzy") return;
    const top = this.spriteTop(e);
    this.overhead.fillStyle(DIZZY, 1);
    for (let i = 0; i < 3; i++) {
      const a = state.tick * 0.2 + (i * Math.PI * 2) / 3;
      this.overhead.fillRect(
        Math.round(e.pos.x + Math.cos(a) * 6) - 1,
        Math.round(top - 2 + Math.sin(a) * 2) - 1,
        2,
        2,
      );
    }
  }

  private drawHpBar(e: Entity): void {
    const g = this.bars;
    const x = Math.round(e.pos.x - HP_BAR_W / 2);
    // Kept on the canvas for a body standing against the top wall.
    const y = Math.max(1, Math.round(this.spriteTop(e) - 4));
    g.fillStyle(BAR_BACK, 0.7);
    g.fillRect(x - 1, y - 1, HP_BAR_W + 2, 4);
    g.fillStyle(HP_BAR, 1);
    g.fillRect(x, y, Math.round((HP_BAR_W * e.hp) / e.maxHp), 2);
  }

  private spriteTop(e: Entity): number {
    return e.pos.y + e.feet.h / 2 - e.z - actorSkin(e).height;
  }
}
