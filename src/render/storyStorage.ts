import { type LoadResult, parseStory, serializeStory } from "../story/save";
import type { StoryState } from "../story/state";

/** The slice of the Web Storage API the story save needs, so tests can fake it. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORY_SAVE_KEY = "ninja-ops.story";

export type SaveOutcome = { ok: true } | { ok: false; error: string };

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Null when storage is blocked (private mode, sandboxed frame): the game then runs without saves. */
export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch (error) {
    console.warn(
      "localStorage is unavailable; progress will not be saved",
      error,
    );
    return null;
  }
}

export function saveStory(
  store: KeyValueStore,
  state: StoryState,
): SaveOutcome {
  try {
    store.setItem(STORY_SAVE_KEY, serializeStory(state));
    return { ok: true };
  } catch (error) {
    // Quota exceeded and blocked writes are real: the caller tells the player.
    return { ok: false, error: `could not save: ${describe(error)}` };
  }
}

/** Null when nothing is saved; a failed result when something is saved but unreadable. */
export function loadStory(store: KeyValueStore): LoadResult | null {
  let text: string | null;
  try {
    text = store.getItem(STORY_SAVE_KEY);
  } catch (error) {
    return { ok: false, error: `could not read save: ${describe(error)}` };
  }
  return text === null ? null : parseStory(text);
}

export function clearStory(store: KeyValueStore): SaveOutcome {
  try {
    store.removeItem(STORY_SAVE_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `could not clear save: ${describe(error)}` };
  }
}
