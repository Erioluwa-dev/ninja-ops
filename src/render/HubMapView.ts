import type Phaser from "phaser";
import type { ComposedMap, PlacedStamp } from "../data/hubCompose";
import { type Cell, frameOf } from "../data/hubTiles";
import { hubSheetKey } from "./assets";
import { actorDepth, DEPTH } from "./depth";

const TILE = 16;
/** Above every y-sorted actor, below overhead fx. */
const ROOF_DEPTH = DEPTH.overheadFx - 10;

/**
 * Draws a composed hub map as images: ground and overlay under the actors,
 * stamps split so their solid base sorts with actors and the rest (roofs,
 * canopies) covers the player.
 */
export class HubMapView {
  private readonly images: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, map: ComposedMap) {
    for (let i = 0; i < map.ground.length; i++) {
      const col = i % map.cols;
      const row = Math.floor(i / map.cols);
      const base = map.ground[i];
      if (base) this.put(scene, base, col, row, DEPTH.floor);
      const top = map.overlay[i];
      if (top) this.put(scene, top, col, row, DEPTH.floor + 1);
    }
    for (const s of map.stamps) this.drawStamp(scene, s);
  }

  destroy(): void {
    for (const img of this.images) img.destroy();
    this.images.length = 0;
  }

  private drawStamp(scene: Phaser.Scene, s: PlacedStamp): void {
    const { def } = s;
    const baseY = (s.row + def.h) * TILE;
    const firstSolid = def.h - def.solidRows;
    for (let r = 0; r < def.h; r++) {
      let depth: number;
      if (def.solidRows === 0) depth = DEPTH.groundFx;
      else if (r >= firstSolid) depth = actorDepth(baseY);
      else depth = ROOF_DEPTH;
      for (let c = 0; c < def.w; c++) {
        const cell: Cell = {
          sheet: def.sheet,
          col: def.col + c,
          row: def.row + r,
        };
        this.put(scene, cell, s.col + c, s.row + r, depth);
      }
    }
  }

  private put(
    scene: Phaser.Scene,
    cell: Cell,
    col: number,
    row: number,
    depth: number,
  ): void {
    const img = scene.add
      .image(col * TILE, row * TILE, hubSheetKey(cell.sheet), frameOf(cell))
      .setOrigin(0, 0)
      .setDepth(depth);
    this.images.push(img);
  }
}
