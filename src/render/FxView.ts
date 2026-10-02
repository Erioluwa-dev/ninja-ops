import type Phaser from "phaser";
import {
  currentAttack,
  type Entity,
  type Hazard,
  projectileBox,
  type SimState,
  spinBox,
  telegraphBox,
} from "../sim";
import { FX_KEY } from "./assets";
import { actorDepth, DEPTH } from "./depth";
import {
  advanceStrobe,
  fireFrame,
  hazardFade,
  headingRotation,
  lifeFrame,
  loopFrame,
  PROJECTILE_FRAMES,
  PROJECTILE_TICKS_PER_FRAME,
  ROCK_FRAMES,
  ringAnchors,
  ringHalf,
  ringProgress,
  type StrobeClock,
  spinFrames,
} from "./fxFrames";
import { FLASH, SWEEP_TELEGRAPH, TELEGRAPH, UNBLOCKABLE } from "./palette";
import { blinkOn } from "./util";
import type { RenderFrame, RenderView } from "./view";

const SPIN_RING = 0xbff4ff;
const SPIN_AREA_ALPHA = 0.35;

const FLAME_SIZE = 8;
const FLAME_SPACING = 8;
// The rock cluster's lowest opaque row is y 43 of its 48 px frame.
const ROCK_FEET_ORIGIN_Y = 44 / 48;
// The slash sheet's frames are 55 px tall; scaling by height keeps the arcs round.
const SLASH_FRAME_H = 55;
// The art is ~14 px across but the hitbox is 6x6; this brings the bright core
// down to roughly the box so a graze reads as a graze.
const PROJECTILE_SCALE = 0.75;
const OUTLINE_ALPHA = 0.8;

interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}
const CENTER = 0.5;
// The sprites are drawn pointing this way (radians, 0 = right, clockwise positive).
const FIREBALL_HEADING = -Math.PI / 4;
const ENERGY_BALL_HEADING = -Math.PI / 2;

/**
 * Effects drawn from sim state. Hazard footprints and telegraph fills are
 * Graphics on the ground, under every body, telegraphs above hazards so fire
 * (the same orange) can never hide a windup. Telegraph outlines are drawn
 * above the bodies so the attacker's own sprite cannot hide a north-facing box.
 * Flames, rocks, the spin and projectiles are sprites keyed by sim id, so a
 * restart that reuses ids just reuses sprites and anything the sim no longer
 * reports is destroyed.
 */
