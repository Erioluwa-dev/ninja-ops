import Phaser from "phaser";
import { DEFAULT_STORY, STORY_REGISTRIES } from "../data/story";
import { PhaserInput } from "../input";
import { preloadAssets } from "../render/assets";
import { ChoiceView } from "../render/ChoiceView";
import { DialogueView } from "../render/DialogueView";
import { DEPTH } from "../render/depth";
import { HudLabel, registerHudFont } from "../render/hudLabel";
import {
  browserStore,
  type KeyValueStore,
  loadStory,
  saveStory,
} from "../render/storyStorage";
import { applyEffect } from "../story/effects";
import {
  advance,
  choose,
  createRunner,
  type RunnerState,
  resolveCombat,
  runnerAtBoundary,
  startScene,
  type UiEvent,
  type Update,
} from "../story/runner";
import type { ChapterRegistry } from "../story/schema";
import { createStoryState } from "../story/state";
import { type ArenaLaunch, isStoryResume, type StoryResume } from "./launch";

const WIDTH = 240;
const HEIGHT = 160;
const DEFAULT_BACKDROP = 0x1c2a3a;
// Keys the data uses for `SceneDef.backdrop`; art replaces these flat washes later.
const BACKDROPS: Record<string, number> = {
  test: 0x1c2a3a,
  monastery: 0x4a3a2a,
  village: 0x3a4a2a,
  caves: 0x2a2a3a,
  chamber: 0x1a1a2a,
  site: 0x4a2a2a,
  night: 0x10142a,
};
const NAV_THRESHOLD = 0.5;

type Mode = "idle" | "dialogue" | "choice" | "notice" | "combat" | "done";

/**
 * Plays a chapter registry: shows what the runner emits, passes the player's
 * confirm and choice back, saves at scene boundaries, and hands combat steps to
 * the arena. The story itself stays in `src/story` and `src/data/story`.
 */
export class StoryScene extends Phaser.Scene {
  private registryKey = DEFAULT_STORY;
  private chapters: ChapterRegistry = [];
  private runner: RunnerState = createRunner(createStoryState());
  private resume: StoryResume | null = null;
  private queue: UiEvent[] = [];
  private mode: Mode = "idle";
  private store: KeyValueStore | null = null;
  private controls: PhaserInput | null = null;
  private dialogue: DialogueView | null = null;
  private choices: ChoiceView | null = null;
  private backdrop: Phaser.GameObjects.Rectangle | null = null;
  private titleLabel: HudLabel | null = null;
  private attackWasHeld = false;
  private navWas = 0;

  constructor() {
    super("StoryScene");
  }

  init(data: unknown): void {
    this.resume = isStoryResume(data) ? data : null;
  }

  preload(): void {
    preloadAssets(this);
  }

  create(): void {
    registerHudFont(this);
    this.store = browserStore();
    this.queue = [];
    this.mode = "idle";
    this.controls = new PhaserInput(this);
    this.backdrop = this.add
      .rectangle(0, 0, WIDTH, HEIGHT, DEFAULT_BACKDROP)
      .setOrigin(0, 0)
      .setDepth(DEPTH.floor);
    this.titleLabel = new HudLabel(this, {
      x: 4,
      y: 4,
      depth: DEPTH.hudText,
    });
    this.dialogue = new DialogueView(this);
    this.choices = new ChoiceView(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dialogue?.destroy();
      this.choices?.destroy();
      this.titleLabel?.destroy();
      this.dialogue = null;
      this.choices = null;
      this.titleLabel = null;
    });

