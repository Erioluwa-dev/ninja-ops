import { assetUrl } from "./assetUrl";
import type { AssetEntry } from "./types";

export const HUD_KEY = {
  /** 8x8 bitmap font, 15 columns; frame = character code - 32. */
  font: "hud-font",
  /** 18x4 bar frame with a 1 px border, stretched as a nine-slice behind the meters. */
  barUnder: "hud-bar-under",
  /** 16x16 nine-slice panel for the intro and result screens. */
  panel: "hud-panel",
} as const;

export const HUD_ASSETS = [
  { type: "image", key: HUD_KEY.font, url: assetUrl("ui/font-8x8.png") },
  {
    type: "image",
    key: HUD_KEY.barUnder,
    url: assetUrl("ui/lifebar-mini-under.png"),
  },
  { type: "image", key: HUD_KEY.panel, url: assetUrl("ui/panel-wood.png") },
] as const satisfies readonly AssetEntry[];
