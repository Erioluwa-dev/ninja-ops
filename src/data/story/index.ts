import type { ChapterRegistry } from "../../story/schema";
import { DEMO_CHAPTER } from "./demo";

/** Playable story sets by the `?story=` key; Chapter 1 joins in Phase 12. */
export const STORY_REGISTRIES: Record<string, ChapterRegistry> = {
  demo: [DEMO_CHAPTER],
};
