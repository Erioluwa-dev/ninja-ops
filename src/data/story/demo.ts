import type { Chapter } from "../../story/schema";

/**
 * A throwaway chapter for the Phase 11 check: two choices in the first scene, a
 * branch on the first, a combat, and a second scene so a save lands on a
 * boundary. Play it with `?story=demo`.
 */
export const DEMO_CHAPTER: Chapter = {
  id: 1,
  title: "Test",
  scenes: [
    {
      id: "ch1_s1",
      title: "Pick",
      backdrop: "test",
      next: "ch1_s2",
      steps: [
        { kind: "dialogue", speaker: "wu", text: "Choose." },
        {
          kind: "choice",
          id: "partner",
          prompt: "Who?",
          options: [
            {
              id: "kai",
              label: "Kai",
              effects: [
                { kind: "setSparringPartner", ninja: "kai" },
                { kind: "trust", ninja: "kai", delta: 2 },
              ],
            },
            {
              id: "cole",
              label: "Cole",
              effects: [
                { kind: "setSparringPartner", ninja: "cole" },
                { kind: "trust", ninja: "cole", delta: 2 },
              ],
            },
            {
              id: "locked",
              label: "Locked",
              enabled: { kind: "trust", ninja: "zane", min: 5 },
              effects: [{ kind: "trust", ninja: "zane", delta: 1 }],
            },
            {
              id: "hidden",
              label: "Hidden",
              show: { kind: "flag", key: "wu_knows_blade", value: true },
              effects: [{ kind: "trust", ninja: "jay", delta: 1 }],
            },
          ],
        },
        {
          kind: "branch",
          cases: [
            {
              when: { kind: "sparringPartner", ninja: "kai" },
              steps: [{ kind: "dialogue", speaker: "kai", text: "Fast." }],
            },
          ],
          otherwise: [{ kind: "dialogue", speaker: "cole", text: "Steady." }],
        },
        {
          kind: "choice",
          id: "blade",
          prompt: "Tell Wu?",
          options: [
            {
              id: "tell",
              label: "Tell",
              effects: [
                { kind: "setFlag", key: "wu_knows_blade", value: true },
              ],
              followUp: [{ kind: "dialogue", speaker: "wu", text: "Show me." }],
            },
            {
              id: "keep",
              label: "Keep",
              effects: [
                { kind: "setFlag", key: "wu_knows_blade", value: false },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "ch1_s2",
      title: "Fight",
      backdrop: "test",
      next: null,
      steps: [
        { kind: "combat", encounter: "test" },
        { kind: "unlock", id: "afterstep", label: "Afterstep" },
        { kind: "fixedPoint", id: "ch1_weapons_gathered" },
      ],
    },
  ],
};
