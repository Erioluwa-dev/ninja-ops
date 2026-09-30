import { type FolderApi, Pane } from "tweakpane";
import type { Tuning } from "../data/tuning";

export interface TuningPanel {
  toggle(): void;
  /** Re-reads bound values after something else edited the tuning. */
  refresh(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Walks the tuning object so a new data field shows up in the panel with no
// panel code; strings and arrays (ids, faction names) are not tunable numbers.
function populate(
  target: Pane | FolderApi,
  obj: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "number") {
      target.addBinding(obj, key, { step: Number.isInteger(value) ? 1 : 0.01 });
    } else if (typeof value === "boolean") {
      target.addBinding(obj, key);
    } else if (isRecord(value)) {
      populate(target.addFolder({ title: key, expanded: false }), value);
    } else if (Array.isArray(value) && value.some(isRecord)) {
      // Modifier lists and wave lists hold records; index them so their params stay tunable.
      const items: unknown[] = value;
      const folder = target.addFolder({ title: key, expanded: false });
      items.forEach((item, i) => {
        if (isRecord(item)) {
          populate(
            folder.addFolder({ title: String(i), expanded: false }),
            item,
          );
        }
      });
    }
  }
}

function addSection(pane: Pane, title: string, value: unknown): void {
  // Bound in place: a copy would leave the sim reading values the panel never edits.
  if (isRecord(value)) {
    populate(pane.addFolder({ title, expanded: false }), value);
  }
}

/** Edits the runtime tuning copy in place; the readonly source data is never touched. */
export function createTuningPanel(tuning: Tuning): TuningPanel {
  const pane = new Pane({ title: "Tuning (F1)" });
  addSection(pane, "combat", tuning.combat);
  addSection(pane, "attacks", tuning.attacks);
  addSection(pane, "mobs", tuning.mobs);
  addSection(pane, "projectiles", tuning.projectiles);
  addSection(pane, "kits", tuning.kits);
  addSection(pane, "elements", tuning.elements);
  addSection(pane, "flow", tuning.flow);
  pane.hidden = true;
  return {
    toggle: () => {
      pane.hidden = !pane.hidden;
    },
    refresh: () => pane.refresh(),
  };
}
