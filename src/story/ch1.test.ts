import { describe, expect, it } from "vitest";
import { ECHO_MOVE_IDS } from "../data/echo";
import { ENCOUNTERS, isEncounterId } from "../data/encounters";
import { MOBS } from "../data/mobs";
import { CH1 } from "../data/story/ch1";
import CH1_SOURCE from "../data/story/ch1.ts?raw";
import { holds } from "./conditions";
import type { Effect } from "./effects";
import { applyEffect } from "./effects";
import { allyMobType, encounterContext, perkLevel } from "./perks";
import {
  advance,
  choose,
  createRunner,
  type RunnerState,
  resolveCombat,
  runnerAtBoundary,
  startScene,
} from "./runner";
import { parseStory, serializeStory } from "./save";
import {
  type ChapterRegistry,
  type SceneDef,
  validateRegistry,
  walkSteps,
} from "./schema";
import {
  createStoryState,
  FIXED_POINT_IDS,
  NINJA_IDS,
  type StoryState,
  trustOf,
  WEAPON_IDS,
} from "./state";

const REGISTRY: ChapterRegistry = [CH1];
const SCENE_IDS = Array.from({ length: 9 }, (_, i) => `ch1_s${i + 1}`);

const scene = (id: string): SceneDef => {
  const found = CH1.scenes.find((s) => s.id === id);
  if (!found) throw new Error(`no scene ${id}`);
  return found;
};

/** Every effect a scene can apply, wherever it sits in the scene. */
function effectsIn(def: SceneDef): Effect[] {
  const out: Effect[] = [];
  for (const step of walkSteps(def.steps)) {
    if (step.kind === "effect") out.push(...step.effects);
    if (step.kind === "choice") {
      for (const o of step.options) out.push(...o.effects);
    }
  }
  return out;
}

