import { describe, expect, it } from "vitest";
import { createStoryState } from "../story/state";
import {
  clearStory,
  type KeyValueStore,
  loadStory,
  STORY_SAVE_KEY,
  saveStory,
} from "./storyStorage";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

const failing = (message: string): KeyValueStore => ({
  getItem: () => {
    throw new Error(message);
  },
  setItem: () => {
    throw new Error(message);
  },
  removeItem: () => {
    throw new Error(message);
  },
});

describe("story storage", () => {
  it("returns null when nothing is saved", () => {
    expect(loadStory(memoryStore())).toBeNull();
  });

  it("round-trips a state", () => {
    const store = memoryStore();
    const state = {
      ...createStoryState(),
      trust_kai: 2,
      scene: "ch1_s2" as const,
    };
    expect(saveStory(store, state)).toEqual({ ok: true });
    expect(loadStory(store)).toEqual({ ok: true, state });
  });

  it("reports an unreadable save instead of dropping it", () => {
    const store = memoryStore();
    store.setItem(STORY_SAVE_KEY, "{not json");
    const result = loadStory(store);
    expect(result?.ok).toBe(false);
  });

  it("reports storage errors on save, load and clear", () => {
    const store = failing("quota");
    const save = saveStory(store, createStoryState());
    expect(save.ok).toBe(false);
    expect(loadStory(store)?.ok).toBe(false);
    expect(clearStory(store).ok).toBe(false);
  });

  it("clears the save", () => {
    const store = memoryStore();
    saveStory(store, createStoryState());
    expect(clearStory(store)).toEqual({ ok: true });
    expect(loadStory(store)).toBeNull();
  });
});
