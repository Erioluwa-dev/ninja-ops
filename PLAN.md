# Ninja Ops — Phase 1 Plan (Combat Sandbox)

Revised from the Phase 1 PRD (Claude Docs: "Ninjago GBA RPG: Phase 1 PRD (Combat Sandbox)"). The goal is unchanged: one arena, placeholder rectangles, and combat that is fun before any art, story or overworld exists. This file records what changed from the PRD, the decisions that close its open questions, and the build order.

## What changed from the PRD

| Area | PRD | Plan | Why |
|---|---|---|---|
| Wall collision | Phaser Arcade physics | Custom AABB vs tile grid in `src/sim` | Arcade would move entities from the render side, breaking "renderer never changes combat state" and making positions untestable without a browser. |
| Sweep vs dodge | Sweep exists "so jump has a purpose" | Sweep is designed so dodge cannot beat it (see Design rules) | Otherwise dodge i-frames cover sweeps and jump is dead weight. |
| Perfect timing | Dodge started 6-8 frames before impact | Hit lands within the first N frames of a dodge/block | Impact time can't be predicted; checking it retroactively is exact and testable. |
| Hitstop | 2-4 frames on both fighters | Per-entity freeze counter | Global pause would freeze the whole crowd on every hit. |
| Randomness | Unspecified | Seeded RNG, deterministic `step(state, inputs)` | Enables input recording, exact bug replays and scripted Vitest scenarios. |
| Live tuning | Tweakpane edits data | Tweakpane edits a mutable runtime copy of the typed data | Source data stays `as const satisfies`; tuning never mutates it. |
| Maps | Tiled JSON | Arena defined in code; Tiled deferred to overworld | One arena doesn't justify the tooling yet. |
| Lint/format | Biome or ESLint + Prettier | Biome only | One tool, bun-friendly, has `noExplicitAny` and `noNonNullAssertion`. |
| Button layout | GBA (A, B, L, R) | SNES-style (A, B, X, Y, L, R) | Five actions on four buttons forces shared inputs, which is where input bugs come from. |

## Decisions (closing the PRD's open questions)

- **Deflected projectiles:** straight back along their path. Homing is a later upgrade.
- **Button mapping:** A = attack, B = dodge, X = jump, hold L = block, hold R = spin, Start = pause. Keyboard mirrors it; exact keys are set in the input layer's default binding table.
- **Phase 1 elements:** fire and earth. Fire exercises a *during-spin* hook (spawns a burning trail); earth exercises an *on-spin-end* hook (shockwave). Together they prove element modifiers are generic. Ice (status effect) and lightning (chain targeting) come later.
  - Built in Phase 8: an element is a `src/data/elements.ts` entry of modifier lists merged into the spin at runtime, composed from generic handlers (`spawnHazard`, `radialBurst`). Hazards are ground zones in `state.hazards` hit through the normal pipeline and treated as spin damage by armor. The player's element is `entity.element`, cycled by F5 until random assignment arrives with the story. `applyStatus` (ice) is not built yet.
- **Counter reward:** bonus damage and a stagger, each toggled in data so both can be playtested.
- **Phaser version:** Phaser 4.2.1 (latest stable on npm as of 2026-09-30), pinned exactly.
- **"Your own life" mechanics:** the story branches on your path: train as a ninja, or turn bad and side with the Oni. Phase 1 ships the ninja path only, but two things are built in now because they are cheap today and expensive to retrofit:
  - **Factions, not "player vs enemies".** Every combatant has a `faction` (`ninja`, `oni`, …) and hostility is looked up from a faction table. Attack tokens, targeting and damage never check "is this the player". An Oni-path player fighting ninjas, with Oni mobs as allies, is then a data change.
  - **Path kits as data.** The player's move set (combo, defenses, signature move) comes from a kit definition. Spinjitzu is the ninja kit's signature; the Oni path gets its own signature move later without touching the state machine.

