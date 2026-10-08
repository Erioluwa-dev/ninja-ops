# PRD: Ninja Ops, Story Mode v1 ("Fifth Student", Chapters 1–3)

| | |
|---|---|
| Owner | Erioluwa |
| Status | Draft v0.1 (Oct 3, 2026) |
| Stack | Phaser 4, TypeScript (strict) |
| Narrative source of truth | `docs/STORY_BIBLE.md` |
| Agent working rules | `docs/AGENT_STORY_RULES.md` |

---

## 1. Summary

Ninja Ops is a GBA-style, top-down action RPG set in Ninjago. The combat sandbox (Phase 1) and the Ninja Adventure art pass (Phase 9) are done. This PRD adds the **story layer**: an alternate-reality Ninjago that follows the show's canon from the pilots through Season 2, where the player is an original character, **Wu's fifth student**. The player uses a new element, **Echo**, and carries a cracked blade whose power costs them. Canon events always happen. The player's choices change who fights beside them, who trusts them, and what it costs.

The game is a personal project built for the owner's enjoyment, not a public release.

## 2. Goals and non-goals

**Goals**
1. Make the combat sandbox part of a canon-feeling story: Chapters 1–3, playable start to finish.
2. Deliver the Echo element (ghost replay, resonance pips, 12 moves) as a distinctive extension of the existing combat kit.
3. Make choices matter through five systems: trust tracks, faction standing, a gossip board, a corruption meter and story flags.
4. Keep canon outcomes intact in every branch.
5. Build the content so that adding Chapter 4 and later is mostly data work.

**Non-goals (v1)**
- Chapters 4 and later, and any Dragons Rising content.
- The Oni and Dragon heritage reveal. v1 includes hints only.
- Blade Stage 4 (Awakened).
- Multiplayer, voice acting, monetisation, official LEGO assets.
- A separate Oni path (earlier planning noted V1 is likely ninja-path only).

## 3. Current state (what exists)

- Phase 1 combat sandbox: one arena, three waves of Oni mobs, then the Oni Brute, ending in a victory or defeat screen with restart.
- Player kit: 3-hit combo, dodge, block with a guard meter, jump (evasive only), and Spinjitzu (held spin that drains a meter).
- Threat and defence matrix: dodge beats normal and unblockable attacks; block beats sweeps; jump beats sweeps and ground hazards; spin beats crowds and projectiles but loses to the brute's punish move.
- Perfect dodges and parries open a counter window. Mobs attack in turns using tokens. Fire and earth elements change the spin.
- Fighters belong to factions and the move set comes from a kit, so story-driven changes should be data changes.
- Phase 9: Ninja Adventure art pass shipped.

**Reuse note:** the existing Oni arena becomes the Season 10 finale later. It is not part of v1.

## 4. Player and fantasy

You are not a ninja from the show. You are the fifth student at the monastery, with a trailing spinjitzu Wu can't name. You hold the line, rescue people and carry the cost, while the ninja land their canon finishing blows. The fantasy is being the person the ninja can lean on, and paying for it.

## 5. Requirements

Requirement IDs are for traceability. "Bible §" refers to `docs/STORY_BIBLE.md`.

### 5.1 Echo (combat)

| ID | Requirement |
|---|---|
| E-1 | Record the last 1.5 s of player input in a deterministic, frame-based ring buffer. |
| E-2 | Spawn a ghost that replays input 0.5 s later, drawn as a faint afterimage. Limit: 1 ghost in Ch 1–2, 2 ghosts from Ch 3. |
| E-3 | Ghost deals 50% of the player's damage and cannot land a killing blow on a canon villain. |
| E-4 | Resonance meter of 4 pips. Gain pips on landed hits and perfect dodges. Echo moves spend pips. Gain rates: see open question Q4. |
| E-5 | If an enemy hits the ghost, it dissolves and the player loses 1 pip. |
| E-6 | Implement the 12 moves with the costs and chapter unlocks in Bible §1.1. Unlock timing is by chapter and scene, not by level. |
| E-7 | Echo moves must integrate with the existing systems: attack tokens (Decoy Veil redirects enemy targeting for 3 s), the defence matrix (Hollow Guard reflects projectiles), and the perfect-dodge and parry counter windows (Counter-Echo needs a perfect parry). |
| E-8 | All Echo tuning numbers (1.5 s, 0.5 s, 0.4 s, 1 s, 3 s, 50%, pip costs) live in one config module. |

### 5.2 Hollow Edge and corruption

