import { describe, expect, it } from "vitest";
import { ATTACKS } from "../data/attacks";
import { COMBAT } from "../data/combat";
import { KITS } from "../data/kits";
import { createTuning } from "../data/tuning";
import {
  attackTotalFrames,
  createSim,
  type Entity,
  type EntityState,
  spawnMob,
  step,
} from "../sim";
import {
  entityOfKind,
  forceAttack,
  idleInput,
  runScript,
} from "../sim/testing";
import { actorCue, GUARD_BREAK, STAGGER } from "./actorCues";
import { actorFrame, actorSkin } from "./actorFrames";
import { ACTOR_KEY } from "./assets";
import { FLASH, SWEEP_TELEGRAPH, TELEGRAPH, UNBLOCKABLE } from "./palette";

const DOWN = { x: 0, y: 1 };
const UP = { x: 0, y: -1 };
const LEFT = { x: -1, y: 0 };
const RIGHT = { x: 1, y: 0 };

const tuning = createTuning();
// Never stepped or spawned into: tests copy entities out of it with inState.
const state = createSim({ seed: 1, tuning });
const player = entityOfKind(state, "player");
const dummy = entityOfKind(state, "dummy");
// Each mob lives in its own sim so no test sees another's spawns.
const mob = (type: string): Entity =>
  spawnMob(createSim({ seed: 1, tuning }), type, { x: 100, y: 80 });

function inState(e: Entity, s: EntityState, facing = DOWN): Entity {
  return { ...e, state: s, facing: { ...facing }, combat: { ...e.combat } };
}

function swing(e: Entity, attackId: string, frame: number): Entity {
  const copy = inState(e, "attack");
  forceAttack(copy, attackId, copy.facing);
  copy.combat.attackFrame = frame;
  return copy;
}

const frameOf = (e: Entity, tick = 0): number =>
  actorFrame(e, tuning, tick).frame;

describe("skin choice", () => {
  it("maps each entity to its own sheet", () => {
    expect(actorFrame(player, tuning, 0).textureKey).toBe(ACTOR_KEY.player);
    expect(actorFrame(dummy, tuning, 0).textureKey).toBe(ACTOR_KEY.dummy);
    expect(actorFrame(mob("melee"), tuning, 0).textureKey).toBe(
      ACTOR_KEY.melee,
    );
    expect(actorFrame(mob("ranged"), tuning, 0).textureKey).toBe(
      ACTOR_KEY.ranged,
    );
    expect(actorFrame(mob("sweeper"), tuning, 0).textureKey).toBe(
      ACTOR_KEY.sweeper,
    );
    expect(actorFrame(mob("oniBrute"), tuning, 0).textureKey).toBe(
      ACTOR_KEY.bruteIdle,
    );
  });

  it("falls back to a mob sheet for an unknown mob type", () => {
    const stranger = { ...mob("melee"), mobType: "mystery" };
    expect(actorSkin(stranger).key).toBe(ACTOR_KEY.melee);
  });
});

describe("facing columns", () => {
  it("picks down, up, left, right from the facing", () => {
    const cols = [DOWN, UP, LEFT, RIGHT].map((f) => {
      const e = inState(mob("melee"), "idle", f);
      return frameOf(e);
    });
    // Grid sheets: index = row * 4 + col, standing pose is row 0.
    expect(cols).toEqual([0, 1, 2, 3]);
  });

  it("uses the left column block for ninja locomotion and the right for combat", () => {
    expect(frameOf(inState(player, "idle", RIGHT))).toBe(3);
    expect(frameOf(inState(player, "hurt", RIGHT))).toBe(4 * 8 + 4 + 3);
  });

  it("flips the front-facing brute for left", () => {
    const left = actorFrame(inState(mob("oniBrute"), "idle", LEFT), tuning, 0);
    const right = actorFrame(
      inState(mob("oniBrute"), "idle", RIGHT),
      tuning,
      0,
    );
    expect(left.flipX).toBe(true);
    expect(right.flipX).toBe(false);
  });
});

