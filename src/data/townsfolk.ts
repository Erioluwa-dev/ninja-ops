/** Random civilians for the city and the world's village: placement, looks, lines and wandering. */

export interface TownsArea {
  col: number;
  row: number;
  w: number;
  h: number;
}

export interface TownsfolkSpec {
  count: number;
  /** Fixed per hub so placement, looks and lines are stable across runs and tests. */
  seed: number;
  /** Name label shown in the dialogue box. */
  label: string;
  /** Candidate regions; only reachable floor tiles inside them are used. */
  areas: readonly TownsArea[];
}

export const CIVILIAN_LOOKS = 6;

export interface TownspersonDef {
  id: string;
  name: string;
  /** Index into the civilian palette recipes, 0..CIVILIAN_LOOKS-1. */
  look: number;
  col: number;
  row: number;
  lines: readonly string[];
}

// DRAFT(writer): generic townsfolk chatter. No named characters, no lore.
export const TOWNSFOLK_LINES: readonly string[] = [
  "Fresh noodles today. Best in the city!", // DRAFT(writer)
  "Rain by evening, I'd say. My knees know.", // DRAFT(writer)
  "Prices went up again. Everyone blames the roads.", // DRAFT(writer)
  "I heard bone men were seen out past the hills.", // DRAFT(writer)
  "The ninja keep us safe. Mostly.", // DRAFT(writer)
  "My cousin swears he saw a ninja jump a rooftop.", // DRAFT(writer)
  "Lock your shutters at night. Just in case.", // DRAFT(writer)
  "Lovely weather for the market, isn't it?", // DRAFT(writer)
  "Don't stand near the stalls. Pickpockets.", // DRAFT(writer)
  "Everyone is talking about something. Nobody agrees.", // DRAFT(writer)
  "I came here for a quiet life. Ha!", // DRAFT(writer)
  "The bakers start before dawn. I can smell it.", // DRAFT(writer)
  "Strange noises from the old road lately.", // DRAFT(writer)
  "My boots are worn through. Too much walking.", // DRAFT(writer)
  "Mind the cart! It goes where it likes.", // DRAFT(writer)
  "Skulkin stories scare the little ones. Good.", // DRAFT(writer)
  "A good tea fixes most worries.", // DRAFT(writer)
  "Keep your head down and your purse close.", // DRAFT(writer)
];

/** Small seeded PRNG (mulberry32); returns floats in [0, 1). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlaceInput {
  cols: number;
  rows: number;
  solid: readonly boolean[];
  start: { col: number; row: number };
  /** Tiles townsfolk must never stand on or wander into (doors, exit, board, NPCs, spawn). */
  keepClear: (col: number, row: number) => boolean;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function reachableFrom(input: PlaceInput): Set<number> {
  const { cols, rows, solid, start } = input;
  const open = (c: number, r: number): boolean =>
    c >= 0 && r >= 0 && c < cols && r < rows && solid[r * cols + c] === false;
  const seen = new Set<number>();
  if (!open(start.col, start.row)) return seen;
  const stack = [start.row * cols + start.col];
  seen.add(stack[0] ?? 0);
  while (stack.length > 0) {
    const cur = stack.pop();
    if (cur === undefined) break;
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    for (const [dc, dr] of DIRS) {
      if (!open(c + dc, r + dr)) continue;
      const next = (r + dr) * cols + (c + dc);
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return seen;
}

/** Fisher-Yates with the supplied rng so the order is reproducible. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export function placeTownsfolk(
  input: PlaceInput,
  spec: TownsfolkSpec,
  idPrefix: string,
): TownspersonDef[] {
  const rng = seededRng(spec.seed);
  const reach = reachableFrom(input);
  const seen = new Set<number>();
  const candidates: { col: number; row: number }[] = [];
  for (const a of spec.areas) {
    for (let r = a.row; r < a.row + a.h; r++) {
      for (let c = a.col; c < a.col + a.w; c++) {
        const idx = r * input.cols + c;
        if (seen.has(idx) || !reach.has(idx) || input.keepClear(c, r)) continue;
        seen.add(idx);
        candidates.push({ col: c, row: r });
      }
    }
  }
  const chosen: { col: number; row: number }[] = [];
  for (const t of shuffled(candidates, rng)) {
    if (chosen.length >= spec.count) break;
    // Spread them out so the crowd reads as separate people, not a huddle.
    const crowded = chosen.some(
      (o) => Math.max(Math.abs(o.col - t.col), Math.abs(o.row - t.row)) < 4,
    );
    if (!crowded) chosen.push(t);
  }
  return chosen.map((t, i) => {
    const pool = shuffled(TOWNSFOLK_LINES, rng);
    return {
      id: `${idPrefix}_townsfolk_${i}`,
      name: spec.label,
      look: Math.floor(rng() * CIVILIAN_LOOKS),
      col: t.col,
      row: t.row,
      lines: pool.slice(0, 1 + Math.floor(rng() * 2)),
    };
  });
}

/** Furthest a townsperson strays from where it was placed, in tiles. */
export const WANDER_RADIUS = 4;

/**
 * Picks the next stroll: one direction, 1-3 tiles, stopping short of anything
 * not free. Null when boxed in, so the caller just pauses again.
 */
export function pickWanderTarget(
  home: { col: number; row: number },
  cur: { col: number; row: number },
  rng: () => number,
  isFree: (col: number, row: number) => boolean,
): { col: number; row: number } | null {
  const dir = DIRS[Math.floor(rng() * DIRS.length)];
  if (!dir) return null;
  const want = 1 + Math.floor(rng() * 3);
  let col = cur.col;
  let row = cur.row;
  for (let i = 0; i < want; i++) {
    const nc = col + dir[0];
    const nr = row + dir[1];
    const tooFar =
      Math.abs(nc - home.col) > WANDER_RADIUS ||
      Math.abs(nr - home.row) > WANDER_RADIUS;
    if (tooFar || !isFree(nc, nr)) break;
    col = nc;
    row = nr;
  }
  return col === cur.col && row === cur.row ? null : { col, row };
}
