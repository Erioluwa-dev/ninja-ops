import { composeMap } from "./hubCompose";
import { CITY_MAP, type MapLayout, MONASTERY_MAP, WORLD_MAP } from "./hubMaps";

/** Walkable hub maps; collision comes from the composed layout. */

export type NpcSkin = "wu" | "kai" | "jay" | "zane" | "cole";

export interface HubNpcDef {
  id: string;
  name: string;
  skin: NpcSkin;
  col: number;
  row: number;
  facing: { x: number; y: number };
  lines: readonly string[];
}

export interface HubDef {
  key: string;
  title: string;
  layout: MapLayout;
  spawn: { col: number; row: number };
  npcs: readonly HubNpcDef[];
  /** Gossip board tile; reading it shows the current rumours. */
  board?: { col: number; row: number };
  /** Floor zone that leaves back to the story. */
  exit?: { col: number; row: number; w: number; h: number };
  exitLabel?: string;
  /** Zones that walk the player into another hub. */
  doors: readonly HubDoor[];
}

export interface HubDoor {
  col: number;
  row: number;
  w: number;
  h: number;
  to: string;
  spawn: { col: number; row: number };
  label: string;
}

const DOWN = { x: 0, y: 1 } as const;
const UP = { x: 0, y: -1 } as const;

export const HUBS: Record<string, HubDef> = {
  monastery: {
    key: "monastery",
    title: "Monastery",
    layout: MONASTERY_MAP,
    spawn: { col: 20, row: 9 },
    npcs: [
      {
        id: "wu",
        name: "WU",
        skin: "wu",
        col: 21,
        row: 6,
        facing: DOWN,
        lines: [
          "Train. Rest. Train again.",
          "Your trail has a name. I do not know it.",
        ],
      },
      {
        id: "kai",
        name: "KAI",
        skin: "kai",
        col: 14,
        row: 9,
        facing: DOWN,
        lines: ["Keep up, Fifth! No slowing down!"],
      },
      {
        id: "cole",
        name: "COLE",
        skin: "cole",
        col: 26,
        row: 9,
        facing: DOWN,
        lines: ["Steady feet. Let them come to you."],
      },
      {
        id: "jay",
        name: "JAY",
        skin: "jay",
        col: 14,
        row: 11,
        facing: UP,
        lines: ["Ha! Your spin leaves a trail. You're a snail!"],
      },
      {
        id: "zane",
        name: "ZANE",
        skin: "zane",
        col: 26,
        row: 11,
        facing: UP,
        lines: ["Your guard opens on the left. Again."],
      },
    ],
    board: { col: 31, row: 15 },
    exit: { col: 19, row: 5, w: 2, h: 1 },
    exitLabel: "HALL",
    doors: [
      {
        col: 19,
        row: 25,
        w: 4,
        h: 1,
        to: "world",
        spawn: { col: 13, row: 2 },
        label: "ROAD",
      },
    ],
  },
  city: {
    key: "city",
    title: "Ninjago City",
    layout: CITY_MAP,
    spawn: { col: 19, row: 23 },
    npcs: [
      {
        id: "wu",
        name: "WU",
        skin: "wu",
        col: 20,
        row: 9,
        facing: DOWN,
        lines: ["The city is nervous. Listen before you act."],
      },
      {
        id: "kai",
        name: "KAI",
        skin: "kai",
        col: 10,
        row: 9,
        facing: DOWN,
        lines: ["Skulkin in the market? Not on my watch."],
      },
      {
        id: "jay",
        name: "JAY",
        skin: "jay",
        col: 28,
        row: 9,
        facing: DOWN,
        lines: ["Heard the rumours? Half of them are about you!"],
      },
      {
        id: "zane",
        name: "ZANE",
        skin: "zane",
        col: 17,
        row: 14,
        facing: UP,
        lines: ["The board changes after every mission. Read it."],
      },
      {
        id: "cole",
        name: "COLE",
        skin: "cole",
        col: 10,
        row: 17,
        facing: UP,
        lines: ["Stick together in the streets."],
      },
    ],
    board: { col: 15, row: 16 },
    doors: [
      {
        col: 18,
        row: 25,
        w: 4,
        h: 1,
        to: "world",
        spawn: { col: 46, row: 33 },
        label: "ROAD",
      },
    ],
  },
  world: {
    key: "world",
    title: "Ninjago",
    layout: WORLD_MAP,
    spawn: { col: 13, row: 2 },
    npcs: [],
    doors: [
      {
        col: 13,
        row: 0,
        w: 2,
        h: 1,
        to: "monastery",
        spawn: { col: 20, row: 23 },
        label: "MONASTERY",
      },
      {
        col: 46,
        row: 35,
        w: 2,
        h: 1,
        to: "city",
        spawn: { col: 19, row: 23 },
        label: "NINJAGO CITY",
      },
    ],
  },
} as const;

