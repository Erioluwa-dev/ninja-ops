import {
  BOOL_FLAG_KEYS,
  FIXED_POINT_IDS,
  type FixedPointId,
  GARMADON_CHOICES,
  isSceneId,
  LIMITS,
  NINJA_IDS,
  type NinjaId,
  type StoryState,
  WEAPON_IDS,
  type WeaponGuard,
} from "./state";

/** Bump when the saved shape changes, and add a migration for the old one. */
export const SAVE_VERSION = 1;

export type LoadResult =
  | { ok: true; state: StoryState }
  | { ok: false; error: string };

class InvalidSave extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new InvalidSave(message);
}

function field(obj: Record<string, unknown>, key: string): unknown {
  if (!(key in obj)) fail(`missing ${key}`);
  return obj[key];
}

function readBool(obj: Record<string, unknown>, key: string): boolean {
  const v = field(obj, key);
  if (typeof v !== "boolean") fail(`${key} must be a boolean`);
  return v;
}

function readInt(
  obj: Record<string, unknown>,
  key: string,
  range: { min: number; max: number },
): number {
  const v = field(obj, key);
  if (typeof v !== "number" || !Number.isInteger(v)) {
    fail(`${key} must be an integer`);
  }
  if (v < range.min || v > range.max) {
    fail(`${key} must be between ${range.min} and ${range.max}`);
  }
  return v;
}

function readOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  what: string,
): T {
  const found = allowed.find((a) => a === value);
  if (found === undefined) fail(`${what} is not one of ${allowed.join(", ")}`);
  return found;
}

function readNullable<T>(
  obj: Record<string, unknown>,
  key: string,
  read: (value: unknown) => T,
): T | null {
  const v = field(obj, key);
  return v === null ? null : read(v);
}

function readStrings(obj: Record<string, unknown>, key: string): string[] {
  const v = field(obj, key);
  if (!Array.isArray(v)) fail(`${key} must be a list`);
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") fail(`${key} must hold only strings`);
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function readWeaponGuard(value: unknown): WeaponGuard {
  if (!isRecord(value)) return fail("ch1_weapon_guard must be an object");
  return {
    weapon: readOneOf(value.weapon, WEAPON_IDS, "ch1_weapon_guard.weapon"),
    ninja: readOneOf(value.ninja, NINJA_IDS, "ch1_weapon_guard.ninja"),
  };
}

function readFixedPoints(obj: Record<string, unknown>): FixedPointId[] {
  return readStrings(obj, "fixed_points_fired").map((id) =>
    readOneOf(id, FIXED_POINT_IDS, "fixed_points_fired entry"),
  );
}

/** Narrows untrusted data to a StoryState, or says what is wrong with it. */
export function validateStoryState(value: unknown): LoadResult {
  try {
    if (!isRecord(value))
      return { ok: false, error: "story must be an object" };
    const trust = (ninja: NinjaId): number =>
      readInt(value, `trust_${ninja}`, LIMITS.trust);
    const scene = readNullable(value, "scene", (v) => {
      if (typeof v !== "string" || !isSceneId(v)) {
        return fail("scene must look like ch1_s1");
      }
      return v;
    });
    const state: StoryState = {
      chapter: readInt(value, "chapter", { min: 1, max: 99 }),
      scene,
      dragon_ignored_you: readBool(value, BOOL_FLAG_KEYS[0]),
      wu_knows_blade: readBool(value, BOOL_FLAG_KEYS[1]),
      ch1_sparring_partner: readNullable(value, "ch1_sparring_partner", (v) =>
        readOneOf(v, NINJA_IDS, "ch1_sparring_partner"),
      ),
      ch1_weapon_guard: readNullable(
        value,
        "ch1_weapon_guard",
        readWeaponGuard,
      ),
      ch1_garmadon_choice: readNullable(value, "ch1_garmadon_choice", (v) =>
        readOneOf(v, GARMADON_CHOICES, "ch1_garmadon_choice"),
      ),
      corruption: readInt(value, "corruption", LIMITS.corruption),
      resonance: readInt(value, "resonance", LIMITS.resonance),
      ghost_limit: readInt(value, "ghost_limit", LIMITS.ghostLimit),
      trust_kai: trust("kai"),
      trust_jay: trust("jay"),
      trust_zane: trust("zane"),
      trust_cole: trust("cole"),
      village_standing: readInt(
        value,
        "village_standing",
        LIMITS.villageStanding,
      ),
      blade_stage: readInt(value, "blade_stage", LIMITS.bladeStage),
      rumours: readStrings(value, "rumours"),
      unlocks: readStrings(value, "unlocks"),
      fixed_points_fired: readFixedPoints(value),
    };
    return { ok: true, state };
  } catch (error) {
    if (error instanceof InvalidSave)
      return { ok: false, error: error.message };
    throw error;
  }
}

export function serializeStory(state: StoryState): string {
  return JSON.stringify({ version: SAVE_VERSION, story: state });
}

export function parseStory(text: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `save is not valid JSON: ${reason}` };
  }
  if (!isRecord(raw)) return { ok: false, error: "save must be an object" };
  if (raw.version !== SAVE_VERSION) {
    return {
      ok: false,
      error: `unsupported save version ${String(raw.version)}`,
    };
  }
  return validateStoryState(raw.story);
}
