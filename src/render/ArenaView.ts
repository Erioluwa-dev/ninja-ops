import type Phaser from "phaser";
import { type Arena, isSolidTile } from "../sim";
import { TILE_KEY } from "./assets";
import { DEPTH, wallDepth } from "./depth";
import { floorFrame, NEIGHBOR, neighborMask, wallFrame } from "./tiles";
import type { RenderFrame, RenderView } from "./view";

// The stone is warm and light enough to wash out amber telegraphs; this
// multiply tint pulls its average from (99,85,80) to about (39,34,40).
const FLOOR_TINT = 0x646680;

/** Floor and wall tiles from the arena grid, rebuilt only if the grid changes. */
export class ArenaView implements RenderView {
  private tiles: Phaser.GameObjects.Image[] = [];
  private built: Arena | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  draw({ state }: RenderFrame): void {
    if (state.arena !== this.built) this.build(state.arena);
  }

  destroy(): void {
    this.clear();
  }

  private build(arena: Arena): void {
    this.clear();
    this.built = arena;
    const size = arena.tileSize;
    const place = (
      col: number,
      row: number,
      key: string,
      frame: number,
      depth: number,
    ): Phaser.GameObjects.Image => {
      const tile = this.scene.add
        .image(col * size, row * size, key, frame)
        .setOrigin(0, 0)
        .setDepth(depth);
      this.tiles.push(tile);
      return tile;
    };
    for (let row = 0; row < arena.rows; row++) {
      for (let col = 0; col < arena.cols; col++) {
        // Wall pieces have ragged edges, so the floor goes under them too.
        place(
          col,
          row,
          TILE_KEY.floor,
          floorFrame(col, row),
          DEPTH.floor,
        ).setTint(FLOOR_TINT);
        if (isSolidTile(arena, col, row)) {
          const mask = neighborMask(arena, col, row);
          const southOpen = (mask & NEIGHBOR.s) === 0;
          place(
            col,
            row,
            TILE_KEY.wall,
            wallFrame(mask),
            wallDepth(row, size, southOpen),
          );
        }
      }
    }
  }

  private clear(): void {
    for (const tile of this.tiles) tile.destroy();
    this.tiles = [];
    this.built = null;
  }
}
