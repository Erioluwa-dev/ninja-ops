import { describe, expect, it } from "vitest";
import { DEMO_CHAPTER } from "../data/story/demo";
import { holds } from "./conditions";
import { applyEffect } from "./effects";
import {
  advance,
  choose,
  createRunner,
  type RunnerState,
  resolveCombat,
  runnerAtBoundary,
  startScene,
  type UiEvent,
} from "./runner";
import {
  parseStory,
  SAVE_VERSION,
  serializeStory,
  validateStoryState,
} from "./save";
import {
  type ChapterRegistry,
  type SceneDef,
  validateRegistry,
} from "./schema";
import { createStoryState, type StoryState } from "./state";

const REGISTRY: ChapterRegistry = [DEMO_CHAPTER];

const kinds = (events: UiEvent[]): string[] => events.map((e) => e.type);

function start(): { runner: RunnerState; events: UiEvent[] } {
  return startScene(REGISTRY, createRunner(createStoryState()), "ch1_s1");
}

describe("effects", () => {
  it("never mutates its input", () => {
    const before = Object.freeze({
      ...createStoryState(),
      unlocks: Object.freeze([]) as unknown as string[],
    });
    const after = applyEffect(before, { kind: "unlock", id: "afterstep" });
    expect(before.unlocks).toEqual([]);
    expect(after.unlocks).toEqual(["afterstep"]);
  });

  it("clamps meters to their range", () => {
    let s = createStoryState();
    s = applyEffect(s, { kind: "trust", ninja: "kai", delta: 99 });
    s = applyEffect(s, { kind: "trust", ninja: "jay", delta: -99 });
    s = applyEffect(s, { kind: "corruption", delta: 500 });
    s = applyEffect(s, { kind: "resonance", delta: 9 });
    expect([s.trust_kai, s.trust_jay, s.corruption, s.resonance]).toEqual([
      10, 0, 100, 4,
    ]);
    s = applyEffect(s, { kind: "corruption", delta: -10 });
    expect(s.corruption).toBe(90);
  });

  it("keeps lists free of duplicates and only raises the blade stage", () => {
    let s = createStoryState();
    s = applyEffect(s, { kind: "unlock", id: "x" });
    s = applyEffect(s, { kind: "unlock", id: "x" });
    s = applyEffect(s, { kind: "bladeStage", stage: 1 });
    s = applyEffect(s, { kind: "bladeStage", stage: 0 });
    expect(s.unlocks).toEqual(["x"]);
    expect(s.blade_stage).toBe(1);
  });
});

describe("conditions", () => {
  it("combines with not, all and any", () => {
    const s: StoryState = { ...createStoryState(), trust_kai: 3 };
    const high = { kind: "trust", ninja: "kai", min: 3 } as const;
    const low = { kind: "trust", ninja: "kai", min: 4 } as const;
    expect(holds(s, high)).toBe(true);
    expect(holds(s, { kind: "not", of: low })).toBe(true);
    expect(holds(s, { kind: "all", of: [high, low] })).toBe(false);
    expect(holds(s, { kind: "any", of: [high, low] })).toBe(true);
  });

  it("matches a weapon guard by either field", () => {
    const s = applyEffect(createStoryState(), {
      kind: "setWeaponGuard",
      weapon: "sword_of_fire",
      ninja: "kai",
    });
    expect(holds(s, { kind: "weaponGuard", ninja: "kai" })).toBe(true);
    expect(holds(s, { kind: "weaponGuard", weapon: "shurikens_of_ice" })).toBe(
      false,
    );
    expect(holds(createStoryState(), { kind: "weaponGuard" })).toBe(false);
  });
});

