import type Phaser from "phaser";
import { DEPTH } from "./depth";

/**
 * Full-screen fade / iris overlay for scene transitions.
 * Uses a Graphics rect that tweens alpha; no extra assets.
 */
export class TransitionView {
  private readonly overlay: Phaser.GameObjects.Graphics;
  private tweening = false;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.overlay = scene.add
      .graphics()
      .setDepth(DEPTH.overlay + 5)
      .setScrollFactor(0);
    this.overlay.fillStyle(0x000000, 1);
    this.overlay.fillRect(0, 0, width, height);
    this.overlay.setAlpha(0);
  }

  /** Fade from black (scene enter). */
  fadeIn(durationMs = 320): Promise<void> {
    return this.tweenAlpha(1, 0, durationMs);
  }

  /** Fade to black (scene exit). */
  fadeOut(durationMs = 320): Promise<void> {
    return this.tweenAlpha(0, 1, durationMs);
  }

  /** Instant flash for combat hit / unlock. */
  flash(color = 0xffffff, durationMs = 120): void {
    this.overlay.clear();
    this.overlay.fillStyle(color, 0.35);
    this.overlay.fillRect(
      0,
      0,
      this.scene.scale.width,
      this.scene.scale.height,
    );
    this.overlay.setAlpha(1);
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: durationMs,
      ease: "Quad.easeOut",
      onComplete: () => this.overlay.clear(),
    });
  }

  /** Corruption vignette: subtle dark border that grows with meter. */
  setVignette(intensity: number): void {
    // 0..100 -> 0..0.45 alpha at edges.
    if (intensity <= 0) {
      this.overlay.setAlpha(0);
      return;
    }
    const alpha = Math.min(0.45, (intensity / 100) * 0.45);
    this.overlay.clear();
    // Simple vignette: dark rect with a transparent hole is expensive in Phaser Graphics,
    // so we use a 4-border approach that reads as vignette on 240x160.
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const inset = 12;
    this.overlay.fillStyle(0x1a0a2a, alpha);
    this.overlay.fillRect(0, 0, w, inset);
    this.overlay.fillRect(0, h - inset, w, inset);
    this.overlay.fillRect(0, inset, inset, h - inset * 2);
    this.overlay.fillRect(w - inset, inset, inset, h - inset * 2);
    this.overlay.setAlpha(1);
  }

  clearVignette(): void {
    if (!this.tweening) {
      this.overlay.clear();
      this.overlay.setAlpha(0);
    }
  }

  destroy(): void {
    this.overlay.destroy();
  }

  private tweenAlpha(
    from: number,
    to: number,
    durationMs: number,
  ): Promise<void> {
    this.tweening = true;
    this.overlay.clear();
    this.overlay.fillStyle(0x000000, 1);
    this.overlay.fillRect(
      0,
      0,
      this.scene.scale.width,
      this.scene.scale.height,
    );
    this.overlay.setAlpha(from);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.overlay,
        alpha: to,
        duration: durationMs,
        ease: "Quad.easeInOut",
        onComplete: () => {
          this.tweening = false;
          if (to === 0) this.overlay.clear();
          resolve();
        },
      });
    });
  }
}
