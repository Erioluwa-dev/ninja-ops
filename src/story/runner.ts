import { holds } from "./conditions";
import { applyEffect, applyEffects } from "./effects";
import {
  type ChapterRegistry,
  type ChoiceStep,
  findScene,
  type SceneDef,
  type SceneId,
  type SpeakerId,
  type Step,
} from "./schema";
import type { FixedPointId, StoryState } from "./state";

/** What the UI is waiting on. The runner never advances past a blocking step by itself. */
export type Wait =
  | { kind: "idle" }
  | { kind: "dialogue" }
  | { kind: "choice"; step: ChoiceStep }
  | { kind: "combat"; encounter: string }
  /** The scene is over; `advance` starts the next one, which is where a save belongs. */
  | { kind: "boundary" }
  | { kind: "done" };

interface Frame {
  steps: readonly Step[];
  index: number;
}

export interface RunnerState {
  story: StoryState;
  scene: SceneId | null;
  stack: readonly Frame[];
  wait: Wait;
}

export type UiEvent =
  | { type: "sceneStart"; scene: SceneId; title: string; backdrop: string }
  | { type: "dialogue"; speaker: SpeakerId | null; text: string }
  | {
      type: "choice";
      id: string;
      prompt: string;
      options: { id: string; label: string; enabled: boolean }[];
    }
  | { type: "choiceMade"; choice: string; option: string }
  | { type: "combat"; encounter: string }
  | { type: "unlock"; id: string; label: string }
  | { type: "fixedPoint"; id: FixedPointId }
  | { type: "sceneEnd"; scene: SceneId; next: SceneId | null }
  | { type: "chapterEnd"; chapter: number };

export interface Update {
  runner: RunnerState;
  events: UiEvent[];
}

export type CombatOutcome = "won" | "lost";

export function createRunner(story: StoryState): RunnerState {
  return { story, scene: null, stack: [], wait: { kind: "idle" } };
}

function sceneOrThrow(registry: ChapterRegistry, id: string): SceneDef {
  const scene = findScene(registry, id);
  if (!scene) throw new Error(`Unknown scene: ${id}`);
  return scene;
}

function visibleOptions(story: StoryState, step: ChoiceStep) {
  return step.options.filter((o) => !o.show || holds(story, o.show));
}

/** Runs every non-blocking step until one needs the UI, or the scene ends. */
function pump(
  registry: ChapterRegistry,
  from: RunnerState,
  events: UiEvent[],
): RunnerState {
  let story = from.story;
  const stack = from.stack.map((f) => ({ ...f }));
  const scene = from.scene;
  if (scene === null) throw new Error("No scene is running");

  for (;;) {
    const frame = stack.at(-1);
    if (!frame) {
      const def = sceneOrThrow(registry, scene);
      events.push({ type: "sceneEnd", scene, next: def.next });
      // The save point: resuming from here starts the next scene.
      story = { ...story, scene: def.next };
      return { story, scene, stack: [], wait: { kind: "boundary" } };
    }
    const step = frame.steps[frame.index];
    if (!step) {
      stack.pop();
      continue;
    }
    frame.index += 1;

    switch (step.kind) {
      case "dialogue":
        events.push({
          type: "dialogue",
          speaker: step.speaker,
          text: step.text,
        });
        return { story, scene, stack, wait: { kind: "dialogue" } };
      case "choice":
        events.push({
          type: "choice",
          id: step.id,
          prompt: step.prompt,
          options: visibleOptions(story, step).map((o) => ({
            id: o.id,
            label: o.label,
            enabled: !o.enabled || holds(story, o.enabled),
          })),
        });
        return { story, scene, stack, wait: { kind: "choice", step } };
      case "combat":
        events.push({ type: "combat", encounter: step.encounter });
        return {
          story,
          scene,
          stack,
          wait: { kind: "combat", encounter: step.encounter },
        };
      case "effect":
        story = applyEffects(story, step.effects);
        break;
      case "unlock":
        story = applyEffect(story, { kind: "unlock", id: step.id });
        events.push({ type: "unlock", id: step.id, label: step.label });
        break;
      case "fixedPoint":
        story = applyEffect(story, { kind: "fixedPoint", id: step.id });
        events.push({ type: "fixedPoint", id: step.id });
        break;
      case "branch": {
        const taken = step.cases.find((c) => holds(story, c.when));
        const steps = taken ? taken.steps : (step.otherwise ?? []);
        stack.push({ steps, index: 0 });
        break;
      }
    }
  }
}

