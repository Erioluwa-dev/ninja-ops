import type Phaser from "phaser";
import { STAGE_SPEAKERS, type StageDef, stageFor } from "../data/stages";
import { createTuning } from "../data/tuning";
import { createEntity } from "../sim/entity";
import type { Arena, Entity } from "../sim/types";
import type { SpeakerId } from "../story/schema";
import { ActorView } from "./ActorView";
import { ArenaView } from "./ArenaView";
import { DEPTH } from "./depth";
import { HudLabel, registerHudFont } from "./hudLabel";

/** Which tiny emote sits over an actor's head. */
export type EmoteKind = "!" | "?" | "..." | null;

const EMOTE_OFFSET_Y = 20;

/** Map speaker ids to kit/mob skins already in actorFrames. */
function skinFor(speaker: SpeakerId): {
  mobType: string | null;
  kitId: string;
} {
  switch (speaker) {
    case "wu":
      return { mobType: "drillDummy", kitId: "drillDummy" };
    case "kai":
      return { mobType: "allyKai", kitId: "allyNinja" };
    case "jay":
      return { mobType: "allyJay", kitId: "allyNinja" };
    case "zane":
      return { mobType: "allyZane", kitId: "allyNinja" };
    case "cole":
      return { mobType: "allyCole", kitId: "allyNinja" };
    case "fifth":
      return { mobType: null, kitId: "ninja" };
    default:
      return { mobType: null, kitId: "ninja" };
  }
}

/**
 * Renders a locked, in-world story stage: tiled floor+walls plus idle actor
 * sprites at their marks. Reuses ArenaView + ActorView so no new art path.
 * The dialogue box stays on top; this view is the "backdrop" behind it.
 */
export class StoryStageView {
  private readonly arenaView: ArenaView;
  private readonly actorView: ActorView;
  private readonly emotes = new Map<SpeakerId, HudLabel>();
  private readonly tuning = createTuning();
  private stage: StageDef | null = null;
  private arena: Arena | null = null;
  private entities: Entity[] = [];
  private tick = 0;
  private emoteKind: EmoteKind = null;
  private emoteSpeaker: SpeakerId | null = null;

  constructor(scene: Phaser.Scene) {
    registerHudFont(scene);
    this.arenaView = new ArenaView(scene);
    this.actorView = new ActorView(scene);
    for (const id of STAGE_SPEAKERS) {
      const label = new HudLabel(scene, {
        x: 0,
        y: 0,
        depth: DEPTH.overheadFx + 10,
        originX: 0.5,
        originY: 1,
        align: "center",
      });
      label.setVisible(false);
      this.emotes.set(id, label);
    }
  }

  /** Build tiles + actors for the backdrop key (monastery, village, ...). */
  showStage(backdrop: string): void {
    this.stage = stageFor(backdrop);
    this.arena = arenaFromStage(this.stage);
    this.entities = entitiesForStage(this.stage, this.tuning);
    this.tick = 0;
    this.emoteKind = null;
    this.emoteSpeaker = null;
    // Force ArenaView to rebuild by swapping arena identity.
    this.arenaView.draw({
      state: fakeState(this.arena),
      ordered: [],
      player: undefined,
    });
    this.placeEmotes();
  }

  /** Highlight which speaker is talking (tint + subtle facing). */
  setSpeaker(speaker: SpeakerId | null): void {
    // Others glance at the speaker when someone talks.
    if (speaker && this.stage) {
      const target = this.stage.marks[speaker];
      if (target) {
        const tx = target.col * 16 + 8;
        const ty = target.row * 16 + 8;
        for (const e of this.entities) {
          const mark = markForEntity(e, this.stage);
          if (!mark || speakerOf(e) === speaker) continue;
          const dx = tx - (mark.col * 16 + 8);
          const dy = ty - (mark.row * 16 + 8);
          if (Math.abs(dx) > Math.abs(dy))
            e.facing = { x: Math.sign(dx), y: 0 };
          else e.facing = { x: 0, y: Math.sign(dy) };
        }
      }
    }
    this.placeEmotes();
  }

  /** Tiny ! ? ... over one actor's head (choice prompt, surprise, etc). */
  setEmote(speaker: SpeakerId | null, kind: EmoteKind): void {
    this.emoteSpeaker = speaker;
    this.emoteKind = kind;
    this.placeEmotes();
  }

  /** Tick idle animation; call from Scene.update(). */
  update(): void {
    this.tick += 1;
    if (!this.arena || this.entities.length === 0) return;
    const ordered = [...this.entities].sort(
      (a, b) => a.pos.y - b.pos.y || a.id - b.id,
    );
    this.actorView.draw({
      state: fakeState(this.arena, this.tick),
      ordered,
      player: this.entities.find((e) => speakerOf(e) === "fifth"),
    });
    this.placeEmotes();
  }

