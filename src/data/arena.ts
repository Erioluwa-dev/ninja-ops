export interface ArenaLayoutData {
  tileSize: number;
  /** '#' is solid, anything else is floor. All rows must be the same length. */
  rows: readonly string[];
  playerSpawn: { col: number; row: number };
  dummySpawn: { col: number; row: number };
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
} as const satisfies ArenaLayoutData;
