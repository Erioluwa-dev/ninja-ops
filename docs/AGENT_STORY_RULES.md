# Agent Rules: Ninja Ops Story Mode ("Fifth Student")

You are building the story layer of Ninja Ops, a Phaser 4 + TypeScript GBA-style action RPG set in an alternate-reality Ninjago. These rules apply to every task that touches story, chapters, dialogue, flags, factions, the Echo element or the Hollow Edge blade.

To load these rules automatically, add this line to the repo's `CLAUDE.md`:

```
@docs/AGENT_STORY_RULES.md
```

## 1. Read order and precedence

1. `docs/STORY_BIBLE.md` is the **source of truth for story content**: scenes, choices, flags, names, numbers.
2. `docs/PRD.md` is the source of truth for **scope, requirements, milestones and acceptance criteria**.
3. This file is the source of truth for **how you must work**.
4. The owner's global `CLAUDE.md` still applies for process: bun unless a lockfile says otherwise; strict TypeScript with no `any` and no non-null `!`; typecheck and lint after every change; tests for behaviour changes; report real results; no bot attribution in commits; do not start dev servers or commit/push unless allowed there.

If two documents disagree, stop and ask. Do not pick silently.

Read the Bible and PRD before you write story code. Quote the Bible scene (for example `ch2_s5`) in your commit message or summary when you implement it.

## 2. Hard invariants (never violate)

These hold in every branch, build and test.

1. **No killing blows on canon villains.** The player, the ghost and the blade (including Hollow Verdict) can never reduce a `canon_villain` below 1 HP. Their defeat is a scripted hit by a canon character or the team. Enforce this in code (a damage clamp), not just in scene scripts, and keep a test for it.
2. **Fixed points always fire.** The canon events in PRD §7 happen regardless of choices, deaths-and-retries or skipped optional content.
3. **No Dragons Rising characters.** Do not add Arin, Sora, Wyldfyre, Riyu, Ras, Beatrix, Zeatrix, the Imperium, the Loyalists or anything else that is new in Dragons Rising. Original-series characters (including General Cryptor in Season 3) are allowed when the canon timeline reaches them. This is an alternate reality without them.
4. **Heritage stays hidden.** The player's Oni and Dragon heritage and the blade's origin are never stated in player-facing text in v1. Only the hints in Bible §3 are allowed. Do not add reveals or lore dumps.
5. **No new canon.** Do not invent Ninjago canon facts, names, locations or character history. Where a scene needs one, use the Bible's wording or flag it (§4).
6. **Stay in scope.** v1 is Chapters 1–3. Do not build Chapter 4+ content, Blade Stage 4, the Oni arena as a story finale, or anything in the PRD non-goals.
7. **Player, ghost and blade rules come from the Bible.** The numbers (1.5 s buffer, 0.5 s delay, 4 pips, 50% ghost damage, corruption thresholds 25/50/75/100) must match Bible §1 and §2.1. Keep them in one config module.

## 3. How to build story content

- **Data, not code.** Chapters, scenes, dialogue, choices, conditions, rewards and rumours are data consumed by a scene runner (PRD N-1). Do not hard-code story beats inside Phaser scene classes.
- **One state store.** All flags and meters live in one typed, serialisable store (PRD §6). Use the exact key names in PRD §6. If you need a new key, add it to the registry in the same change.
- **Scene IDs:** `ch{N}_s{M}` as in the Bible (for example `ch1_s6`).
- **Existing systems first.** Echo moves must work with the existing attack tokens, defence matrix and counter windows. Reuse the kit and faction data approach already in the sandbox; do not fork it.
- **Dialogue.** Use the Bible's lines verbatim where they exist (for example Wu's "Your spinjitzu doesn't spin true. It trails."). Where the Bible gives only a beat, write short draft lines and tag them `// DRAFT(writer)` so the owner can review. Never put a draft line in a branch that carries a canon fixed point without the tag.
- **Choices have consequences.** Every choice in the Bible must set the state the PRD names. Do not add choices that have no effect.
- **TypeScript strict.** Narrow `unknown`. Use discriminated unions for flags and choices. No empty `catch`, no swallowed promises.
- **Comments explain why, not what.**

## 4. Canon-check items (do not resolve silently)

The Bible tags open canon questions. When your work depends on one:

1. Use the **default** listed in PRD §10.
2. Keep that data easy to change (for example tribe ids in a table).
3. Mention in your summary which default you used.
4. Do not "fix" the Bible or PRD yourself. Propose the change and ask.

Current open items you are most likely to hit:

- **Serpentine tribes:** default to Hypnobrai, Fangpyre, Venomari and **Constrictai**. The script lists Anacondrai, but in Season 1 Pythor is the last Anacondrai. (Q2)
- **Chapter 1 boss:** an unnamed original "Skulkin General", not Samukai. (Q3)
- **Resonance gain, trust scale, "adds a pip", rescue ambiguity:** use the PRD §10 defaults. (Q4–Q7)
- **Season 2 powers-loss beat:** default yes, a short beat in Chapter 3 before Scene 4. (Q8)
- **Element name Echo:** assume Echo until the owner confirms. (Q1)

If you are running unattended, take the default, state which one, and continue. If the owner is present and the choice affects other work, ask first.

## 5. Working method

1. **Work milestone by milestone** (PRD §8). Do not skip ahead. Phase 10 (Echo in isolation) comes before any story depends on it.
2. **Plan, then build.** For a new system, write a short plan of the data shapes and the tests first. Ask before any design decision that is uncertain and shapes later work.
3. **Stay scoped.** Mention adjacent problems; do not fix them unasked.
4. **Prefer editing existing files** over creating new ones. Check what the repo already uses before adding a dependency.
5. **Verify every change.** Run typecheck, lint and tests. Report the actual results. If something fails, say what failed. Never claim success you have not verified.
6. **Tests that must exist:**
   - A headless branch-coverage test that enumerates choice combinations per chapter and asserts every fixed point fires.
   - The no-kill invariant test.
   - A save/load round-trip test over the full state registry.
   - A determinism test for the input recorder and ghost replay.

## 6. Definition of done for a chapter

A chapter is done only when all of this is true:

- Every scene in the Bible exists with the right choices, triggers and rewards.
- Every flag in PRD §6 for that chapter is set by the scene the registry names.
- Every fixed point fires in every branch (test passes).
- The no-kill invariant holds against every boss in the chapter (test passes).
- Save and load restores the chapter state exactly (test passes).
- Typecheck, lint and tests pass, and any `DRAFT(writer)` lines are listed in your summary.

## 7. Session start checklist

At the start of a session on this project:

1. Read `docs/STORY_BIBLE.md` (the chapter you are touching) and `docs/PRD.md` §§5–8.
2. Find the current milestone (PRD §8) and confirm which requirement IDs your task covers.
3. Check PRD §10 for open items that touch the task.
4. State, in one or two sentences, what you will build before you build it.

## 8. Do not

- Do not reveal the heritage, or write lore that implies it beyond the Bible's hints.
- Do not give the player, ghost or blade a finishing blow on a canon villain, even in a cutscene.
- Do not use official LEGO or Ninjago art, music or text (ripped or traced assets). Fan-made sprites and art of canon characters, drawn or generated to look like them, are allowed.
- Do not add Chapter 4+ content, Dragons Rising content, or features outside the PRD without asking.
- Do not rename flags, scenes or moves without updating the PRD and Bible in the same change.
