/** Walkable hub maps. Tiles reuse the arena set: '#' is solid, '.' is floor. */

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
  /** 30x20 rows (480x320 at 16 px) so the camera scrolls 2-3 screens. */
  rows: readonly string[];
  spawn: { col: number; row: number };
  npcs: readonly HubNpcDef[];
  /** Gossip board tile; reading it shows the current rumours. */
  board: { col: number; row: number };
  /** Floor zone that leaves back to the story. */
  exit: { col: number; row: number; w: number; h: number };
  exitLabel: string;
}

const DOWN = { x: 0, y: 1 } as const;
const UP = { x: 0, y: -1 } as const;

const MONASTERY_ROWS = [
  "##############################",
  "#............................#",
  "#............................#",
  "#.....######......######.....#",
  "#............................#",
  "#............................#",
  "#.............##.............#",
  "#............................#",
  "#............................#",
  "#...#....................#...#",
  "#............................#",
  "#............................#",
  "#.............##.............#",
  "#...#....................#...#",
  "#............................#",
  "#............................#",
  "#.......#####....#####.......#",
  "#............................#",
  "#............................#",
  "##############################",
] as const;

const CITY_ROWS = [
  "##############################",
  "#............................#",
  "#...####..............####...#",
  "#............................#",
  "#............................#",
  "#...........######...........#",
  "#............................#",
  "#............................#",
  "#.............##.............#",
  "#............................#",
  "#..###..................###..#",
  "#............................#",
  "#.......#............#.......#",
  "#............................#",
  "#.........######.............#",
  "#............................#",
  "#............................#",
  "#...................#####....#",
  "#............................#",
  "##############################",
] as const;

export const HUBS: Record<string, HubDef> = {
  monastery: {
    key: "monastery",
    title: "Monastery",
    rows: MONASTERY_ROWS,
    spawn: { col: 15, row: 10 },
    npcs: [
      {
        id: "wu",
        name: "WU",
        skin: "wu",
        col: 15,
        row: 4,
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
        col: 11,
        row: 9,
        facing: DOWN,
        lines: ["Keep up, Fifth! No slowing down!"],
      },
      {
        id: "cole",
        name: "COLE",
        skin: "cole",
        col: 18,
        row: 9,
        facing: DOWN,
        lines: ["Steady feet. Let them come to you."],
      },
      {
        id: "jay",
        name: "JAY",
        skin: "jay",
        col: 11,
        row: 12,
        facing: UP,
        lines: ["Ha! Your spin leaves a trail. You're a snail!"],
      },
      {
        id: "zane",
        name: "ZANE",
        skin: "zane",
        col: 18,
        row: 12,
        facing: UP,
        lines: ["Your guard opens on the left. Again."],
      },
    ],
    board: { col: 25, row: 2 },
    exit: { col: 14, row: 17, w: 2, h: 2 },
    exitLabel: "GATE",
  },
  city: {
    key: "city",
    title: "Ninjago City",
    rows: CITY_ROWS,
    spawn: { col: 15, row: 10 },
    npcs: [
      {
        id: "wu",
        name: "WU",
        skin: "wu",
        col: 15,
        row: 3,
        facing: DOWN,
        lines: ["The city is nervous. Listen before you act."],
      },
      {
        id: "kai",
        name: "KAI",
        skin: "kai",
        col: 8,
        row: 6,
        facing: DOWN,
        lines: ["Skulkin in the market? Not on my watch."],
      },
      {
        id: "jay",
        name: "JAY",
        skin: "jay",
        col: 21,
        row: 6,
        facing: DOWN,
        lines: ["Heard the rumours? Half of them are about you!"],
      },
      {
        id: "zane",
        name: "ZANE",
        skin: "zane",
        col: 15,
        row: 11,
        facing: UP,
        lines: ["The board changes after every mission. Read it."],
      },
      {
        id: "cole",
        name: "COLE",
        skin: "cole",
        col: 10,
        row: 15,
        facing: UP,
        lines: ["Stick together in the streets."],
      },
    ],
    board: { col: 4, row: 16 },
    exit: { col: 14, row: 17, w: 2, h: 2 },
    exitLabel: "GATE",
  },
} as const;

export const DEFAULT_HUB = "monastery";

export function hubFor(key: string): HubDef {
  const found = HUBS[key] ?? HUBS[DEFAULT_HUB];
  if (!found) throw new Error(`Unknown hub: ${key}`);
  return found;
}

function floorOf(rows: readonly string[]): boolean[] {
  const floor: boolean[] = [];
  for (const row of rows) for (const ch of row) floor.push(ch !== "#");
  return floor;
}

/** Structural problems with hub maps; empty when sound. */
export function validateHubs(hubs: Record<string, HubDef>): string[] {
  const problems: string[] = [];
  for (const [key, hub] of Object.entries(hubs)) {
    if (hub.rows.length === 0) {
      problems.push(`${key} has no rows`);
      continue;
    }
    const cols = hub.rows[0]?.length ?? 0;
    if (hub.rows.some((r) => r.length !== cols)) {
      problems.push(`${key} has ragged rows`);
      continue;
    }
    const rows = hub.rows.length;
    const floor = floorOf(hub.rows);
    const at = (col: number, row: number): boolean => {
      if (col < 0 || row < 0 || col >= cols || row >= rows) return false;
      return floor[row * cols + col] === true;
    };
    const checkTile = (where: string, col: number, row: number): void => {
      if (!at(col, row)) problems.push(`${key}/${where} is not floor`);
    };
    checkTile("spawn", hub.spawn.col, hub.spawn.row);
    checkTile("board", hub.board.col, hub.board.row);
    for (let r = 0; r < hub.exit.h; r++) {
      for (let c = 0; c < hub.exit.w; c++) {
        checkTile("exit", hub.exit.col + c, hub.exit.row + r);
      }
    }
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
    checkReach("board", hub.board.col, hub.board.row);
    checkReach("exit", hub.exit.col, hub.exit.row);
    for (const npc of hub.npcs) checkReach(`npc ${npc.id}`, npc.col, npc.row);
  }
  return problems;
}