export function startScene(
  registry: ChapterRegistry,
  runner: RunnerState,
  sceneId: SceneId,
): Update {
  const def = sceneOrThrow(registry, sceneId);
  const chapter = Number(sceneId.slice(2, sceneId.indexOf("_")));
  const events: UiEvent[] = [
    {
      type: "sceneStart",
      scene: def.id,
      title: def.title,
      backdrop: def.backdrop,
    },
  ];
  const started: RunnerState = {
    story: { ...runner.story, chapter, scene: def.id },
    scene: def.id,
    stack: [{ steps: def.steps, index: 0 }],
    wait: { kind: "idle" },
  };
  return { runner: pump(registry, started, events), events };
}

/** Moves past a dialogue line, or starts the next scene from a boundary. */
export function advance(
  registry: ChapterRegistry,
  runner: RunnerState,
): Update {
  const { wait } = runner;
  if (wait.kind === "dialogue") {
    const events: UiEvent[] = [];
    return { runner: pump(registry, runner, events), events };
  }
  if (wait.kind === "boundary") {
    const next = runner.story.scene;
    if (next !== null && runner.scene !== null) {
      // The story state already names the next scene, so a loaded save and a
      // live run take exactly the same path from here.
      return startScene(registry, runner, next);
    }
    const chapter = runner.story.chapter;
    return {
      runner: { ...runner, stack: [], wait: { kind: "done" } },
      events: [{ type: "chapterEnd", chapter }],
    };
  }
  throw new Error(`Cannot advance while waiting on ${wait.kind}`);
}

export function choose(
  registry: ChapterRegistry,
  runner: RunnerState,
  optionId: string,
): Update {
  const { wait } = runner;
  if (wait.kind !== "choice") {
    throw new Error(`Cannot choose while waiting on ${wait.kind}`);
  }
  const option = visibleOptions(runner.story, wait.step).find(
    (o) => o.id === optionId,
  );
  if (!option) throw new Error(`Option ${optionId} is not available`);
  if (option.enabled && !holds(runner.story, option.enabled)) {
    throw new Error(`Option ${optionId} is disabled`);
  }
  const events: UiEvent[] = [
    { type: "choiceMade", choice: wait.step.id, option: option.id },
  ];
  const stack = [...runner.stack];
  if (option.followUp?.length) stack.push({ steps: option.followUp, index: 0 });
  const next: RunnerState = {
    ...runner,
    story: applyEffects(runner.story, option.effects),
    stack,
    wait: { kind: "idle" },
  };
  return { runner: pump(registry, next, events), events };
}

/** A loss replays the encounter, so a defeat never skips what follows it. */
export function resolveCombat(
  registry: ChapterRegistry,
  runner: RunnerState,
  outcome: CombatOutcome,
): Update {
  const { wait } = runner;
  if (wait.kind !== "combat") {
    throw new Error(`No combat is pending (waiting on ${wait.kind})`);
  }
  if (outcome === "lost") {
    return {
      runner,
      events: [{ type: "combat", encounter: wait.encounter }],
    };
  }
  const events: UiEvent[] = [];
  return {
    runner: pump(registry, { ...runner, wait: { kind: "idle" } }, events),
    events,
  };
}

/** Runner positioned at a saved scene boundary, ready for `advance`. */
export function runnerAtBoundary(story: StoryState): RunnerState {
  return {
    story,
    scene: story.scene,
    stack: [],
    wait: story.scene === null ? { kind: "done" } : { kind: "boundary" },
  };
}
