import Phaser from "phaser";
import { ArenaScene } from "./scenes/ArenaScene";

const WIDTH = 240;
const HEIGHT = 160;

const parent = document.getElementById("game");
if (!parent) throw new Error("Missing #game mount element");

const game = new Phaser.Game({
  // NineSlice and tint-fill modes only render under WebGL; Canvas would silently drop them.
  type: Phaser.WEBGL,
  parent,
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#000000",
  pixelArt: true,
  roundPixels: true,
  input: { gamepad: true },
  scale: { mode: Phaser.Scale.NONE },
  scene: [ArenaScene],
});

// Phaser's FIT mode scales fractionally, which blurs pixel art; size the canvas by whole multiples instead.
function fitCanvas(): void {
  const factor = Math.max(
    1,
    Math.floor(
      Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT),
    ),
  );
  game.canvas.style.width = `${WIDTH * factor}px`;
  game.canvas.style.height = `${HEIGHT * factor}px`;
}

fitCanvas();
window.addEventListener("resize", fitCanvas);