describe("Chapter 1 content", () => {
  it("has scenes ch1_s1 to ch1_s9 in order, each leading to the next", () => {
    expect(CH1.scenes.map((s) => s.id)).toEqual(SCENE_IDS);
    CH1.scenes.forEach((s, i) => {
      expect(s.next).toBe(SCENE_IDS[i + 1] ?? null);
    });
  });

  it("passes registry validation", () => {
    expect(validateRegistry(REGISTRY)).toEqual([]);
  });

  it("only names encounters and Echo moves that exist", () => {
    for (const def of CH1.scenes) {
      for (const step of walkSteps(def.steps)) {
        if (step.kind === "combat") {
          expect(isEncounterId(step.encounter), step.encounter).toBe(true);
        }
        if (step.kind === "unlock") {
          expect(ECHO_MOVE_IDS as readonly string[]).toContain(step.id);
        }
      }
    }
  });

  it("sets each PRD §6 flag in the scene the registry names", () => {
    const sets = (id: string, kind: Effect["kind"], key?: string): boolean =>
      effectsIn(scene(id)).some(
        (e) =>
          e.kind === kind &&
          (key === undefined || ("key" in e && e.key === key)),
      );
    expect(sets("ch1_s2", "setSparringPartner")).toBe(true);
    expect(sets("ch1_s4", "setFlag", "dragon_ignored_you")).toBe(true);
    expect(sets("ch1_s5", "setWeaponGuard")).toBe(true);
    expect(sets("ch1_s6", "setFlag", "wu_knows_blade")).toBe(true);
    expect(sets("ch1_s8", "setGarmadonChoice")).toBe(true);
  });

  it("grants the Bible's four moves in the Bible's scenes", () => {
    const unlocksIn = (id: string): string[] =>
      [...walkSteps(scene(id).steps)].flatMap((s) =>
        s.kind === "unlock" ? [s.id] : [],
      );
    expect(unlocksIn("ch1_s1")).toEqual(["afterstep", "twinStrike"]);
    expect(unlocksIn("ch1_s3")).toEqual(["decoyVeil"]);
    expect(unlocksIn("ch1_s4")).toEqual(["rewindStep"]);
  });

  it("tags every dialogue line as Bible or draft", () => {
    const source = CH1_SOURCE.split("\n");
    let lines = 0;
    source.forEach((line, i) => {
      if (!/^\s*d\(/.test(line)) return;
      lines += 1;
      const above = (source[i - 1] ?? "").trim();
      expect(above, `line ${i + 1}`).toMatch(/^\/\/ (BIBLE|DRAFT\(writer\))$/);
    });
    expect(lines).toBeGreaterThan(30);
  });

  it("uses the Bible's Wu line verbatim", () => {
    const line = [...walkSteps(scene("ch1_s1").steps)].find(
      (s) =>
        s.kind === "dialogue" &&
        s.speaker === "wu" &&
        s.text.includes("trails"),
    );
    expect(line).toMatchObject({
      text: "Your spinjitzu doesn't spin true. It trails.",
    });
  });

  it("never states the heritage in player-facing text", () => {
    const banned = /\b(oni|dragon heritage|half[- ]dragon|reveal)\b/i;
    for (const def of CH1.scenes) {
      for (const step of walkSteps(def.steps)) {
        if (step.kind === "dialogue") expect(step.text).not.toMatch(banned);
      }
    }
  });
});

// --- Headless play: every combination of choices -------------------------

interface Leaf {
  runner: RunnerState;
  trail: string[];
  sawChapterEnd: boolean;
}

interface Walk {
  /** How many times each combat is lost before it is won. */
  losses?: number;
  onBoundary?: (runner: RunnerState) => void;
}

/** Plays from `runner`, branching at every choice, and reports each finished run. */
function explore(
  runner: RunnerState,
  trail: string[],
  chapterEnd: boolean,
  options: Walk,
  leaves: Leaf[],
): void {
  let current = runner;
  let ended = chapterEnd;
  const lostAt = new Map<string, number>();
  for (;;) {
    const { wait } = current;
    if (wait.kind === "done") {
      leaves.push({ runner: current, trail, sawChapterEnd: ended });
      return;
    }
    if (wait.kind === "dialogue") {
      current = advance(REGISTRY, current).runner;
    } else if (wait.kind === "boundary") {
      options.onBoundary?.(current);
      const update = advance(REGISTRY, current);
      ended = ended || update.events.some((e) => e.type === "chapterEnd");
      current = update.runner;
    } else if (wait.kind === "combat") {
      const key = `${current.scene}:${wait.encounter}`;
      const lost = lostAt.get(key) ?? 0;
      if (lost < (options.losses ?? 0)) {
        lostAt.set(key, lost + 1);
        current = resolveCombat(REGISTRY, current, "lost").runner;
      } else {
        current = resolveCombat(REGISTRY, current, "won").runner;
      }
    } else if (wait.kind === "choice") {
      for (const option of wait.step.options) {
        const shown = !option.show || holds(current.story, option.show);
        const enabled = !option.enabled || holds(current.story, option.enabled);
        if (!shown || !enabled) continue;
        const next = choose(REGISTRY, current, option.id).runner;
        explore(
          next,
          [...trail, `${wait.step.id}=${option.id}`],
          ended,
          options,
          leaves,
        );
      }
      return;
    } else {
      throw new Error(`stuck waiting on ${wait.kind}`);
    }
  }
}

function playAll(options: Walk = {}): Leaf[] {
  const leaves: Leaf[] = [];
  const start = startScene(
    REGISTRY,
    createRunner(createStoryState()),
    "ch1_s1",
  );
  explore(start.runner, [], false, options, leaves);
  return leaves;
}

describe("Chapter 1 branch coverage", () => {
  const leaves = playAll({
    onBoundary: (runner) => {
      // Save and load at every scene boundary: the resumed run must match.
      const loaded = parseStory(serializeStory(runner.story));
      if (!loaded.ok) throw new Error(loaded.error);
      expect(loaded.state).toEqual(runner.story);
      expect(advance(REGISTRY, runnerAtBoundary(loaded.state))).toEqual(
        advance(REGISTRY, runner),
      );
    },
  });

  it("reaches every combination: 4 partners x 16 guards x 3 shard outcomes x 2 endings", () => {
    expect(leaves).toHaveLength(
      4 * (WEAPON_IDS.length * NINJA_IDS.length) * 3 * 2,
    );
    expect(new Set(leaves.map((l) => l.trail.join("|"))).size).toBe(
      leaves.length,
    );
  });

  it("fires both fixed points and ends the chapter in every branch", () => {
    for (const leaf of leaves) {
      const where = leaf.trail.join(" ");
      for (const id of FIXED_POINT_IDS) {
        expect(leaf.runner.story.fixed_points_fired, where).toContain(id);
      }
      expect(leaf.sawChapterEnd, where).toBe(true);
      expect(leaf.runner.story.scene, where).toBeNull();
    }
  });

  it("fires them even when every fight is lost twice before it is won", () => {
    const retried = playAll({ losses: 2 });
    expect(retried).toHaveLength(leaves.length);
    for (const leaf of retried) {
      for (const id of FIXED_POINT_IDS) {
        expect(leaf.runner.story.fixed_points_fired).toContain(id);
      }
    }
  });

  it("sets what each choice promises", () => {
    for (const leaf of leaves) {
      const s = leaf.runner.story;
      const pick = (id: string): string | undefined =>
        leaf.trail.find((t) => t.startsWith(`${id}=`))?.split("=")[1];
      const where = leaf.trail.join(" ");
      expect(s.ch1_sparring_partner, where).toBe(pick("sparring_partner"));
      expect(s.ch1_weapon_guard?.weapon, where).toBe(pick("guard_weapon"));
      expect(s.ch1_garmadon_choice, where).toBe(pick("chase_or_stay"));
      expect(s.dragon_ignored_you, where).toBe(true);
      const shard = pick("shard_path");
      expect(s.blade_stage, where).toBe(shard === "follow" ? 1 : 0);
      expect(s.wu_knows_blade, where).toBe(pick("tell_wu") === "tell");
      // All four moves are unlocked by the end, in every branch.
      expect(s.unlocks.sort(), where).toEqual([...ECHO_MOVE_IDS].sort());
      if (s.ch1_garmadon_choice === "stay") {
        expect(s.village_standing, where).toBe(3);
      } else {
        expect(s.village_standing, where).toBe(0);
      }
    }
  });

  it("gives the sparring partner +2 trust, cooled by 1 if not the guard", () => {
    for (const leaf of leaves) {
      const s = leaf.runner.story;
      const partner = s.ch1_sparring_partner;
      const guard = s.ch1_weapon_guard?.ninja;
      if (!partner || !guard) throw new Error("choices missing");
      const chased = s.ch1_garmadon_choice === "chase";
      let expected = 2;
      if (partner !== guard) expected -= 1;
      if (chased && partner === guard) expected += 2;
      expect(trustOf(s, partner), leaf.trail.join(" ")).toBe(
        Math.max(0, expected),
      );
    }
  });
});

describe("Chapter 1 costs", () => {
  function from(sceneId: string, story: StoryState): RunnerState {
    return startScene(REGISTRY, createRunner(story), sceneId as never).runner;
  }
  const guarded: StoryState = {
    ...createStoryState(),
    ch1_weapon_guard: { weapon: "sword_of_fire", ninja: "jay" },
    corruption: 15,
  };

  it("stay lowers corruption by 10 and raises village standing", () => {
    let runner = from("ch1_s8", guarded);
    runner = advance(REGISTRY, runner).runner;
    runner = advance(REGISTRY, runner).runner;
    runner = choose(REGISTRY, runner, "stay").runner;
    expect(runner.story.corruption).toBe(5);
    expect(runner.story.village_standing).toBe(3);
    expect(runner.story.trust_jay).toBe(0);
  });

  it("chase gives extra trust to the ninja who fought beside you", () => {
    let runner = from("ch1_s8", guarded);
    runner = advance(REGISTRY, runner).runner;
    runner = advance(REGISTRY, runner).runner;
    runner = choose(REGISTRY, runner, "chase").runner;
    // The trust lands after the first line of the follow-up.
    runner = advance(REGISTRY, runner).runner;
    expect(runner.story.trust_jay).toBe(2);
    expect(runner.story.village_standing).toBe(0);
    expect(runner.story.corruption).toBe(15);
  });

  it("never lowers corruption below zero", () => {
    const s = applyEffect(createStoryState(), {
      kind: "corruption",
      delta: -10,
    });
    expect(s.corruption).toBe(0);
  });

  it("closes on the humming blade only if the shard was taken", () => {
    const closing = (blade: number): string => {
      let runner = from("ch1_s9", {
        ...createStoryState(),
        blade_stage: blade,
      });
      const texts: string[] = [];
      for (let i = 0; i < 12 && runner.wait.kind === "dialogue"; i++) {
        const update = advance(REGISTRY, runner);
        for (const e of update.events)
          if (e.type === "dialogue") texts.push(e.text);
        runner = update.runner;
      }
      return texts.at(-1) ?? "";
    };
    expect(closing(1)).toContain("hums");
    expect(closing(0)).not.toContain("hums");
  });
});

describe("no killing blows against any boss in Chapter 1", () => {
  it("tags every boss the chapter fights as a canon villain", () => {
    const bossTypes = new Set<string>();
    for (const def of CH1.scenes) {
      for (const step of walkSteps(def.steps)) {
        if (step.kind !== "combat" || !isEncounterId(step.encounter)) continue;
        for (const spawn of ENCOUNTERS[step.encounter].boss.spawns) {
          bossTypes.add(spawn.type);
        }
      }
    }
    expect([...bossTypes]).toEqual(["skulkinGeneral"]);
    for (const type of bossTypes) {
      expect(MOBS[type as keyof typeof MOBS].canonVillain).toBe(true);
    }
  });
});

describe("trust perks and allies", () => {
  it("steps perks at trust 3 and 6", () => {
    expect([0, 2, 3, 5, 6, 10].map(perkLevel)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it("gives Kai's flicker and Jay's shorter window only at trust 3", () => {
    const base = createStoryState();
    expect(encounterContext(base, false).twinStrikeFlicker).toBe(false);
    const low = encounterContext(base, false).rewindWindowFrames;
    const trusted = { ...base, trust_kai: 3, trust_jay: 3 };
    const ctx = encounterContext(trusted, false);
    expect(ctx.twinStrikeFlicker).toBe(true);
    expect(ctx.rewindWindowFrames).toBeLessThan(low);
  });

  it("brings the weapon guard's ninja into the boss fight only", () => {
    const story: StoryState = {
      ...createStoryState(),
      unlocks: ["afterstep"],
      ch1_weapon_guard: { weapon: "shurikens_of_ice", ninja: "zane" },
    };
    expect(encounterContext(story, true).allyMobTypes).toEqual(["allyZane"]);
    expect(encounterContext(story, false).allyMobTypes).toEqual([]);
    expect(encounterContext(story, true).echoMoves).toEqual(["afterstep"]);
    expect(allyMobType("kai")).toBe("allyKai");
  });
});