| ID | Requirement |
|---|---|
| B-1 | Blade has four stages (Bible §2). Stage 1 in Ch 1 (optional find), Stage 2 in Ch 2 (colour from the highest faction standing), Stage 3 in Ch 3 (player choice). Stage 4 is out of scope. |
| B-2 | Stage 2 unlocks Wave Slash (ranged; doubled by Delayed Volley). Stage 3 unlocks Hollow Verdict (charged cut that staggers a boss for a rescue window). |
| B-3 | Corruption meter 0–100. Hollow Verdict and every full-power use raise it. Pushing the blade on the Dark Island adds 30. Hiding Dark Matter in Ch 3 starts it at 15. |
| B-4 | Thresholds: 25 = audible hum and some NPCs avoid you; 50 = enemies target you first; 75 = the ghost occasionally acts on its own; 100 = forced stagger plus a chapter story consequence. |
| B-5 | Lowering sources: rescues, keeping a promise to an ally, resting at the monastery. Chapter 1 Scene 8 "stay" lowers it by 10. |
| B-6 | The blade never delivers a killing blow on a canon villain. |

### 5.3 Narrative systems

| ID | Requirement |
|---|---|
| N-1 | Data-driven scene runner. Chapters are ordered scene lists. Scene IDs use `ch{N}_s{M}`. Dialogue, choices, triggers and rewards are data, not hard-coded in Phaser scenes. |
| N-2 | Typed, serialisable state store for flags and meters (see §6). No `any`. |
| N-3 | Choice UI in the GBA dialogue style, supporting 2–4 options with conditions (visible/enabled by flags, trust or standing). |
| N-4 | Trust tracks for Kai, Jay, Zane and Cole. Sparring partner choice starts one at +2. Each ninja's trust grants a perk (Bible §1.2). Scale and thresholds: Q5. |
| N-5 | Faction standing for four Serpentine tribes (default set: Hypnobrai, Fangpyre, Venomari, Constrictai; Q2). Helping one tribe raises its standing and lowers another's. Standings decide who joins or ambushes at the Devourer, and the blade colour in Stage 2. |
| N-6 | Gossip board: rumours are data with conditions. Two start rumours: "the fifth student can't control their trail" and "Wu is hiding something". Rumours update after missions, and NPCs offer different quests based on what they have heard. |
| N-7 | Fixed-point enforcement: the canon events in §7 must fire in every branch. |
| N-8 | No-kill invariant: enemies tagged `canon_villain` cannot be reduced below 1 HP by the player, ghost or blade. Their defeat comes from scripted hits by canon characters or the team. |
| N-9 | Save and load covering flags, meters, unlocks, trust, standings, rumours, current chapter and scene. |
| N-10 | Hub locations: monastery (rest, forge, corruption reduction) and Ninjago City (Ch 2 onward, gossip board), joined by a small walkable world map (a road from the monastery across the river to the city). The world map holds no story beats or encounters in v1. |

## 6. State registry

Names in `snake_case`. Items marked `*` are proposed names, not in the script.

| Key | Type | Set at | Effect |
|---|---|---|---|
| `dragon_ignored_you` | bool | Ch1 S4 | Heritage hint 1; used by later dialogue |
| `wu_knows_blade` | bool | Ch1 S6 | Ch1 S9 dialogue; Ch3 S9 reaction |
| `ch1_sparring_partner`* | enum kai/cole/zane/jay | Ch1 S2 | Trust +2 for that ninja |
| `ch1_weapon_guard`* | {weapon, ninja} | Ch1 S5 | Pairing becomes ally in next fight |
| `ch1_garmadon_choice`* | enum chase/stay | Ch1 S8 | Chase: no rescue, extra trust from the ninja who sees you. Stay: village standing up, corruption −10 |
| `blade_tribe` | enum (tribe id) | Ch2 S4 | Blade Stage 2 colour |
| `ch2_lloyd_reaction`* | enum back_early/train_alone | Ch2 S5 | Back: ninja trust up. Alone: +1 pip, team trust slowed one level |
| `ch2_elder_answer`* | enum admit/deflect | Ch2 S8 | Whether that tribe passes a rumour in Ch3 |
| `ch3_hid_dark_matter`* | bool | Ch3 S2 | Corruption starts at 15 if true |
| `ch3_companion`* | ninja id | Ch3 S3 | Their perk active for the chapter |
| `ch3_rescue_result`* | which groups saved/lost | Ch3 S5 | Later rumours; Zane's Ch4 willingness |
| `ch3_pushed_blade`* | bool | Ch3 S6 | +30 corruption; unlocks Hollow Verdict |

Meters: `corruption` (0–100), `resonance` (0–4), `ghost_limit` (1 or 2), `trust_kai/jay/zane/cole`, `standing_<tribe>` ×4, `village_standing`, `rumours` (set of ids).

## 7. Fixed points (must occur in every branch)

