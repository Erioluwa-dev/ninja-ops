import { describe, expect, it } from "vitest";
import { DEFAULT_HUB, HUBS, hubFor, validateHubs } from "./hubs";

describe("hubs", () => {
  it("ships valid monastery and city maps", () => {
    expect(validateHubs(HUBS)).toEqual([]);
  });

  it("resolves the default hub for unknown keys", () => {
    expect(hubFor("nope").key).toBe(DEFAULT_HUB);
    expect(() => hubFor("nope")).not.toThrow();
  });

  it("flags ragged rows", () => {
    const base = hubFor("monastery");
    expect(
      validateHubs({ bad: { ...base, key: "bad", rows: ["##", "#"] } }),
    ).toEqual(["bad has ragged rows"]);
  });

  it("flags an unreachable board", () => {
    const sealed = hubFor("monastery");
    const rows = sealed.rows.map((r) => r.split(""));
    const board = sealed.board;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const row = rows[board.row + dr];
      if (row) row[board.col + dc] = "#";
    }
    expect(
      validateHubs({
        sealed: { ...sealed, key: "sealed", rows: rows.map((r) => r.join("")) },
      }),
    ).toContain("sealed/board cannot be reached");
  });
});