describe("walk and idle cycles", () => {
  it("steps through the four walk rows as the tick advances", () => {
    const e = inState(player, "move", RIGHT);
    const rows = new Set<number>();
    for (let tick = 0; tick < 40; tick++) {
      rows.add(Math.floor(frameOf(e, tick) / 8));
    }
    expect([...rows].sort((a, b) => a - b)).toEqual([4, 5, 6, 7]);
  });

  it("walks the 16px sheets through rows 0 to 3", () => {
    const e = inState(mob("melee"), "move", LEFT);
    const rows = new Set<number>();
    for (let tick = 0; tick < 40; tick++)
      rows.add(Math.floor(frameOf(e, tick) / 4));
    expect([...rows].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it("cycles the brute's walk strip", () => {
    const e = inState(mob("oniBrute"), "move");
    const frames = new Set<number>();
    for (let tick = 0; tick < 60; tick++) {
      const f = actorFrame(e, tuning, tick);
      expect(f.textureKey).toBe(ACTOR_KEY.bruteWalk);
      frames.add(f.frame);
    }
    expect([...frames].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("freezes idle and walk cycles during hitstop", () => {
    for (const s of ["idle", "move"] as const) {
      for (const base of [player, dummy, mob("melee"), mob("oniBrute")]) {
        const e = inState(base, s);
        e.combat.hitstop = 3;
        const seen = new Set<string>();
        for (let tick = 0; tick < 80; tick++) {
          const f = actorFrame(e, tuning, tick);
          seen.add(`${f.textureKey}:${f.frame}`);
        }
        expect(seen.size).toBe(1);
      }
    }
  });
});

describe("attack frames follow the attack phase", () => {
  const strikeRow = 1;

  it("shows the ninja strike pose on exactly the active frames", () => {
    for (const id of KITS.ninja.comboAttacks) {
      const attack = ATTACKS[id];
      const total = attackTotalFrames(attack);
      for (let f = 0; f < total; f++) {
        const frame = frameOf(swing(player, id, f), 99);
        const isStrike = frame === strikeRow * 8 + 4 + 0;
        const active =
          f >= attack.startup && f < attack.startup + attack.active;
        expect(isStrike).toBe(active);
      }
    }
  });

  it("winds up on the first ninja frame and recovers on the last two", () => {
    const id = "ninjaHit1";
    const attack = ATTACKS[id];
    expect(frameOf(swing(player, id, 0))).toBe(4);
    const late = attackTotalFrames(attack) - 1;
    expect(frameOf(swing(player, id, late))).toBe(3 * 8 + 4);
    expect(frameOf(swing(player, id, attack.startup + attack.active))).toBe(
      2 * 8 + 4,
    );
  });

  it("holds the 16px attack pose from the first active frame, never in startup", () => {
    const attack = ATTACKS.oniSlash;
    const attackRow = 4;
    for (let f = 0; f < attackTotalFrames(attack); f++) {
      const frame = frameOf(swing(mob("melee"), "oniSlash", f));
      const posed = Math.floor(frame / 4) === attackRow;
      if (f < attack.startup) expect(posed).toBe(false);
      if (f >= attack.startup && f < attack.startup + attack.active) {
        expect(posed).toBe(true);
      }
    }
    const last = attackTotalFrames(attack) - 1;
    expect(Math.floor(frameOf(swing(mob("melee"), "oniSlash", last)) / 4)).toBe(
      0,
    );
  });

  it("keeps a one-frame bolt shot visible", () => {
    const attack = ATTACKS.oniBolt;
    const frame = frameOf(swing(mob("ranged"), "oniBolt", attack.startup));
    expect(Math.floor(frame / 4)).toBe(4);
  });

  it("gives the brute distinct poses for startup, strike and recovery", () => {
    const attack = ATTACKS.bruteSmash;
    const windup = actorFrame(
      swing(mob("oniBrute"), "bruteSmash", 0),
      tuning,
      7,
    );
    const strike = actorFrame(
      swing(mob("oniBrute"), "bruteSmash", attack.startup),
      tuning,
      7,
    );
    const recover = actorFrame(
      swing(mob("oniBrute"), "bruteSmash", attack.startup + attack.active),
      tuning,
      7,
    );
    expect(new Set([windup.frame, strike.frame, recover.frame]).size).toBe(3);
    expect(windup.textureKey).toBe(ACTOR_KEY.bruteIdle);
  });

  it("holds attacker and victim on one frame through every frozen tick of a real hit", () => {
    const sim = createSim({ seed: 1, tuning: createTuning() });
    const attacker = entityOfKind(sim, "player");
    const victim = entityOfKind(sim, "dummy");
    victim.pos = { x: attacker.pos.x + 20, y: attacker.pos.y };
    runScript(sim, { 0: { attack: true } }, ATTACKS.ninjaHit1.startup + 1);
    expect(attacker.combat.hitstop).toBeGreaterThan(0);
    expect(victim.combat.hitstop).toBeGreaterThan(0);

    const attackerFrames = new Set<string>();
    const victimFrames = new Set<string>();
    let frozenTicks = 0;
    while (attacker.combat.hitstop > 0) {
      const a = actorFrame(attacker, sim.tuning, sim.tick);
      const v = actorFrame(victim, sim.tuning, sim.tick);
      attackerFrames.add(`${a.textureKey}:${a.frame}:${a.flipX}`);
      victimFrames.add(`${v.textureKey}:${v.frame}:${v.flipX}`);
      frozenTicks += 1;
      step(sim, idleInput());
    }
    expect(frozenTicks).toBe(ATTACKS.ninjaHit1.hitstop);
    expect(attackerFrames.size).toBe(1);
    expect(victimFrames.size).toBe(1);
  });
});

describe("dodge, jump, spin", () => {
  it("rolls through three frames across the dodge", () => {
    const { duration } = COMBAT.dodge;
    const rows: number[] = [];
    for (let f = 0; f < duration; f++) {
      const e = inState(player, "dodge", LEFT);
      e.combat.dodgeFrame = f;
      rows.push(Math.floor(frameOf(e) / 8));
    }
    expect([...new Set(rows)]).toEqual([6, 7, 8]);
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
  });

  it("tracks the jump arc and crouches for the landing", () => {
    const jump = KITS.ninja.jump;
    const rowAt = (jumpFrame: number): number => {
      const e = inState(player, "jump");
      e.combat.jumpFrame = jumpFrame;
      return Math.floor(frameOf(e) / 8);
    };
    expect(rowAt(1)).toBe(12);
    expect(rowAt(Math.floor(jump.frames / 2))).toBe(13);
    expect(rowAt(Math.floor(jump.frames * 0.8))).toBe(13);
    expect(rowAt(jump.frames - 2)).toBe(14);
    expect(rowAt(jump.frames + 2)).toBe(12);
  });

  it("turns the spinning ninja through all four facings", () => {
    const cols = new Set<number>();
    for (let spinFrame = 0; spinFrame < 24; spinFrame++) {
      const e = inState(player, "spin");
      e.combat.spinFrame = spinFrame;
      cols.add(frameOf(e) % 8);
    }
    expect([...cols].sort()).toEqual([4, 5, 6, 7]);
  });
});

describe("stun and death", () => {
  it("uses hit frames for hurt and the dazed frame for stagger, guard break and dizzy", () => {
    const hurt = frameOf(inState(player, "hurt", UP));
    for (const s of ["stagger", "guardBreak", "dizzy"] as const) {
      const f = frameOf(inState(player, s, UP));
      expect(f).not.toBe(hurt);
      expect(Math.floor(f / 8)).toBe(5);
    }
    expect(Math.floor(hurt / 8)).toBe(4);
  });

  it("flinches the dummy into its squashed pose", () => {
    expect(frameOf(inState(dummy, "hurt", LEFT))).toBe(24);
  });

  it("crouches grid mobs when hurt and squashes them when dead", () => {
    const grunt = mob("melee");
    expect(Math.floor(frameOf(inState(grunt, "hurt")) / 4)).toBe(5);
    expect(frameOf(inState(grunt, "dead"))).toBe(24);
  });

  it("drops the ninja from falling to lying as the death timer runs out", () => {
    const falling = inState(player, "dead");
    falling.combat.stun = COMBAT.death.frames;
    const lying = inState(player, "dead");
    lying.combat.stun = 0;
    expect(frameOf(falling)).toBe(13 * 8 + 4);
    expect(frameOf(lying)).toBe(14 * 8 + 4);
  });

  it("shows the brute's recoil, then its open-mouth stagger, on the hit strip", () => {
    const hurt = actorFrame(inState(mob("oniBrute"), "hurt"), tuning, 0);
    const stagger = actorFrame(inState(mob("oniBrute"), "stagger"), tuning, 0);
    expect(hurt.textureKey).toBe(ACTOR_KEY.bruteHit);
    expect(stagger.textureKey).toBe(ACTOR_KEY.bruteHit);
    expect(hurt.frame).not.toBe(stagger.frame);
  });

  it("covers every entity state with a valid frame on every sheet", () => {
    const states: EntityState[] = [
      "idle",
      "move",
      "attack",
      "block",
      "dodge",
      "jump",
      "spin",
      "dizzy",
      "stagger",
      "guardBreak",
      "hurt",
      "dead",
    ];
    const counts: Record<string, number> = {
      [ACTOR_KEY.player]: 17 * 8,
      [ACTOR_KEY.dummy]: 7 * 4,
      [ACTOR_KEY.melee]: 7 * 4,
      [ACTOR_KEY.ranged]: 7 * 4,
      [ACTOR_KEY.sweeper]: 7 * 4,
      [ACTOR_KEY.bruteIdle]: 5,
      [ACTOR_KEY.bruteWalk]: 6,
      [ACTOR_KEY.bruteHit]: 3,
    };
    const bodies = [
      player,
      dummy,
      mob("melee"),
      mob("ranged"),
      mob("sweeper"),
      mob("oniBrute"),
    ];
    for (const body of bodies) {
      for (const s of states) {
        for (const facing of [DOWN, UP, LEFT, RIGHT]) {
          const e = inState(body, s, facing);
          e.combat.jumpFrame = 10;
          const f = actorFrame(e, tuning, 123);
          const limit = counts[f.textureKey];
          expect(limit).toBeDefined();
          expect(f.frame).toBeGreaterThanOrEqual(0);
          expect(f.frame).toBeLessThan(limit ?? 0);
        }
      }
    }
  });
});

describe("readability cues", () => {
  const cueOf = (e: Entity, tick = 0) => actorCue({ ...state, tick }, e);

  it("flashes white solid during hitstop", () => {
    const e = inState(mob("melee"), "idle");
    e.combat.hitstop = 3;
    expect(cueOf(e)).toMatchObject({ fill: FLASH, fillAlpha: 1 });
  });

  it("blinks hurt and washes stagger and guard break in their colors", () => {
    const hurt = inState(player, "hurt");
    expect(cueOf(hurt, 0).fill).toBe(FLASH);
    expect(cueOf(hurt, 2).fill).toBeNull();
    expect(cueOf(inState(player, "stagger"), 2).fill).toBe(STAGGER);
    expect(cueOf(inState(player, "guardBreak"), 2).fill).toBe(GUARD_BREAK);
    expect(cueOf(inState(player, "stagger"), 0).fill).toBe(FLASH);
  });

  it("tints the startup of each telegraphed swing by its kind", () => {
    const slash = swing(mob("melee"), "oniSlash", 2);
    expect(cueOf(slash).fill).toBe(TELEGRAPH);
    const sweep = swing(mob("sweeper"), "sweeperSweep", 2);
    expect(cueOf(sweep).fill).toBe(SWEEP_TELEGRAPH);
    const unblockable = Object.entries(ATTACKS).find(
      ([, a]) => a.unblockable && a.telegraph,
    );
    expect(unblockable).toBeDefined();
    if (!unblockable) return;
    const red = swing(mob("oniBrute"), unblockable[0], 2);
    const fills = new Set([0, 3].map((tick) => cueOf(red, tick).fill));
    expect(fills).toEqual(new Set([UNBLOCKABLE, 0x200000]));
    expect(fills.has(FLASH)).toBe(false);
  });

  it("rings the body in the telegraph colour only during startup", () => {
    expect(cueOf(swing(mob("melee"), "oniSlash", 2)).ring).toBe(TELEGRAPH);
    expect(cueOf(swing(mob("sweeper"), "sweeperSweep", 2)).ring).toBe(
      SWEEP_TELEGRAPH,
    );
    const active = swing(mob("melee"), "oniSlash", ATTACKS.oniSlash.startup);
    expect(cueOf(active).ring).toBeNull();
    expect(cueOf(inState(player, "idle")).ring).toBeNull();
    const unblockable = Object.entries(ATTACKS).find(
      ([, a]) => a.unblockable && a.telegraph,
    );
    expect(unblockable).toBeDefined();
    if (!unblockable) return;
    const red = swing(mob("oniBrute"), unblockable[0], 2);
    expect(cueOf(red, 0).ring).toBe(UNBLOCKABLE);
    expect(cueOf(red, 3).ring).toBe(UNBLOCKABLE);
  });

  it("drops the tint once the swing goes active", () => {
    const e = swing(mob("melee"), "oniSlash", ATTACKS.oniSlash.startup);
    expect(cueOf(e).fill).toBeNull();
  });

  it("squashes the body through a telegraphed windup and lunges on the strike", () => {
    const startup = ATTACKS.bruteSmash.startup;
    const early = cueOf(swing(mob("oniBrute"), "bruteSmash", 1));
    const late = cueOf(swing(mob("oniBrute"), "bruteSmash", startup - 1));
    expect(late.squash).toBeGreaterThan(early.squash);
    expect(late.squash).toBeGreaterThan(0);
    const strike = cueOf(swing(mob("oniBrute"), "bruteSmash", startup));
    expect(strike.lunge).toBeGreaterThan(0);
    expect(strike.squash).toBeLessThan(0);
  });

  it("leaves the ninja's own attack frames unmoved", () => {
    const cue = cueOf(swing(player, "ninjaHit1", 1));
    expect(cue.squash).toBe(0);
    expect(cue.lunge).toBe(0);
  });

  it("outlines the armored brute only while armor is up", () => {
    const startup = cueOf(swing(mob("oniBrute"), "bruteSmash", 1));
    const recovery = cueOf(
      swing(
        mob("oniBrute"),
        "bruteSmash",
        ATTACKS.bruteSmash.startup + ATTACKS.bruteSmash.active,
      ),
    );
    expect(startup.armored).toBe(true);
    expect(recovery.armored).toBe(false);
    expect(cueOf(inState(player, "idle")).armored).toBe(false);
  });

  it("makes a dodging body translucent and fades a corpse", () => {
    expect(cueOf(inState(player, "dodge")).alpha).toBeLessThan(1);
    const fresh = inState(mob("melee"), "dead");
    fresh.combat.stun = COMBAT.death.frames;
    const old = inState(mob("melee"), "dead");
    old.combat.stun = 3;
    expect(cueOf(old).alpha).toBeLessThan(cueOf(fresh).alpha);
  });

  it("blinks the sprite during hurt i-frames", () => {
    const e = inState(player, "idle");
    e.combat.hurtIframes = 20;
    expect(cueOf(e, 0).alpha).toBe(0.55);
    expect(cueOf(e, 3).alpha).toBe(1);
  });
});
