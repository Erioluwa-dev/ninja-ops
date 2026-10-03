import type { ChapterRegistry } from "../../story/schema";
import { CH1 } from "./ch1";
import { DEMO_CHAPTER } from "./demo";

/** Playable story sets by the `?story=` key. */
export const STORY_REGISTRIES: Record<string, ChapterRegistry> = {
  ch1: [CH1],
  demo: [DEMO_CHAPTER],
};

export const DEFAULT_STORY = "ch1";
