import { defineConfig } from "vite";

export default defineConfig({
  // Phaser ships as one large chunk; splitting it gains nothing for a static bundle.
  build: { chunkSizeWarningLimit: 2000 },
});