  hide(): void {
    this.stage = null;
    this.arena = null;
    this.entities = [];
    for (const label of this.emotes.values()) label.setVisible(false);
  }

  destroy(): void {
    this.arenaView.destroy();
    this.actorView.destroy();
    for (const label of this.emotes.values()) label.destroy();
    this.emotes.clear();
  }

  private placeEmotes(): void {
    for (const [id, label] of this.emotes) {
      const isEmote = this.emoteSpeaker === id && this.emoteKind !== null;
      if (!isEmote) {
        label.setVisible(false);
        continue;
      }
      const entity = this.entities.find((e) => speakerOf(e) === id);
      if (!entity || this.emoteKind === null) {
        label.setVisible(false);
        continue;
      }
      label.setText(this.emoteKind);
      label.setPosition(entity.pos.x, entity.pos.y - EMOTE_OFFSET_Y);
      label.setVisible(true);
    }
  }
}

function speakerOf(e: Entity): SpeakerId | null {
  // Stashed on the entity via mobType mapping in entitiesForStage.
  const raw = (e as unknown as { _speaker?: SpeakerId })._speaker;
  return raw ?? null;
}

function markForEntity(
  e: Entity,
  stage: StageDef,
): { col: number; row: number } | null {
  const speaker = speakerOf(e);
  if (!speaker) return null;
  const mark = stage.marks[speaker];
  return mark ? { col: mark.col, row: mark.row } : null;
}

function arenaFromStage(stage: StageDef): Arena {
  const cols = stage.rows[0]?.length ?? 15;
  const rows = stage.rows.length;
  const solid: boolean[] = [];
  for (const row of stage.rows) for (const ch of row) solid.push(ch === "#");
  return { cols, rows, tileSize: 16, solid };
}

function entitiesForStage(
  stage: StageDef,
  tuning: ReturnType<typeof createTuning>,
): Entity[] {
  const out: Entity[] = [];
  let nextId = 1;
  // Always include Wu + Fifth + any ninja that has a mark, so the stage feels populated.
  const speakers: SpeakerId[] = STAGE_SPEAKERS.filter(
    (s) => stage.marks[s] !== undefined,
  );
  for (const speaker of speakers) {
    const mark = stage.marks[speaker];
    if (!mark) continue;
    const skin = skinFor(speaker);
    const pos = { x: mark.col * 16 + 8, y: mark.row * 16 + 8 };
    const kind = speaker === "fifth" ? "player" : "mob";
    const entity = createEntity(
      nextId++,
      kind,
      "ninja",
      skin.kitId,
      pos,
      mark.facing,
      tuning,
      skin.mobType,
    );
    // Tag speaker so we can find it later without extra maps.
    (entity as unknown as Record<string, unknown>)._speaker = speaker;
    // Stage actors are idle, never hostile.
    entity.faction = "ninja";
    entity.state = "idle";
    out.push(entity);
  }
  // Ghost echo behind Fifth (purely visual, not a sim ghost).
  const fifthMark = stage.marks.fifth;
  if (fifthMark) {
    const pos = {
      x: fifthMark.col * 16 + 8 + 6,
      y: fifthMark.row * 16 + 8 + 2,
    };
    const ghost = createEntity(
      nextId++,
      "ghost",
      "ninja",
      "echoGhost",
      pos,
      fifthMark.facing,
      tuning,
      null,
    );
    (ghost as unknown as Record<string, unknown>)._speaker =
      "ghost" as unknown as SpeakerId;
    ghost.faction = "ninja";
    ghost.state = "idle";
    out.push(ghost);
  }
  return out;
}

function fakeState(arena: Arena, tick = 0): import("../sim/types").SimState {
  // Minimal SimState that satisfies ActorView + ArenaView. Only tick + arena matter for idle.
  return {
    tick,
    rngState: 0,
    nextId: 999,
    arena,
    entities: [],
    projectiles: [],
    hazards: [],
    arenaFlow: {
      phase: "intro",
      wave: 0,
      wavesCleared: 0,
      phaseTicks: 0,
      runTicks: 0,
      finishers: {},
    },
    tokens: [],
    defeated: false,
    tuning: createTuning(),
    prevInput: {
      moveX: 0,
      moveY: 0,
      attack: false,
      dodge: false,
      block: false,
      jump: false,
      spin: false,
      pause: false,
    },
    echo: {
      buffer: [],
      resonance: 0,
      hitCount: 0,
      unlocked: [],
      ghostLimit: 1,
      twinStrikeFlicker: false,
      pending: [],
      rewindUntil: -1,
      wasDodging: false,
      wasFinisher: false,
      stillFrames: 0,
    },
  } as unknown as import("../sim/types").SimState;
}
