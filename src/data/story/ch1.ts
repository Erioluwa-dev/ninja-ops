import type { Condition } from "../../story/conditions";
import type { Effect } from "../../story/effects";
import type {
  Chapter,
  ChoiceOption,
  DialogueStep,
  SpeakerId,
  Step,
} from "../../story/schema";
import {
  NINJA_IDS,
  type NinjaId,
  WEAPON_IDS,
  type WeaponId,
} from "../../story/state";

/**
 * Chapter 1, "The Fifth Student" (Bible §4). Every dialogue line is tagged:
 * `// BIBLE` for words taken verbatim from the Bible, `// DRAFT(writer)` for
 * placeholder lines the owner should rewrite. A test enforces the tags.
 *
 * Canon defaults used (PRD §10): Q3 an unnamed Skulkin General, Q9 four moves
 * in this chapter, Q11 the player is "Fifth", Q12 canon locations kept.
 */

const d = (speaker: SpeakerId | null, text: string): DialogueStep => ({
  kind: "dialogue",
  speaker,
  text,
});

const NINJA_LABEL: Record<NinjaId, string> = {
  kai: "KAI",
  jay: "JAY",
  zane: "ZANE",
  cole: "COLE",
};

const WEAPON_LABEL: Record<WeaponId, string> = {
  scythe_of_quakes: "SCYTHE OF QUAKES",
  sword_of_fire: "SWORD OF FIRE",
  nunchucks_of_lightning: "NUNCHUCKS OF LIGHTNING",
  shurikens_of_ice: "SHURIKENS OF ICE",
};

/** One step per ninja, chosen by the weapon guard: how the ally in `ch1_s7` is addressed. */
function perGuard(lines: Record<NinjaId, Step[]>): Step {
  return {
    kind: "branch",
    cases: NINJA_IDS.map((ninja) => ({
      when: { kind: "weaponGuard", ninja } satisfies Condition,
      steps: lines[ninja],
    })),
  };
}

// --- ch1_s2: the sparring partner. Each choice starts that ninja's trust at +2.
function partner(ninja: NinjaId, followUp: readonly Step[]): ChoiceOption {
  return {
    id: ninja,
    label: NINJA_LABEL[ninja],
    effects: [
      { kind: "setSparringPartner", ninja },
      { kind: "trust", ninja, delta: 2 },
    ],
    followUp,
  };
}

// --- ch1_s5: the weapon guard. A weapon, then a ninja; the pair becomes the ally in ch1_s7.
function guardOptions(weapon: WeaponId): ChoiceOption {
  const pick = (ninja: NinjaId): ChoiceOption => {
    const cooler: Effect[] = NINJA_IDS.filter((n) => n !== ninja).map(
      (other) => ({ kind: "trust", ninja: other, delta: -1 }),
    );
    return {
      id: ninja,
      label: NINJA_LABEL[ninja],
      // Bible: whoever you did not pick finds the other trust track cooler for now.
      effects: [{ kind: "setWeaponGuard", weapon, ninja }, ...cooler],
    };
  };
  return {
    id: weapon,
    label: WEAPON_LABEL[weapon],
    effects: [],
    followUp: [
      {
        kind: "choice",
        id: `guard_ninja_${weapon}`,
        prompt: `WHO GUARDS THE ${WEAPON_LABEL[weapon]}?`,
        options: NINJA_IDS.map(pick),
      },
    ],
  };
}