describe("runner", () => {
  it("blocks on dialogue, then a choice, and applies the picked effects", () => {
    let { runner, events } = start();
    expect(kinds(events)).toEqual(["sceneStart", "dialogue"]);
    ({ runner, events } = advance(REGISTRY, runner));
    const choice = events[0];
    expect(choice?.type).toBe("choice");
    if (choice?.type === "choice") {
      // "hidden" is not shown; "locked" is shown but disabled.
      expect(choice.options.map((o) => [o.id, o.enabled])).toEqual([
        ["kai", true],
        ["cole", true],
        ["locked", false],
      ]);
    }
    ({ runner, events } = choose(REGISTRY, runner, "kai"));
    expect(runner.story.ch1_sparring_partner).toBe("kai");
    expect(runner.story.trust_kai).toBe(2);
    expect(kinds(events)).toEqual(["choiceMade", "dialogue"]);
  });

  it("rejects hidden, disabled and unknown options", () => {
    let { runner } = start();
    ({ runner } = advance(REGISTRY, runner));
    expect(() => choose(REGISTRY, runner, "hidden")).toThrow();
    expect(() => choose(REGISTRY, runner, "locked")).toThrow();
    expect(() => choose(REGISTRY, runner, "nope")).toThrow();
  });

  it("rejects calls that do not match what it is waiting on", () => {
    const { runner } = start();
    expect(() => choose(REGISTRY, runner, "kai")).toThrow();
    expect(() => resolveCombat(REGISTRY, runner, "won")).toThrow();
  });

  it("plays an option's follow-up steps before the scene carries on", () => {
    let { runner, events } = start();
    ({ runner } = advance(REGISTRY, runner));
    ({ runner } = choose(REGISTRY, runner, "cole"));
    ({ runner, events } = advance(REGISTRY, runner));
    expect(events[0]?.type).toBe("choice");
    ({ runner, events } = choose(REGISTRY, runner, "tell"));
    expect(runner.story.wu_knows_blade).toBe(true);
    expect(events.map((e) => e.type)).toEqual(["choiceMade", "dialogue"]);
    ({ runner, events } = advance(REGISTRY, runner));
    expect(kinds(events)).toEqual(["sceneEnd"]);
    expect(runner.wait.kind).toBe("boundary");
  });

  it("replays a combat on a loss and carries on after a win", () => {
    let { runner } = startScene(
      REGISTRY,
      createRunner(createStoryState()),
      "ch1_s2",
    );
    expect(runner.wait.kind).toBe("combat");
    let events: UiEvent[];
    ({ runner, events } = resolveCombat(REGISTRY, runner, "lost"));
    expect(events).toEqual([{ type: "combat", encounter: "test" }]);
    expect(runner.story.fixed_points_fired).toEqual([]);
    ({ runner, events } = resolveCombat(REGISTRY, runner, "won"));
    expect(kinds(events)).toEqual(["unlock", "fixedPoint", "sceneEnd"]);
    expect(runner.story.unlocks).toEqual(["afterstep"]);
    expect(runner.story.fixed_points_fired).toEqual(["ch1_weapons_gathered"]);
  });

  it("ends the chapter from the last boundary", () => {
    let { runner } = startScene(
      REGISTRY,
      createRunner(createStoryState()),
      "ch1_s2",
    );
    ({ runner } = resolveCombat(REGISTRY, runner, "won"));
    expect(runner.story.scene).toBeNull();
    const { runner: end, events } = advance(REGISTRY, runner);
    expect(events).toEqual([{ type: "chapterEnd", chapter: 1 }]);
    expect(end.wait.kind).toBe("done");
  });
});

describe("save and load", () => {
  function playToBoundary(): RunnerState {
    let { runner } = start();
    ({ runner } = advance(REGISTRY, runner));
    ({ runner } = choose(REGISTRY, runner, "kai"));
    ({ runner } = advance(REGISTRY, runner));
    ({ runner } = choose(REGISTRY, runner, "keep"));
    expect(runner.wait.kind).toBe("boundary");
    return runner;
  }

  it("persists two choices across serialise and parse", () => {
    const runner = playToBoundary();
    const loaded = parseStory(serializeStory(runner.story));
    expect(loaded).toEqual({ ok: true, state: runner.story });
    expect(runner.story.ch1_sparring_partner).toBe("kai");
    expect(runner.story.scene).toBe("ch1_s2");
  });

  it("resumes at the saved boundary exactly as a live run would", () => {
    const live = playToBoundary();
    const loaded = parseStory(serializeStory(live.story));
    if (!loaded.ok) throw new Error(loaded.error);
    const resumed = advance(REGISTRY, runnerAtBoundary(loaded.state));
    const direct = advance(REGISTRY, live);
    expect(resumed).toEqual(direct);
  });

  it("rejects bad data with a reason", () => {
    const good = createStoryState();
    const bad: [string, unknown][] = [
      ["not an object", 5],
      ["missing key", { ...good, corruption: undefined }],
      ["out of range", { ...good, corruption: 101 }],
      ["fractional", { ...good, trust_kai: 1.5 }],
      ["bad enum", { ...good, ch1_sparring_partner: "nya" }],
      ["bad scene", { ...good, scene: "intro" }],
      [
        "bad guard",
        { ...good, ch1_weapon_guard: { weapon: "x", ninja: "kai" } },
      ],
      ["bad fixed point", { ...good, fixed_points_fired: ["nope"] }],
      ["bad list", { ...good, unlocks: [1] }],
      ["bad flag", { ...good, wu_knows_blade: "yes" }],
    ];
    for (const [name, value] of bad) {
      const result = validateStoryState(value);
      expect(result.ok, name).toBe(false);
    }
    expect(parseStory("{").ok).toBe(false);
    expect(parseStory(JSON.stringify({ version: SAVE_VERSION + 1 })).ok).toBe(
      false,
    );
  });
});

describe("registry validation", () => {
  const scene = (over: Partial<SceneDef>): SceneDef => ({
    id: "ch1_s1",
    title: "t",
    backdrop: "b",
    next: null,
    steps: [],
    ...over,
  });

  it("accepts the test chapter", () => {
    expect(validateRegistry(REGISTRY)).toEqual([]);
  });

  it("flags unknown next scenes, duplicates, and option counts", () => {
    const problems = validateRegistry([
      {
        id: 1,
        title: "x",
        scenes: [
          scene({ next: "ch1_s9" }),
          scene({
            id: "ch1_s2",
            steps: [
              {
                kind: "choice",
                id: "c",
                prompt: "?",
                options: [{ id: "a", label: "A", effects: [] }],
              },
            ],
          }),
          scene({ id: "ch1_s2" }),
        ],
      },
    ]);
    expect(problems.some((p) => p.includes("unknown scene ch1_s9"))).toBe(true);
    expect(problems.some((p) => p.includes("duplicate scene ch1_s2"))).toBe(
      true,
    );
    expect(problems.some((p) => p.includes("1 options"))).toBe(true);
    expect(problems.some((p) => p.includes("has no effect"))).toBe(true);
  });
});