    if (this.resume) {
      this.registryKey = this.resume.registry;
      this.chapters = this.registryOrThrow(this.registryKey);
      // The fight's resonance carries on into the story's next scene.
      const { runner, resonance } = this.resume;
      this.runner = {
        ...runner,
        story: applyEffect(runner.story, {
          kind: "resonance",
          delta: resonance - runner.story.resonance,
        }),
      };
      this.apply(
        resolveCombat(this.chapters, this.runner, this.resume.outcome),
      );
    } else {
      this.begin();
    }
    this.proceed();
  }

  update(): void {
    if (!this.controls) return;
    const { actions } = this.controls.poll();
    const confirm = actions.attack && !this.attackWasHeld;
    this.attackWasHeld = actions.attack;
    const nav =
      actions.moveY < -NAV_THRESHOLD
        ? -1
        : actions.moveY > NAV_THRESHOLD
          ? 1
          : 0;
    const navPressed = nav !== 0 && nav !== this.navWas ? nav : 0;
    this.navWas = nav;

    this.dialogue?.update();
    if (this.mode === "dialogue" && confirm && this.dialogue?.confirm()) {
      this.dialogue.hide();
      this.mode = "idle";
      this.apply(advance(this.chapters, this.runner));
      this.proceed();
    } else if (this.mode === "notice" && confirm && this.dialogue?.confirm()) {
      this.dialogue.hide();
      this.mode = "idle";
      this.proceed();
    } else if (this.mode === "choice" && this.choices) {
      if (navPressed === -1 || navPressed === 1) this.choices.move(navPressed);
      const picked = confirm ? this.choices.confirm() : null;
      if (picked !== null) {
        this.choices.hide();
        this.mode = "idle";
        this.apply(choose(this.chapters, this.runner, picked));
        this.proceed();
      }
    }
  }

  private registryOrThrow(key: string): ChapterRegistry {
    const registry = STORY_REGISTRIES[key];
    if (!registry) throw new Error(`Unknown story registry: ${key}`);
    return registry;
  }

  // `?story=<key>` picks the chapter set; `&new` ignores any save.
  private begin(): void {
    const params = new URLSearchParams(window.location.search);
    this.registryKey = params.get("story") || DEFAULT_STORY;
    this.chapters = this.registryOrThrow(this.registryKey);
    const saved =
      !params.has("new") && this.store ? loadStory(this.store) : null;
    if (saved?.ok && saved.state.scene !== null) {
      this.runner = runnerAtBoundary(saved.state);
      this.notice("SAVE LOADED");
      return;
    }
    if (saved && !saved.ok) {
      console.error("Ignoring unreadable story save", saved.error);
      this.notice("SAVE UNREADABLE  NEW GAME");
    }
    const first = this.chapters[0]?.scenes[0];
    if (!first) throw new Error(`Story registry ${this.registryKey} is empty`);
    this.runner = createRunner(createStoryState());
    this.apply(startScene(this.chapters, this.runner, first.id));
  }

  private apply(update: Update): void {
    this.runner = update.runner;
    this.queue.push(...update.events);
  }

  /** Shows queued events until one needs the player, then returns. */
  private proceed(): void {
    for (;;) {
      if (this.mode !== "idle") return;
      const event = this.queue.shift();
      if (!event) {
        if (this.runner.wait.kind === "boundary") {
          this.apply(advance(this.chapters, this.runner));
          continue;
        }
        if (this.runner.wait.kind === "done") this.mode = "done";
        return;
      }
      this.show(event);
    }
  }

  private notice(text: string): void {
    this.dialogue?.show(null, text);
    this.mode = "notice";
  }

  private show(event: UiEvent): void {
    switch (event.type) {
      case "sceneStart":
        this.backdrop?.setFillStyle(
          BACKDROPS[event.backdrop] ?? DEFAULT_BACKDROP,
        );
        this.titleLabel?.setText(event.title.toUpperCase());
        return;
      case "dialogue":
        this.dialogue?.show(event.speaker, event.text);
        this.mode = "dialogue";
        return;
      case "choice":
        this.choices?.show(event.prompt, event.options);
        this.mode = "choice";
        return;
      case "combat":
        this.mode = "combat";
        this.scene.start("ArenaScene", {
          encounter: event.encounter,
          registry: this.registryKey,
          runner: this.runner,
        } satisfies ArenaLaunch);
        return;
      case "unlock":
        this.notice(`LEARNED ${event.label}`);
        return;
      case "sceneEnd": {
        const result = this.store
          ? saveStory(this.store, this.runner.story)
          : null;
        if (result && !result.ok) console.error(result.error);
        this.notice(result?.ok ? "PROGRESS SAVED" : "COULD NOT SAVE");
        return;
      }
      case "chapterEnd":
        this.notice("END OF CHAPTER");
        return;
      case "choiceMade":
      case "fixedPoint":
        return;
    }
  }
}
