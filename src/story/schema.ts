import type { Condition } from "./conditions";
import type { Effect } from "./effects";
import type { FixedPointId, SceneId } from "./state";
import { isSceneId } from "./state";

export { isSceneId, type SceneId };

/** Who speaks a line; `null` is narration. */
export type SpeakerId = "wu" | "kai" | "jay" | "zane" | "cole" | "fifth";

export interface DialogueStep {
  kind: "dialogue";
  speaker: SpeakerId | null;
  text: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  /** Hidden unless it holds; absent means always shown. */
  show?: Condition;
  /** Listed but greyed out unless it holds; absent means always enabled. */
  enabled?: Condition;
  effects: readonly Effect[];
  /** Played right after the effects, before the scene carries on. */
  followUp?: readonly Step[];
}

export interface ChoiceStep {
  kind: "choice";
  /** Unique within the scene. */
  id: string;
  prompt: string;
  /** 2 to 4 options (PRD N-3). */
  options: readonly ChoiceOption[];
}

export interface CombatStep {
  kind: "combat";
  /** Key into the encounter table in src/data/encounters.ts. */
  encounter: string;
}

export interface UnlockStep {
  kind: "unlock";
  /** An Echo move id; the effect is applied for you. */
  id: string;
  /** Shown to the player when it is granted. */
  label: string;
}

export interface EffectStep {
  kind: "effect";
  effects: readonly Effect[];
}

export interface FixedPointStep {
  kind: "fixedPoint";
  id: FixedPointId;
}

export interface BranchCase {
  when: Condition;
  steps: readonly Step[];
}

export interface BranchStep {
  kind: "branch";
  /** The first case that holds runs; `otherwise` runs when none does. */
  cases: readonly BranchCase[];
  otherwise?: readonly Step[];
}

export type Step =
  | DialogueStep
  | ChoiceStep
  | CombatStep
  | UnlockStep
  | EffectStep
  | FixedPointStep
  | BranchStep;

export interface SceneDef {
  id: SceneId;
  title: string;
  /** Key the render layer maps to a backdrop. */
  backdrop: string;
  steps: readonly Step[];
  /** The scene that follows; null ends the chapter. */
  next: SceneId | null;
}

export interface Chapter {
  id: number;
  title: string;
  scenes: readonly SceneDef[];
}

export type ChapterRegistry = readonly Chapter[];

export function findScene(
  registry: ChapterRegistry,
  id: string,
): SceneDef | undefined {
  for (const chapter of registry) {
    const scene = chapter.scenes.find((s) => s.id === id);
    if (scene) return scene;
  }
  return undefined;
}

/** Every step of a list, including those nested in branches and choice follow-ups. */
export function* walkSteps(steps: readonly Step[]): Generator<Step> {
  for (const step of steps) {
    yield step;
    if (step.kind === "branch") {
      for (const c of step.cases) yield* walkSteps(c.steps);
      if (step.otherwise) yield* walkSteps(step.otherwise);
    } else if (step.kind === "choice") {
      for (const option of step.options) {
        if (option.followUp) yield* walkSteps(option.followUp);
      }
    }
  }
}

/** Structural problems with a registry; empty when it is sound. */
export function validateRegistry(registry: ChapterRegistry): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const chapter of registry) {
    for (const scene of chapter.scenes) {
      if (!isSceneId(scene.id)) problems.push(`bad scene id ${scene.id}`);
      if (ids.has(scene.id)) problems.push(`duplicate scene ${scene.id}`);
      ids.add(scene.id);
      if (!scene.id.startsWith(`ch${chapter.id}_`)) {
        problems.push(`${scene.id} is not in chapter ${chapter.id}`);
      }
    }
  }
  for (const chapter of registry) {
    for (const scene of chapter.scenes) {
      if (scene.next !== null && !ids.has(scene.next)) {
        problems.push(`${scene.id} -> unknown scene ${scene.next}`);
      }
      const choiceIds = new Set<string>();
      for (const step of walkSteps(scene.steps)) {
        if (step.kind !== "choice") continue;
        const where = `${scene.id}/${step.id}`;
        if (choiceIds.has(step.id)) problems.push(`duplicate choice ${where}`);
        choiceIds.add(step.id);
        if (step.options.length < 2 || step.options.length > 4) {
          problems.push(`${where} has ${step.options.length} options`);
        }
        const optionIds = new Set(step.options.map((o) => o.id));
        if (optionIds.size !== step.options.length) {
          problems.push(`${where} repeats an option id`);
        }
        // An option that changes nothing is a choice without a consequence.
        for (const o of step.options) {
          if (o.effects.length === 0 && !o.followUp?.length) {
            problems.push(`${where}/${o.id} has no effect`);
          }
        }
      }
    }
  }
  return problems;
}
