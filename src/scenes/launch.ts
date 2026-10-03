import type { CombatOutcome, RunnerState } from "../story/runner";

/** What the story hands the arena: which encounter to play, and the run to resume after it. */
export interface ArenaLaunch {
  encounter: string;
  /** Registry key, so the story scene can rebuild itself on return. */
  registry: string;
  runner: RunnerState;
}

/** What the arena hands back. */
export interface StoryResume {
  registry: string;
  runner: RunnerState;
  outcome: CombatOutcome;
}

export function isArenaLaunch(value: unknown): value is ArenaLaunch {
  return (
    typeof value === "object" &&
    value !== null &&
    "encounter" in value &&
    "runner" in value &&
    "registry" in value
  );
}

export function isStoryResume(value: unknown): value is StoryResume {
  return (
    typeof value === "object" &&
    value !== null &&
    "outcome" in value &&
    "runner" in value &&
    "registry" in value
  );
}