- **Wave loop (Phase 8):** `state.arenaFlow` runs `intro` -> `wave` (data list in `src/data/flow.ts`, breather between) -> `boss` -> `victory`, or `defeat` on the player's death. `createSim` defaults to an inert `sandbox` so scripted tests are unchanged. The scene starts in `intro` (attack starts the run, F6 toggles sandbox); a result panel restarts on attack with a seed derived from the base seed, keeping the live tuning object.
- **Art pass (Phase 9):** [Ninja Adventure](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by pixel-boy is the base pack: CC0, 16×16 like our tile grid, with characters, monsters, bosses, FX, UI and fonts. Other packs come in only if they match its outline weight and palette.
  - **Render-only.** Sprite choice per faction, kit and mob type lives in `src/render`; `src/sim` gains no art fields and its tests are unchanged.
  - **Frames come from sim state, not Phaser animation clocks.** The renderer picks a frame from the entity's state, timer and attack phase, so hitstop freezes the sprite and the active frame lines up with the hitbox.
  - **Readability over decoration.** Telegraph, sweep, unblockable, armor and stagger cues stay as tints, outlines and FX over the sprites, because the pack's few attack frames can't carry them alone.
  - **Rectangles stay** behind a debug toggle for hitbox work.
  - **Only files the game loads are committed**, under `public/assets/ninja-adventure/` with the pack's license. The 89 MB zip stays out of git.
  - Music and SFX stay out of scope for this phase.

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript, strict (no `any`, no `!`) |
| Engine | Phaser 4.2.1 (render + raw input only) |
| Build | Vite |
| Package manager | bun |
| Tests | Vitest |
| Lint/format | Biome |
| Live tuning | Tweakpane, dev builds only |
| Hosting | Static bundle (itch.io or any static host) |

## Architecture

```
raw keys / gamepad ──► src/input ──► named actions ──► src/sim (fixed 60 Hz) ──► state snapshot ──► src/render (Phaser)
                                                          ▲
                                                     src/data (typed, tunable)
```

- `src/sim` — pure TypeScript. No Phaser imports. Owns every position, state, meter and timer. `step(state, actions)` advances exactly one 1/60 s tick.
- `src/data` — move data, timing windows, meters, enemy and element definitions. Every number that shapes feel lives here, checked with `satisfies`.
- `src/input` — maps keyboard and gamepad to named actions (move, attack, dodge, block, jump, spin, pause). Normalizes diagonals. Gameplay never reads raw input.
- `src/render` — reads the snapshot and draws rectangles, hitboxes and the debug overlay. Never writes state.
- `src/scenes` — Phaser scenes that wire the loop: accumulate real time, call `step` in fixed ticks, render the latest snapshot.

## Design rules

- **State priority** (highest first): hurt, spin, jump, dodge, block, attack, move.
- **Each defense has one job:**
  - Dodge — beats normal attacks and unblockables; loses to long sweeps.
  - Block — beats normal attacks and sweeps; drains guard; loses to unblockables.
  - Jump — beats sweeps and ground hazards; loses to projectiles and "hits air" attacks.
  - Spin — beats crowds and projectiles; loses to the tough enemy's punish move.
- **Sweep constraint:** sweep active frames exceed dodge i-frames, or its reach exceeds dodge distance. Encoded as a Vitest check against the data, not left to playtesting.
- **Airborne:** steer only; no attack, block, dodge or spin mid-air; jump can't start from spin or dodge.
- **Spin:** wins over block when both are held; drains meter; dizzy window scales with spin length.

## Build phases

Each phase ends with something playable. Phases 2 and 3 are gates: don't move on until they feel right.

| # | Phase | Scope | Done when |
|---|---|---|---|
| 0 | Foundation | Scaffold, fixed-timestep loop, input layer, debug overlay, seeded RNG, CI script (typecheck + lint + test) | A rectangle moves with keyboard or gamepad and the overlay shows its feet hitbox |
| 1 | Movement and space | Y-depth sorting, sim-side wall collision, z-offset stub, training dummy | Walking behind and in front of the dummy sorts correctly; walls hold |
| 2 ◆ | Attack and hit feel | 3-hit combo, input buffer, per-entity hitstop, knockback, hurt i-frames | Hitting the dummy feels punchy with no art — **gate** |
| 3 ◆ | Defense | Dodge, block, guard meter, guard break, retroactive perfect windows, counter reward | A parry reliably opens a counter you can punish with — **gate** |
| 4 | First mob | Enemy loop (idle, chase, telegraph, attack, recover), attack tokens, spawner, melee + ranged | 5+ mobs are fair and readable; each defense is useful |
| 5 | Spinjitzu | Hold to spin, meter, dizzy, straight-back deflect | Spin is the best answer to crowds and projectiles, not to everything |
| 6 | Jump | z-offset arc, airborne rules, sweep mob | Jump beats sweeps and doesn't trivialize other attacks |
| 7 | Tough enemy | Health bar, spin armor, punish move, unblockable, sweep | The fight forces a mix of dodge, block, jump and careful spin |
| 8 | Elements and polish | Fire and earth, tuning pass, wave loop, result + restart | You replay for fun; a third element is a data entry |
| 9 | Art pass | Ninja Adventure tiles, sprites, FX and font in the renderer; state-driven frames; rectangle debug toggle | Every rectangle has a sprite, fights read as clearly as they did with rectangles, and the toggle brings hitboxes back |

## Testing

- Vitest covers state priority, meter fill/drain, perfect windows, counter window, attack tokens, the sweep constraint, and element hooks.
- Scenario tests drive `step` with scripted action sequences (e.g. "enemy swings, dodge on frame 3, assert perfect + counter open").
- Recorded input files replay a session deterministically for bug reports.
- Typecheck, lint and tests run before every PR.

## Success criteria

- Identical combat timing at 60 Hz and 144 Hz displays.
- Keyboard and gamepad play the full kit; no gameplay code reads raw input.
- Hits feel punchy on the dummy with rectangles only.
- Parry and perfect dodge reliably open a counter.
- 5+ mobs stay fair: attack tokens cap attackers at 2-3.
- Spin clears crowds and reflects projectiles but loses to the punish move.
- Jump beats sweeps, not projectiles or "hits air" attacks.
- The tough enemy forces a mix of all four defenses.
- A third element needs only a data entry.
- Typecheck, lint and tests pass.
- You want to play another round.

## Workflow

- One `feat/<phase-topic>` branch and PR per phase (e.g. `feat/phase-0-foundation`); nothing pushed to main directly.
- The dev server (`bun dev`) is run by you, not by Claude.

## Out of scope for Phase 1

The Oni path (kit, story branch, allied Oni), story, dialogue, quests, overworld, towns, dojo, dungeons, progression, other paths, airborne attacks, more than two elements, character creator, rebinding UI, menus, saves, music, final SFX, multiplayer. (Sprites and animation moved into Phase 9.)

## Story phases 10–12

Story work follows `docs/AGENT_STORY_RULES.md` (loaded via `CLAUDE.md`); content comes from `docs/STORY_BIBLE.md`, scope from `docs/PRD.md`. The sandbox architecture holds: deterministic `src/sim`, typed data in `src/data`, Phaser only renders. Story logic goes in `src/story`, story data in `src/data/story`.

| # | Phase | Scope | Done when |
|---|---|---|---|
| 10 | Echo prototype | Recorder, ghost, resonance, Afterstep, Twin Strike, Decoy Veil, Rewind Step (E-1…E-5, E-7, E-8) | All four moves work in the sandbox; a ghost hit dissolves it and costs a pip |
| 11 | Narrative core | Scene runner, state store, choice UI, save/load, no-kill invariant (N-1, N-2, N-3, N-8, N-9) | A test scene with two choices persists across save and load |
| 12 | Chapter 1 slice | Scenes `ch1_s1`…`ch1_s9`, Skulkin faction, Blade Stage 1, corruption meter | Playable start to finish, both Scene 8 branches, both fixed points fire in every branch |

### Decisions (PRD §10 defaults)

- Q1 Echo; Q3 unnamed Skulkin General; Q4 one pip per perfect dodge and per three landed hits; Q5 trust 0–10 with perks at 3 and 6; Q9 four Ch1 moves (Afterstep, Twin Strike, Decoy Veil, Rewind Step); Q11 placeholder name "Fifth"; Q12 canon locations kept, invented village and collapsing building kept.
- All Echo numbers live in `src/data/echo.ts` and are part of `Tuning`, so the Tweakpane panel edits them.
- A ghost is an `Entity` of kind `ghost` with the owner's faction. It is driven by recorded `ActionFrame`s read from the buffer with a fixed delay, so it reuses `tickEntity`, the hit pipeline and attack data. Ghosts collide with walls only.
- Afterstep's ghost keeps shadowing the player's movement for its lifetime; that trailing path is what Rewind Step snaps back to. Twin Strike's and Decoy Veil's ghosts do not follow.
- A newer ghost replaces the oldest at the limit with no pip loss; only an enemy hit costs a pip.
- Echo moves are gated by `SimState.echo.unlocked` (all four in the sandbox); story unlocks drive it in Phase 12.
