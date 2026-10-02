const ROOT = "assets/ninja-adventure";

// BASE_URL is "./" in a build (see vite.config.ts), so the same paths work from a
// subfolder on itch.io as from the dev server's root.
export const assetUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${ROOT}/${path}`;
