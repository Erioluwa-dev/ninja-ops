import type { SpeakerId } from "../story/schema";

/** Where an actor stands on the stage grid (tile coords + cardinal facing). */
export interface StageMark {
  col: number;
  row: number;
  /** Cardinal unit vector. */
  facing: { x: number; y: number };
}

/** One playable stage: the tilemap + where each speaker stands. */
export interface StageDef {
  /** Matches SceneDef.backdrop (monastery, village, ...). */
  key: string;
  /** '#' = wall, '.' = floor. 15x10 = 240x160 at 16 px. */
  rows: readonly string[];
  /** SpeakerId -> tile mark. Missing speakers simply don't appear. */
  marks: Record<string, StageMark>;
  /** Multiply tint for the floor (e.g. night is cooler). Null = default. */
  floorTint?: number | null;
  /** Wall tint, rarely used. */
  wallTint?: number | null;
}

const DOWN = { x: 0, y: 1 } as const;
const UP = { x: 0, y: -1 } as const;
const LEFT = { x: -1, y: 0 } as const;
const RIGHT = { x: 1, y: 0 } as const;

/** Shared dojo marks: Wu up top, Fifth centre, four ninja flanking. */
const DOJO_MARKS: Record<string, StageMark> = {
  wu: { col: 7, row: 2, facing: DOWN },
  fifth: { col: 7, row: 7, facing: UP },
  kai: { col: 4, row: 5, facing: RIGHT },
  cole: { col: 10, row: 5, facing: LEFT },
  jay: { col: 4, row: 7, facing: RIGHT },
  zane: { col: 10, row: 7, facing: LEFT },
};

const VILLAGE_MARKS: Record<string, StageMark> = {
  wu: { col: 7, row: 2, facing: DOWN },
  fifth: { col: 7, row: 6, facing: UP },
  kai: { col: 3, row: 5, facing: RIGHT },
  cole: { col: 11, row: 5, facing: LEFT },
  jay: { col: 5, row: 7, facing: UP },
  zane: { col: 9, row: 7, facing: UP },
};

const CAVES_MARKS: Record<string, StageMark> = {
  wu: { col: 7, row: 2, facing: DOWN },
  fifth: { col: 7, row: 6, facing: UP },
  kai: { col: 4, row: 5, facing: RIGHT },
  cole: { col: 10, row: 5, facing: LEFT },
  jay: { col: 5, row: 7, facing: UP },
  zane: { col: 9, row: 7, facing: UP },
};

const CHAMBER_MARKS: Record<string, StageMark> = {
  fifth: { col: 7, row: 5, facing: UP },
  wu: { col: 7, row: 3, facing: DOWN },
  kai: { col: 5, row: 6, facing: RIGHT },
  zane: { col: 9, row: 6, facing: LEFT },
};

const SITE_MARKS: Record<string, StageMark> = {
  wu: { col: 7, row: 2, facing: DOWN },
  fifth: { col: 7, row: 6, facing: UP },
  kai: { col: 4, row: 5, facing: RIGHT },
  cole: { col: 10, row: 5, facing: LEFT },
  jay: { col: 4, row: 7, facing: UP },
  zane: { col: 10, row: 7, facing: UP },
};

const NIGHT_MARKS: Record<string, StageMark> = {
  wu: { col: 7, row: 3, facing: DOWN },
  fifth: { col: 7, row: 7, facing: UP },
  kai: { col: 4, row: 6, facing: RIGHT },
  cole: { col: 10, row: 6, facing: LEFT },
};

export const STAGES: Record<string, StageDef> = {
  monastery: {
    key: "monastery",
    rows: [
      "###############",
      "#.............#",
      "#.............#",
      "#....#...#....#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############",
    ],
    marks: DOJO_MARKS,
  },
  village: {
    key: "village",
    rows: [
      "###############",
      "#.............#",
      "#...##........#",
      "#...##........#",
      "#.............#",
      "#.............#",
      "#........##...#",
      "#........##...#",
      "#.............#",
      "###############",
    ],
    marks: VILLAGE_MARKS,
  },
  caves: {
    key: "caves",
    rows: [
      "###############",
      "#.............#",
      "#.###.....###.#",
      "#.#.......#.#.#",
      "#.............#",
      "#.....###.....#",
      "#.............#",
      "#.#.......#.#.#",
      "#.............#",
      "###############",
    ],
    marks: CAVES_MARKS,
  },
  chamber: {
    key: "chamber",
    rows: [
      "###############",
      "#.............#",
      "#..#########..#",
      "#..#.......#..#",
      "#..#.......#..#",
      "#..#.......#..#",
      "#..#.......#..#",
      "#..#########..#",
      "#.............#",
      "###############",
    ],
    marks: CHAMBER_MARKS,
  },
  site: {
    key: "site",
    rows: [
      "###############",
      "#.............#",
      "#.............#",
      "#..#.......#..#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#..#.......#..#",
      "#.............#",
      "###############",
    ],
    marks: SITE_MARKS,
  },
  night: {
    key: "night",
    rows: [
      "###############",
      "#.............#",
      "#.............#",
      "#....#...#....#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############",
    ],
    marks: NIGHT_MARKS,
    floorTint: 0x6a7a9a,
    wallTint: 0x4a5a7a,
  },
  test: {
    key: "test",
    rows: [
      "###############",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "###############",
    ],
    marks: DOJO_MARKS,
  },
} as const;

/** Fallback when a backdrop has no stage: monastery. */
export const DEFAULT_STAGE_KEY = "monastery";

export function stageFor(backdrop: string): StageDef {
  const found = STAGES[backdrop] ?? STAGES[DEFAULT_STAGE_KEY];
  if (!found) throw new Error(`Unknown stage: ${backdrop}`);
  return found;
}

/** Ordered speaker ids the stage cares about. */
export const STAGE_SPEAKERS: SpeakerId[] = [
  "wu",
  "kai",
  "jay",
  "zane",
  "cole",
  "fifth",
];