export const CH1: Chapter = {
  id: 1,
  title: "The Fifth Student",
  scenes: [
    {
      id: "ch1_s1",
      title: "The Monastery, Dawn",
      backdrop: "monastery",
      next: "ch1_s2",
      steps: [
        // DRAFT(writer)
        d(null, "Dawn at the monastery. Wu drills his four students and you."),
        // DRAFT(writer)
        d("wu", "Move. Strike. Guard. Again."),
        { kind: "combat", encounter: "ch1_tutorial" },
        // BIBLE
        d("wu", "Your spinjitzu doesn't spin true. It trails."),
        // DRAFT(writer)
        d(
          null,
          "Where you spun, a faint copy of you lingers, a moment behind.",
        ),
        { kind: "unlock", id: "afterstep", label: "AFTERSTEP" },
        { kind: "unlock", id: "twinStrike", label: "TWIN STRIKE" },
      ],
    },
    {
      id: "ch1_s2",
      title: "Sparring Partner",
      backdrop: "monastery",
      next: "ch1_s3",
      steps: [
        // DRAFT(writer)
        d("wu", "Choose a partner for today's sparring."),
        {
          kind: "choice",
          id: "sparring_partner",
          prompt: "SPARRING PARTNER?",
          options: [
            partner("kai", [
              // DRAFT(writer)
              d("kai", "Keep up, Fifth! No slowing down!"),
            ]),
            partner("cole", [
              // DRAFT(writer)
              d("cole", "Steady feet. Let them come to you."),
            ]),
            partner("zane", [
              // DRAFT(writer)
              d("zane", "Your guard opens on the left. Again."),
            ]),
            partner("jay", [
              // DRAFT(writer)
              d("jay", "Ha! Your spin leaves a trail. You're a snail!"),
              // DRAFT(writer)
              d("fifth", "It's not funny."),
              // DRAFT(writer)
              d("jay", "A little funny."),
            ]),
          ],
        },
      ],
    },
    {
      id: "ch1_s3",
      title: "The Skulkin Threat",
      backdrop: "village",
      next: "ch1_s4",
      steps: [
        // DRAFT(writer)
        d(null, "News reaches the monastery: Skulkin are on the weapon route."),
        // DRAFT(writer)
        d("wu", "Secure the Golden Weapons before they do. Go."),
        // DRAFT(writer)
        d(null, "A village lies in their path."),
        { kind: "combat", encounter: "ch1_village" },
        { kind: "unlock", id: "decoyVeil", label: "DECOY VEIL" },
        // DRAFT(writer)
        d("fifth", "Stand still, and they look at the ghost instead."),
      ],
    },
    {
      id: "ch1_s4",
      title: "The Caves of Despair",
      backdrop: "caves",
      next: "ch1_s5",
      steps: [
        // DRAFT(writer)
        d(null, "The trapped caves hide the first weapon."),
        { kind: "combat", encounter: "ch1_dungeon" },
        { kind: "unlock", id: "rewindStep", label: "REWIND STEP" },
        // DRAFT(writer)
        d(null, "A stone guardian dragon rises from the dark."),
        // DRAFT(writer)
        d(null, "It looks at the others. It does not attack you."),
        {
          kind: "effect",
          effects: [
            { kind: "setFlag", key: "dragon_ignored_you", value: true },
          ],
        },
        // DRAFT(writer)
        d("kai", "Did you see that? It just let you walk past."),
        // DRAFT(writer)
        d("fifth", "I don't know why."),
      ],
    },
    {
      id: "ch1_s5",
      title: "Weapon Guard",
      backdrop: "monastery",
      next: "ch1_s6",
      steps: [
        // DRAFT(writer)
        d("wu", "The weapons need guarding. Who watches which?"),
        {
          kind: "choice",
          id: "guard_weapon",
          prompt: "WHICH WEAPON?",
          options: WEAPON_IDS.map(guardOptions),
        },
        // DRAFT(writer)
        d("wu", "Then it is settled. You two will stand together."),
      ],
    },
    {
      id: "ch1_s6",
      title: "The Shard",
      backdrop: "chamber",
      next: "ch1_s7",
      steps: [
        // DRAFT(writer)
        d(null, "Off the route, a narrow path leads somewhere hidden."),
        {
          kind: "choice",
          id: "shard_path",
          prompt: "THE HIDDEN PATH?",
          options: [
            {
              id: "follow",
              label: "FOLLOW IT",
              effects: [{ kind: "bladeStage", stage: 1 }],
              followUp: [
                // DRAFT(writer)
                d(
                  null,
                  "In a hidden chamber, half a broken blade. It hums when you stand close.",
                ),
                // DRAFT(writer)
                d(null, "You take it."),
                {
                  kind: "choice",
                  id: "tell_wu",
                  prompt: "TELL WU?",
                  options: [
                    {
                      id: "tell",
                      label: "TELL WU NOW",
                      effects: [
                        { kind: "setFlag", key: "wu_knows_blade", value: true },
                      ],
                      followUp: [
                        // DRAFT(writer)
                        d("wu", "Keep it close. Tell no one else."),
                      ],
                    },
                    {
                      id: "keep",
                      label: "KEEP IT QUIET",
                      effects: [
                        {
                          kind: "setFlag",
                          key: "wu_knows_blade",
                          value: false,
                        },
                      ],
                      followUp: [
                        // DRAFT(writer)
                        d(null, "The shard goes into your pack. No one sees."),
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: "skip",
              label: "STAY ON THE ROUTE",
              // The optional path is optional: skipping leaves the blade unfound.
              effects: [],
              followUp: [
                // DRAFT(writer)
                d(null, "You keep to the route. The path stays behind you."),
              ],
            },
          ],
        },
      ],
    },
    {
      id: "ch1_s7",
      title: "The Skulkin General",
      backdrop: "site",
      next: "ch1_s8",
      steps: [
        // DRAFT(writer)
        d(
          null,
          "At the last weapon site, a large Skulkin general blocks the way.",
        ),
        // DRAFT(writer)
        d("wu", "Hold his attention. The team will do the rest."),
        { kind: "combat", encounter: "ch1_boss" },
        perGuard({
          kai: [
            // DRAFT(writer)
            d("kai", "Nice work holding him! Now THAT'S teamwork."),
          ],
          jay: [
            // DRAFT(writer)
            d("jay", "Did you see my finishing move? You're welcome."),
          ],
          zane: [
            // DRAFT(writer)
            d("zane", "Your ghost drew his guard. It was effective."),
          ],
          cole: [
            // DRAFT(writer)
            d("cole", "Good. You held the line."),
          ],
        }),
      ],
    },
    {
      id: "ch1_s8",
      title: "Garmadon Escapes",
      backdrop: "village",
      next: "ch1_s9",
      steps: [
        // DRAFT(writer)
        d(null, "In the confusion, Garmadon slips away."),
        // DRAFT(writer)
        d(null, "You are closest. Behind you, a building begins to collapse."),
        {
          kind: "choice",
          id: "chase_or_stay",
          prompt: "WHAT DO YOU DO?",
          options: [
            {
              id: "chase",
              label: "CHASE GARMADON",
              effects: [{ kind: "setGarmadonChoice", choice: "chase" }],
              followUp: [
                // DRAFT(writer)
                d(null, "You run after him. The building falls behind you."),
                // The ninja who fought beside you is the one who sees you leave.
                {
                  kind: "branch",
                  cases: NINJA_IDS.map((ninja) => ({
                    when: { kind: "weaponGuard", ninja } satisfies Condition,
                    steps: [
                      {
                        kind: "effect",
                        effects: [{ kind: "trust", ninja, delta: 2 }],
                      },
                    ],
                  })),
                },
                // DRAFT(writer)
                d("fifth", "He's gone."),
              ],
            },
            {
              id: "stay",
              label: "PULL VILLAGERS OUT",
              effects: [
                { kind: "setGarmadonChoice", choice: "stay" },
                { kind: "villageStanding", delta: 3 },
                { kind: "corruption", delta: -10 },
              ],
              followUp: [
                // DRAFT(writer)
                d(null, "You pull the villagers clear as the roof comes down."),
                // DRAFT(writer)
                d(null, "By the time you look up, Garmadon is long gone."),
              ],
            },
          ],
        },
        { kind: "fixedPoint", id: "ch1_garmadon_escapes" },
      ],
    },
    {
      id: "ch1_s9",
      title: "Wu at Night",
      backdrop: "night",
      next: null,
      steps: [
        // DRAFT(writer)
        d(
          null,
          "With the Golden Weapons gathered, you train alone after dark.",
        ),
        { kind: "fixedPoint", id: "ch1_weapons_gathered" },
        // DRAFT(writer)
        d("wu", "Your trail has a name. I do not know it."),
        {
          kind: "branch",
          cases: [
            {
              when: { kind: "flag", key: "wu_knows_blade", value: true },
              steps: [
                // DRAFT(writer)
                d("wu", "Show me the blade."),
                // DRAFT(writer)
                d(null, "He looks for a long time, and says nothing more."),
              ],
            },
          ],
        },
        {
          kind: "branch",
          cases: [
            {
              when: { kind: "bladeStage", min: 1 },
              steps: [
                // DRAFT(writer)
                d(null, "In your pack, the blade hums faintly."),
              ],
            },
          ],
          otherwise: [
            // DRAFT(writer)
            d(null, "The monastery is quiet. Something is still missing."),
          ],
        },
      ],
    },
  ],
};