export const DEFAULT_HUB = "monastery";

export function hubFor(key: string): HubDef {
  const found = HUBS[key] ?? HUBS[DEFAULT_HUB];
  if (!found) throw new Error(`Unknown hub: ${key}`);
  return found;
}

/** Structural problems with hub maps; empty when sound. */
export function validateHubs(hubs: Record<string, HubDef>): string[] {
  const problems: string[] = [];
  const maps = new Map<string, ReturnType<typeof composeMap>>();
  for (const [key, hub] of Object.entries(hubs)) {
    const { rows, stamps } = hub.layout;
    if (rows.length === 0) {
      problems.push(`${key} has no rows`);
      continue;
    }
    const cols = rows[0]?.length ?? 0;
    if (rows.some((r) => r.length !== cols)) {
      problems.push(`${key} has ragged rows`);
      continue;
    }
    maps.set(key, composeMap(rows, stamps));
  }
  const floorAt = (key: string, col: number, row: number): boolean => {
    const map = maps.get(key);
    if (!map) return false;
    if (col < 0 || row < 0 || col >= map.cols || row >= map.rows) return false;
    return map.solid[row * map.cols + col] === false;
  };
  for (const [key, hub] of Object.entries(hubs)) {
    const map = maps.get(key);
    if (!map) continue;
    const { cols } = map;
    const at = (col: number, row: number): boolean => floorAt(key, col, row);
    const checkTile = (where: string, col: number, row: number): void => {
      if (!at(col, row)) problems.push(`${key}/${where} is not floor`);
    };
    checkTile("spawn", hub.spawn.col, hub.spawn.row);
    if (hub.board) checkTile("board", hub.board.col, hub.board.row);
    const checkZone = (
      where: string,
      z: { col: number; row: number; w: number; h: number },
    ): void => {
      for (let r = 0; r < z.h; r++) {
        for (let c = 0; c < z.w; c++) checkTile(where, z.col + c, z.row + r);
      }
    };
    if (hub.exit) checkZone("exit", hub.exit);
    hub.doors.forEach((door, i) => {
      checkZone(`door ${i}`, door);
      const target = hubs[door.to];
      if (!target) {
        problems.push(`${key}/door ${i} targets unknown hub ${door.to}`);
      } else if (!floorAt(door.to, door.spawn.col, door.spawn.row)) {
        problems.push(`${key}/door ${i} spawn is not floor in ${door.to}`);
      }
    });
    const seen = new Set<string>();
    for (const npc of hub.npcs) {
      if (seen.has(npc.id)) problems.push(`${key}/npc ${npc.id} repeats an id`);
      seen.add(npc.id);
      if (npc.lines.length === 0) problems.push(`${key}/npc ${npc.id} is mute`);
      checkTile(`npc ${npc.id}`, npc.col, npc.row);
    }
    // Every point of interest must be walkable from the spawn.
    const walkable = new Set<number>();
    const start = hub.spawn.row * cols + hub.spawn.col;
    if (at(hub.spawn.col, hub.spawn.row)) {
      const queue = [start];
      walkable.add(start);
      while (queue.length > 0) {
        const cur = queue.pop();
        if (cur === undefined) break;
        const cc = cur % cols;
        const rr = Math.floor(cur / cols);
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          if (!at(cc + dc, rr + dr)) continue;
          const next = (rr + dr) * cols + (cc + dc);
          if (walkable.has(next)) continue;
          walkable.add(next);
          queue.push(next);
        }
      }
    }
    const checkReach = (where: string, col: number, row: number): void => {
      if (!at(col, row)) return;
      if (!walkable.has(row * cols + col)) {
        problems.push(`${key}/${where} cannot be reached`);
      }
    };
    if (hub.board) checkReach("board", hub.board.col, hub.board.row);
    if (hub.exit) checkReach("exit", hub.exit.col, hub.exit.row);
    hub.doors.forEach((d, i) => {
      checkReach(`door ${i}`, d.col, d.row);
    });
    for (const npc of hub.npcs) checkReach(`npc ${npc.id}`, npc.col, npc.row);
  }
  return problems;
}
