import Phaser from "phaser";
import { ArenaScene } from "./scenes/ArenaScene";
import { StoryScene } from "./scenes/StoryScene";

const WIDTH = 240;
const HEIGHT = 160;
const STORY_MODE = new URLSearchParams(window.location.search).has("story");

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
  // The first scene starts; `?story` opens the story, the sandbox is the default.
  scene: STORY_MODE ? [StoryScene, ArenaScene] : [ArenaScene, StoryScene],
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
