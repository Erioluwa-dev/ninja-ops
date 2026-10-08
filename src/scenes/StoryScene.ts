import Phaser from "phaser";
import {
  blip,
  choiceMoveSfx,
  confirmSfx,
  ensureAudio,
  humSfx,
  sceneWhoosh,
  unlockSfx,
} from "../audio/sfx";
import { DEFAULT_STORY, STORY_REGISTRIES } from "../data/story";
import { PhaserInput } from "../input";
import { preloadAssets } from "../render/assets";
import { ChoiceView } from "../render/ChoiceView";
import { DialogueView } from "../render/DialogueView";
import { HudLabel, registerHudFont } from "../render/hudLabel";
import { buildNinjaTextures } from "../render/ninjaTextures";
import { StoryStageView } from "../render/StoryStageView";
import {
  browserStore,
  type KeyValueStore,
  loadStory,
  saveStory,
} from "../render/storyStorage";
import { TransitionView } from "../render/TransitionView";
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
import { type ChapterRegistry, findScene } from "../story/schema";
import { createStoryState } from "../story/state";
import { type ArenaLaunch, isStoryResume, type StoryResume } from "./launch";

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
  private stageView: StoryStageView | null = null;
  private transition: TransitionView | null = null;
  private titleLabel: HudLabel | null = null;
  private attackWasHeld = false;
  private navWas = 0;
  private lastSpeaker: import("../story/schema").SpeakerId | null = null;
  private blipTick = 0;
  private humTick = 0;

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
    buildNinjaTextures(this);
    registerHudFont(this);
    this.store = browserStore();
    this.queue = [];
    this.mode = "idle";
    this.controls = new PhaserInput(this);
    this.stageView = new StoryStageView(this);
    this.transition = new TransitionView(this);
    this.titleLabel = new HudLabel(this, {
      x: 4,
      y: 4,
      depth: 1010,
    });
    this.dialogue = new DialogueView(this);
    this.choices = new ChoiceView(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dialogue?.destroy();
      this.choices?.destroy();
      this.stageView?.destroy();
      this.transition?.destroy();
      this.titleLabel?.destroy();
      this.dialogue = null;
      this.choices = null;
      this.stageView = null;
      this.transition = null;
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

    this.stageView?.update();
    this.dialogue?.update();
    if (this.dialogue?.isVisible && this.mode === "dialogue") {
      this.blipTick += 1;
      if (this.blipTick % 4 === 0) blip(this.lastSpeaker);
    } else {
      this.blipTick = 0;
    }
    const corruption = this.runner.story.corruption;
    if (corruption >= 25) {
      this.humTick += 1;
      if (this.humTick % 240 === 0) humSfx(corruption);
    } else {
      this.humTick = 0;
    }
    if (this.mode === "dialogue" && confirm && this.dialogue?.confirm()) {
      ensureAudio();
      confirmSfx();
      this.stageView?.setEmote(null, null);
      this.dialogue.hide();
      this.mode = "idle";
      this.apply(advance(this.chapters, this.runner));
      this.proceed();
    } else if (this.mode === "notice" && confirm && this.dialogue?.confirm()) {
      ensureAudio();
      confirmSfx();
      this.dialogue.hide();
      this.mode = "idle";
      this.proceed();
    } else if (this.mode === "choice" && this.choices) {
      if (navPressed === -1 || navPressed === 1) {
        this.choices.move(navPressed);
        choiceMoveSfx();
      }
      const picked = confirm ? this.choices.confirm() : null;
      if (picked !== null) {
        ensureAudio();
        confirmSfx();
        this.stageView?.setEmote(null, null);
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

  private ensureStage(): void {
    const sceneId = this.runner.scene;
    if (!sceneId) return;
    const def = findScene(this.chapters, sceneId);
    if (def) this.stageView?.showStage(def.backdrop);
  }

  private refreshVignette(): void {
    const corruption = this.runner.story.corruption;
    if (corruption >= 25) this.transition?.setVignette(corruption);
    else this.transition?.clearVignette();
  }

  private show(event: UiEvent): void {
    switch (event.type) {
      case "sceneStart":
        this.stageView?.showStage(event.backdrop);
        this.titleLabel?.setText(event.title.toUpperCase());
        this.refreshVignette();
        sceneWhoosh();
        void this.transition?.fadeIn(320);
        return;
      case "dialogue":
        this.ensureStage();
        this.lastSpeaker = event.speaker;
        this.stageView?.setSpeaker(event.speaker);
        this.dialogue?.show(event.speaker, event.text);
        this.mode = "dialogue";
        return;
      case "choice":
        this.ensureStage();
        this.choices?.show(event.prompt, event.options);
        if (this.lastSpeaker) this.stageView?.setEmote(this.lastSpeaker, "?");
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
        unlockSfx();
        this.transition?.flash(0xffffff, 140);
        this.notice(`LEARNED ${event.label}`);
        return;
      case "sceneEnd": {
        const result = this.store
          ? saveStory(this.store, this.runner.story)
          : null;
        if (result && !result.ok) console.error(result.error);
        this.refreshVignette();
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