export class FxView implements RenderView {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly telegraphs: Phaser.GameObjects.Graphics;
  private readonly outlines: Phaser.GameObjects.Graphics;
  private readonly overhead: Phaser.GameObjects.Graphics;
  private readonly strobes = new Map<number, StrobeClock>();
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private readonly seen = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(DEPTH.groundFx);
    this.telegraphs = scene.add.graphics().setDepth(DEPTH.groundFx + 1);
    this.outlines = scene.add.graphics().setDepth(DEPTH.overheadFx - 1);
    this.overhead = scene.add.graphics().setDepth(DEPTH.overheadFx);
  }

  draw({ state, ordered }: RenderFrame): void {
    this.ground.clear();
    this.telegraphs.clear();
    this.outlines.clear();
    this.overhead.clear();
    this.seen.clear();
    const strobing = new Set<number>();
    for (const h of state.hazards) this.drawHazard(h);
    for (const e of ordered) this.drawTelegraph(state, e, strobing);
    for (const id of this.strobes.keys()) {
      if (!strobing.has(id)) this.strobes.delete(id);
    }
    for (const e of ordered) this.drawSpin(state, e);
    this.drawProjectiles(state);
    this.releaseUnseen();
  }

  destroy(): void {
    this.ground.destroy();
    this.telegraphs.destroy();
    this.outlines.destroy();
    this.overhead.destroy();
    this.strobes.clear();
    for (const image of this.images.values()) image.destroy();
    this.images.clear();
    this.seen.clear();
  }

  /**
   * The sprite for `key`, created on first use and fully reset on every call,
   * so nothing from an earlier owner of the same id (rotation, flip, alpha,
   * size) survives into this frame.
   */
  private place(
    key: string,
    depth: number,
    texture: string,
    frame: number,
    x: number,
    y: number,
    originY: number,
  ): Phaser.GameObjects.Image {
    this.seen.add(key);
    let image = this.images.get(key);
    if (!image) {
      image = this.scene.add.image(x, y, texture, frame).setDepth(depth);
      this.images.set(key, image);
    } else if (image.texture.key !== texture) {
      image.setTexture(texture);
    }
    return image
      .setDepth(depth)
      .setFrame(frame)
      .setPosition(x, y)
      .setOrigin(CENTER, originY)
      .setScale(1)
      .setRotation(0)
      .setFlip(false, false)
      .setAlpha(1);
  }

  private releaseUnseen(): void {
    for (const [key, image] of this.images) {
      if (this.seen.has(key)) continue;
      image.destroy();
      this.images.delete(key);
    }
  }

  private drawHazard(h: Hazard): void {
    if (h.style === "ring") this.drawRing(h);
    else this.drawPatch(h);
  }

  // The hit lands on the first tick; the ring only sells the shockwave. The
  // expanding square stays under the rocks so the reach is still readable.
  private drawRing(h: Hazard): void {
    const g = this.ground;
    const t = ringProgress(h.life, h.maxLife);
    const half = ringHalf(h.radius, t);
    g.fillStyle(h.color, 0.25 * (1 - t));
    g.fillRect(h.pos.x - half, h.pos.y - half, half * 2, half * 2);
    g.lineStyle(2, h.color, 1 - t * 0.7);
    g.strokeRect(h.pos.x - half, h.pos.y - half, half * 2, half * 2);

    const frame = lifeFrame(h.life, h.maxLife, ROCK_FRAMES);
    ringAnchors(half).forEach((anchor, i) => {
      const y = h.pos.y + anchor.y;
      this.place(
        `ring:${h.id}:${i}`,
        actorDepth(y, h.id * 8 + i),
        FX_KEY.rockSpike,
        frame,
        h.pos.x + anchor.x,
        y,
        ROCK_FEET_ORIGIN_Y,
      );
    });
  }

  private drawPatch(h: Hazard): void {
    const fade = hazardFade(h.life);
    this.ground.fillStyle(h.color, 0.3 * fade);
    this.ground.fillRect(
      h.pos.x - h.radius,
      h.pos.y - h.radius,
      h.radius * 2,
      h.radius * 2,
    );

    const span = h.radius * 2;
    const count = Math.max(1, Math.ceil(span / FLAME_SPACING));
    const reach = Math.max(0, span - FLAME_SIZE);
    const step = count > 1 ? reach / (count - 1) : 0;
    const age = h.maxLife - h.life;
    for (let i = 0; i < count; i += 1) {
      const frame = fireFrame(h.life, age, h.id + i * 5);
      this.place(
        `patch:${h.id}:${i}`,
        DEPTH.groundFx,
        FX_KEY.fireFlicker,
        frame,
        h.pos.x - reach / 2 + i * step,
        h.pos.y + h.radius / 2,
        1,
      );
    }
  }

  private drawTelegraph(
    state: SimState,
    e: Entity,
    strobing: Set<number>,
  ): void {
    const g = this.telegraphs;
    const attack = currentAttack(e, state.tuning);
    if (!attack?.telegraph) return;
    const box = telegraphBox(e, state.tuning);
    const progress = (e.combat.attackFrame + 1) / attack.startup;
    if (box && attack.unblockable) {
      // Red and strobing is reserved for "block will not save you". The strobe
      // holds while the attacker is frozen, like the attacker itself.
      const strobe = advanceStrobe(
        this.strobes.get(e.id),
        state.tick,
        e.combat.hitstop,
      );
      this.strobes.set(e.id, strobe);
      strobing.add(e.id);
      const lit = blinkOn(strobe.clock, 3);
      g.fillStyle(lit ? UNBLOCKABLE : FLASH, lit ? 0.35 + 0.4 * progress : 0.5);
      g.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
      this.strokeBox(box, lit ? UNBLOCKABLE : FLASH);
    } else if (box && attack.sweep) {
      this.drawSweepBar(e, box, progress);
      this.strokeBox(box, SWEEP_TELEGRAPH);
    } else if (box && attack.ground) {
      // A slam has no front: pulse the whole area and outline it.
      g.fillStyle(SWEEP_TELEGRAPH, 0.1 + 0.25 * progress);
      g.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
      this.strokeBox(box, SWEEP_TELEGRAPH);
    } else if (box) {
      g.fillStyle(TELEGRAPH, 0.15 + 0.35 * progress);
      g.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
      this.strokeBox(box, TELEGRAPH);
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

  // Above the bodies, so an attacker facing up cannot hide its own telegraph.
  private strokeBox(box: Box, color: number): void {
    this.outlines.lineStyle(1, color, OUTLINE_ALPHA);
    this.outlines.strokeRect(
      box.minX + 0.5,
      box.minY + 0.5,
      box.maxX - box.minX - 1,
      box.maxY - box.minY - 1,
    );
  }

  // A sweep is wide and low: a thin bar advances from the attacker's feet as
  // the windup runs out, inside the outline of the whole reach.
  private drawSweepBar(e: Entity, box: Box, progress: number): void {
    const g = this.telegraphs;
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
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

  // The slashes are fitted to the sim's spin box, and a faint outline keeps the
  // square the spin really hits in view, since the art alone is a circle.
  private drawSpin(state: SimState, e: Entity): void {
    const box = spinBox(e, state.tuning);
    if (!box) return;
    const size = box.maxX - box.minX;
    const [first, second] = spinFrames(e.combat.spinFrame);
    const scale = size / SLASH_FRAME_H;
    this.place(
      `spin:${e.id}:0`,
      DEPTH.overheadFx,
      FX_KEY.slashCircularLarge,
      first,
      e.pos.x,
      e.pos.y,
      CENTER,
    ).setScale(scale);
    this.place(
      `spin:${e.id}:1`,
      DEPTH.overheadFx,
      FX_KEY.slashCircularLarge,
      second,
      e.pos.x,
      e.pos.y,
      CENTER,
    )
      .setScale(scale)
      .setFlip(true, true);
    this.overhead.lineStyle(1, SPIN_RING, SPIN_AREA_ALPHA);
    this.overhead.strokeRect(
      box.minX + 0.5,
      box.minY + 0.5,
      size - 1,
      size - 1,
    );
  }

  private drawProjectiles(state: SimState): void {
    for (const p of state.projectiles) {
      const b = projectileBox(p, state.tuning);
      const deflected = p.deflected;
      // Life counts down; negating it plays the loop forward.
      const frame = loopFrame(
        -p.life,
        PROJECTILE_TICKS_PER_FRAME,
        PROJECTILE_FRAMES,
      );
      this.place(
        `projectile:${p.id}`,
        DEPTH.overheadFx,
        deflected ? FX_KEY.energyBall : FX_KEY.fireball,
        frame,
        (b.minX + b.maxX) / 2,
        (b.minY + b.maxY) / 2,
        CENTER,
      )
        .setScale(PROJECTILE_SCALE)
        .setRotation(
          headingRotation(
            p.vel,
            deflected ? ENERGY_BALL_HEADING : FIREBALL_HEADING,
          ),
        );
    }
  }
}