| Chapter | Fixed points |
|---|---|
| 1 | All Golden Weapons gathered; Garmadon escapes |
| 2 | Lloyd is revealed as the Green Ninja; Garmadon kills the Great Devourer |
| 3 | The Overlord returns; Lloyd becomes the Golden Ninja; the Overlord falls |

## 8. Milestones

Phase numbers continue from the existing log (Phases 1 and 9 are done); adjust to the repo's own numbering.

| Phase | Deliverable | Done when |
|---|---|---|
| 10 | Echo prototype in the sandbox: input recorder, ghost, resonance, Afterstep, Twin Strike, Decoy Veil | All three moves work against the existing arena; ghost-hit dissolve costs a pip |
| 11 | Narrative core: scene runner, state store, choice UI, save/load, no-kill invariant | A test scene with two choices persists across save and load |
| 12 | Chapter 1 vertical slice, plus blade Shard and corruption | Playable start to finish; both Scene 8 branches work; fixed points fire |
| 13 | Chapter 2: hub, tribes, gossip board, Tuning, Devourer boss | Standing changes alter who shows up at the Devourer; blade colour follows standing |
| 14 | Chapter 3: second ghost, Phase Swap, rescue choice, Hollow Verdict, boss and aftermath | Both corruption outcomes at Scene 9 are reachable |
| 15 | Balance, branch-coverage QA, polish | See §9 |

## 9. Acceptance criteria and testing

1. **Fixed-point coverage.** An automated headless playthrough enumerates every combination of choices in a chapter and asserts that each fixed point fires.
2. **No-kill invariant.** A test confirms that no damage source (player, ghost, blade, Hollow Verdict) can reduce a `canon_villain` below 1 HP.
3. **Save/load round-trip** preserves all state in §6.
4. **Determinism.** The input recorder and ghost replay give identical results for identical inputs.
5. **Typecheck, lint and unit tests pass** after every change (per the owner's global working rules).
6. **Content parity.** Every scene in Bible §§4–6 exists, with every flag in §6 set by the scene that the table names.

## 10. Open questions and canon checks

Each item has a default so work can continue. Update the status when decided.

| # | Question | Default until decided | Status |
|---|---|---|---|
| Q1 | Is "Echo" free as an element name? Verify on the Ninjago wiki. | Use Echo | Open |
| Q2 | Season 1 has five Serpentine tribes, and the Anacondrai are not available (Pythor is the last). Script lists Anacondrai as a playable tribe. | Replace with Constrictai; use Pythor as antagonist; keep tribe data swappable | Open |
| Q3 | Ch1 boss is "a large Skulkin general". Canon leader is Samukai. | Unnamed original Skulkin General | Open |
| Q4 | Pip gain rates. | 1 pip per perfect dodge; 1 pip per 3 landed hits | Open |
| Q5 | Trust scale and perk thresholds. | 0–10; perks at 3 and 6; sparring starts at +2 | Open |
| Q6 | "Training alone adds a Resonance pip" (current or max). | +1 current pip at Ch3 start; max stays 4 | Open |
| Q7 | Ch3 Scene 5: "reach two" vs "protects the group you choose". | Reach two of three; Sound Wall shields the first reached; the skipped group is lost | Open |
| Q8 | Season 2 canon: ninja lose their powers until the Temple of Light. Does Ch3 show it? | Yes, a short beat before Scene 4 | Open |
| Q9 | Ch1 says one move per role, but Rewind Step also unlocks in Ch1. | Four Ch1 moves | Open |
| Q10 | Nya's perk "when she joins" (canon Season 5). | Deferred beyond v1 | Open |
| Q11 | Player name, appearance and portrait style. | Placeholder name "Fifth" | Open |
| Q12 | Ch1 locations and sequence vs pilot canon (Caves of Despair, Fire Temple, Underworld finale). | Follow canon locations; keep invented scenes (village defence, collapsing building) | Open |

## 11. Risks

- **Canon accuracy:** the show has fifteen seasons of detail. Mitigation: the Q-list above, and verify against the wiki before building each chapter.
- **Scope creep:** the canon timeline is long. Mitigation: v1 stops at Chapter 3, and the data-driven runner makes later chapters cheap.
- **Echo complexity:** deterministic replay, ghost AI and the token system can conflict. Mitigation: Phase 10 builds Echo in isolation before any story depends on it.
- **Heritage secrecy:** writers or tools may reveal the Oni/Dragon origin early. Mitigation: AGENT_STORY_RULES forbids it before Season 8 content.
- **Writing volume:** three chapters with 27 scenes plus choices. Mitigation: ship Chapter 1 as a vertical slice first.

## 12. Legal note

This is fan work on LEGO's Ninjago property, built for personal use. Do not use official LEGO or Ninjago art, music or text. Keep the project non-commercial. Check licences for any third-party asset packs.
