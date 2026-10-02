import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs let the same build run from a subfolder (itch.io serves
  // the game from one) as well as from a domain root.
  base: "./",
  // Phaser ships as one large chunk; splitting it gains nothing for a static bundle.
  build: { chunkSizeWarningLimit: 2000 },
});
