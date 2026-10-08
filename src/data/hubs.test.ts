import { describe, expect, it } from "vitest";
import { composeMap } from "./hubCompose";
import {
  DEFAULT_HUB,
  HUBS,
  hubFor,
  townsfolkFor,
  townsfolkKeepClear,
  validateHubs,
} from "./hubs";
import { pickWanderTarget, seededRng, WANDER_RADIUS } from "./townsfolk";

describe("hubs", () => {
  it("ships valid monastery, world and city maps", () => {
    expect(Object.keys(HUBS).sort()).toEqual(["city", "monastery", "world"]);
    expect(validateHubs(HUBS)).toEqual([]);
  });

  it("lands on the walkable world map", () => {
    expect(DEFAULT_HUB).toBe("world");
  });

  it("resolves the default hub for unknown keys", () => {
    expect(hubFor("nope").key).toBe(DEFAULT_HUB);
    expect(() => hubFor("nope")).not.toThrow();
  });

  it("flags ragged rows", () => {
    const base = hubFor("monastery");
    expect(
      validateHubs({
        bad: {
          ...base,
          key: "bad",
          doors: [],
          layout: { rows: ["##", "#"], stamps: [] },
        },
      }),
    ).toEqual(["bad has ragged rows"]);
  });

  it("flags an unreachable board", () => {
    const sealed = hubFor("monastery");
    const board = sealed.board;
    if (!board) throw new Error("monastery needs a board");
    const rows = sealed.layout.rows.map((r) => r.split(""));
    // Ring the board tile with forest so only the stamp-free ground is cut off.
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const row = rows[board.row + dr];
        if (row) row[board.col + dc] = "#";
      }
    }
    expect(
      validateHubs({
        sealed: {
          ...sealed,
          key: "sealed",
          doors: [],
          layout: { ...sealed.layout, rows: rows.map((r) => r.join("")) },
        },
      }),
    ).toContain("sealed/board cannot be reached");
  });

  it("flags a door whose target spawn is solid", () => {
    const world = hubFor("world");
    const city = hubFor("city");
    const map = composeMap(city.layout.rows, city.layout.stamps);
    const solidIdx = map.solid.indexOf(true);
    const bad = {
      ...world,
      doors: world.doors.map((d) => ({
        ...d,
        to: "city",
        spawn: {
          col: solidIdx % map.cols,
          row: Math.floor(solidIdx / map.cols),
        },
      })),
    };
    expect(validateHubs({ world: bad, city })).toContain(
      "world/door 0 spawn is not floor in city",
    );
  });

  it("round-trips every door", () => {
    for (const hub of Object.values(HUBS)) {
      for (const door of hub.doors) {
        const target = HUBS[door.to];
        expect(target, `${hub.key} -> ${door.to}`).toBeDefined();
        expect(
          target?.doors.some((back) => back.to === hub.key),
          `${door.to} leads back to ${hub.key}`,
        ).toBe(true);
      }
    }
  });

  it("keeps the team and Wu at the monastery only", () => {
    const team = ["wu", "kai", "jay", "zane", "cole"];
    for (const key of ["city", "world"]) {
      const ids = hubFor(key).npcs.map((n) => n.id);
      expect(ids.filter((id) => team.includes(id))).toEqual([]);
    }
  });

  it("places the requested townsfolk on reachable floor", () => {
    expect(townsfolkFor(hubFor("city"))).toHaveLength(8);
    expect(townsfolkFor(hubFor("world"))).toHaveLength(5);
    expect(townsfolkFor(hubFor("monastery"))).toHaveLength(0);
    for (const key of ["city", "world"]) {
      const hub = hubFor(key);
      const clear = townsfolkKeepClear(hub);
      const ids = new Set<string>();
      for (const t of townsfolkFor(hub)) {
        expect(clear(t.col, t.row), t.id).toBe(false);
        expect(ids.has(t.id)).toBe(false);
        ids.add(t.id);
        expect(t.lines.length).toBeGreaterThan(0);
      }
    }
  });

  it("places townsfolk deterministically per seed", () => {
    const city = hubFor("city");
    expect(townsfolkFor(city)).toEqual(townsfolkFor(city));
    const other = townsfolkFor({
      ...city,
      townsfolk: city.townsfolk && { ...city.townsfolk, seed: 99 },
    });
    expect(other).not.toEqual(townsfolkFor(city));
  });

  it("wanders 1-3 tiles, within the radius and only onto free tiles", () => {
    const rng = seededRng(5);
    const home = { col: 10, row: 10 };
    for (let i = 0; i < 200; i++) {
      const t = pickWanderTarget(home, home, rng, () => true);
      if (!t) continue;
      const d = Math.abs(t.col - home.col) + Math.abs(t.row - home.row);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(Math.min(3, WANDER_RADIUS));
    }
    expect(pickWanderTarget(home, home, rng, () => false)).toBeNull();
  });
});
