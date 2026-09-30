export interface ArenaLayoutData {
  tileSize: number;
  /** '#' is solid, anything else is floor. All rows must be the same length. */
  rows: readonly string[];
  playerSpawn: { col: number; row: number };
  dummySpawn: { col: number; row: number };
  /** Floor tiles where the debug wave spawns mobs. */
  mobSpawns: readonly { col: number; row: number }[];
}

export const ARENA_LAYOUT = {
  tileSize: 16,
  rows: [
    "###############",
    "#.............#",
    "#.............#",
    "#...#.........#",
    "#.............#",
    "#.............#",
    "#.........#...#",
    "#.............#",
    "#.............#",
    "###############",
  ],
  playerSpawn: { col: 2, row: 5 },
  dummySpawn: { col: 8, row: 5 },
  mobSpawns: [
    { col: 12, row: 2 },
    { col: 12, row: 7 },
    { col: 8, row: 1 },
    { col: 8, row: 8 },
    { col: 13, row: 4 },
    { col: 6, row: 8 },
    { col: 6, row: 1 },
    { col: 13, row: 6 },
  ],
} as const satisfies ArenaLayoutData;
