import { describe, expect, it } from "vitest";
import { ATTACKS } from "../data/attacks";
import { COMBAT } from "../data/combat";
import { KITS } from "../data/kits";
import { MOBS, WAVES } from "../data/mobs";
import { createTuning, type Tuning } from "../data/tuning";
import { pickMove } from "./mobAi";
import { spawnMob, spawnWave } from "./spawner";
import { createSim, step } from "./step";
import { entityOfKind, forceAttack, idleInput } from "./testing";
import { holdsToken, tryAcquireToken } from "./tokens";
import type { ActionFrame, Entity, SimState } from "./types";

const BRUTE = KITS.oniBrute;
const PLAYER_AT = { x: 120, y: 80 };

interface World {
  state: SimState;
  tuning: Tuning;
  player: Entity;
  brute: Entity;
}

// The brute stands still unless a test says otherwise; `eager` turns the AI on.
function world(opts: { eager?: boolean; gap?: number } = {}): World {
  const tuning = createTuning();
  for (const mob of Object.values(tuning.mobs)) {
    mob.reactionDelay = opts.eager ? 0 : 1_000_000;
    mob.reactionJitter = 0;
  }
  const state = createSim({ seed: 8, tuning });
  state.entities = state.entities.filter((e) => e.kind !== "dummy");
  const player = entityOfKind(state, "player");
  player.pos = { ...PLAYER_AT };
  const brute = spawnMob(state, "oniBrute", {
    x: PLAYER_AT.x + (opts.gap ?? 18),
    y: PLAYER_AT.y,
  });
  return { state, tuning, player, brute };
}

function run(
  state: SimState,
  ticks: number,
  script: (t: number) => Partial<ActionFrame> = () => ({}),
  onTick?: (t: number) => void,
): void {
  for (let t = 0; t < ticks; t++) {
    step(state, idleInput(script(t)));
    onTick?.(t);
  }
}

const immortal = (e: Entity): void => {
  e.hp = 1_000_000;
  e.maxHp = 1_000_000;
};

// The stick only matters on the tick the dodge starts.
const dodgeAt =
  (tick: number, dir: Partial<ActionFrame>) =>
  (t: number): Partial<ActionFrame> =>
    t === tick ? { ...dir, dodge: true } : {};

const swing = (brute: Entity, id: string): void =>
  forceAttack(brute, id, { x: -1, y: 0 });

// attackFrame reaches `startup` on this tick index, and hits resolve that tick.
const firstActive = (id: keyof typeof ATTACKS): number =>
  ATTACKS[id].startup - 1;

describe("brute data", () => {
  it("is a slow, long-health oni with a boss bar and a heavy token", () => {
    expect(BRUTE.maxHp).toBeGreaterThan(KITS.oniGrunt.maxHp * 10);
    expect(BRUTE.moveSpeed).toBeLessThan(KITS.oniGrunt.moveSpeed);
    expect(MOBS.oniBrute.bossBar).toBe(true);
    expect(MOBS.oniBrute.tokenWeight).toBeGreaterThan(MOBS.melee.tokenWeight);
    expect(MOBS.oniBrute.tokenWeight).toBeLessThanOrEqual(COMBAT.tokens.max);
  });

  it("has armor that is strongest against spin", () => {
    const armor = BRUTE.armor;
    expect(armor).not.toBeNull();
    expect(armor?.attackDamageScale).toBeLessThan(1);
    expect(armor?.spinDamageScale).toBeLessThan(1);
  });

  it("only picks moves from its own attack list, all telegraphed", () => {
    for (const id of Object.keys(MOBS.oniBrute.moves)) {
      expect(BRUTE.comboAttacks).toContain(id);
      expect(ATTACKS[id as keyof typeof ATTACKS].telegraph).toBe(true);
    }
    for (const id of BRUTE.comboAttacks) {
      expect(MOBS.oniBrute.moves).toHaveProperty(id);
    }
  });

  it("gives the slam the spin-punish shape", () => {
    const slam = ATTACKS.bruteSlam;
    expect(slam.ground).toBe(true);
    expect(slam.hitsAir).toBe(false);
    expect(slam.spinBreakStun).toBeGreaterThan(COMBAT.counter.staggerFrames);
    expect(slam.hitbox.length).toBeGreaterThan(
      ATTACKS.bruteSmash.hitbox.length,
    );
    const { moves } = MOBS.oniBrute;
    for (const [id, move] of Object.entries(moves)) {
      if (id === "bruteSlam") continue;
      expect(moves.bruteSlam.spinWeight).toBeGreaterThan(move.spinWeight * 5);
    }
  });

  it("gives the crush the forced-dodge shape", () => {
    const crush = ATTACKS.bruteCrush;
    expect(crush.unblockable).toBe(true);
    expect(crush.hitsAir).toBe(true);
    expect(crush.active).toBeLessThanOrEqual(COMBAT.dodge.iframes);
  });
});

describe("brute armor", () => {
  // The player stands at the brute's front and swings the opening hit.
  const PLAYER_HIT_TICK = ATTACKS.ninjaHit1.startup;

  it("takes reduced damage and no flinch from a hit during its attack", () => {
    const { state, brute } = world();
    swing(brute, "bruteSmash");
    run(state, PLAYER_HIT_TICK + 1, (t) => ({ attack: t === 0 }));
    const scale = BRUTE.armor?.attackDamageScale ?? 1;
    expect(brute.hp).toBe(BRUTE.maxHp - ATTACKS.ninjaHit1.damage * scale);
    expect(brute.state).toBe("attack");
    expect(brute.combat.knock).toEqual({ x: 0, y: 0 });
    expect(brute.combat.stun).toBe(0);
  });

  it("keeps its swing going while it is being hit", () => {
    const { state, brute } = world();
    swing(brute, "bruteSmash");
    run(state, 8, (t) => ({ attack: t === 0 }));
    expect(brute.state).toBe("attack");
    expect(brute.combat.attackId).toBe("bruteSmash");
  });

  it("takes full damage and staggers briefly when hit outside an attack", () => {
    const { state, brute } = world();
    run(state, PLAYER_HIT_TICK + 1, (t) => ({ attack: t === 0 }));
    expect(brute.hp).toBe(BRUTE.maxHp - ATTACKS.ninjaHit1.damage);
    expect(brute.state).toBe("hurt");
    expect(brute.combat.stun).toBe(BRUTE.hurtStun);
    expect(Math.abs(brute.combat.knock.x)).toBeGreaterThan(0);
  });

  it("is hittable at full damage during its recovery", () => {
    const { state, brute } = world();
    swing(brute, "bruteSmash");
    const recovery = ATTACKS.bruteSmash.startup + ATTACKS.bruteSmash.active + 1;
    brute.combat.attackFrame = recovery;
    run(state, PLAYER_HIT_TICK + 1, (t) => ({ attack: t === 0 }));
    expect(brute.hp).toBe(BRUTE.maxHp - ATTACKS.ninjaHit1.damage);
    expect(brute.state).toBe("hurt");
  });

  it("takes reduced spin damage and never flinches, even when idle", () => {
    const { state, player, brute } = world();
    player.combat.spinMeter = 100;
    run(state, 1, () => ({ spin: true }));
    expect(player.state).toBe("spin");
    const scale = BRUTE.armor?.spinDamageScale ?? 1;
    expect(brute.hp).toBe(BRUTE.maxHp - KITS.ninja.spin.hit.damage * scale);
    expect(brute.state).not.toBe("hurt");
    expect(brute.combat.knock).toEqual({ x: 0, y: 0 });
    expect(brute.combat.stun).toBe(0);
  });

  it("can still be killed", () => {
    const { state, brute } = world();
    brute.hp = 1;
    run(state, PLAYER_HIT_TICK + 1, (t) => ({ attack: t === 0 }));
    expect(brute.state).toBe("dead");
  });

  it("can be parried out of its swing despite the armor", () => {
    const { state, player, brute } = world();
    swing(brute, "bruteSmash");
    const hit = firstActive("bruteSmash");
    run(state, hit + 1, (t) => ({ block: t >= hit - 2 }));
    expect(player.hp).toBe(100);
    expect(brute.state).toBe("stagger");
  });
});

describe("brute slam", () => {
  const SLAM = ATTACKS.bruteSlam;

  it("breaks a spin and stuns for the data's duration", () => {
    const { state, player, brute } = world({ gap: 16 });
    player.combat.spinMeter = 100;
    swing(brute, "bruteSlam");
    let stunned = false;
    let bruteInterrupted = false;
    run(
      state,
      SLAM.startup + 60,
      () => ({ spin: !stunned }),
      () => {
        if (brute.state !== "attack" && !stunned) bruteInterrupted = true;
        if (player.state === "dizzy" && !stunned) {
          stunned = true;
          expect(player.combat.stun).toBe(SLAM.spinBreakStun);
          expect(player.combat.spinFrame).toBe(0);
          expect(player.hp).toBe(100 - SLAM.damage);
        }
      },
    );
    expect(stunned).toBe(true);
    // The armor is what lets the slam land: a spin cannot interrupt it.
    expect(bruteInterrupted).toBe(false);
  });

  it("is an ordinary hit on a target that is not spinning", () => {
    const { state, player, brute } = world({ gap: 16 });
    swing(brute, "bruteSlam");
    run(state, SLAM.startup + 2);
    expect(player.state).toBe("hurt");
    expect(player.combat.stun).toBeGreaterThan(0);
    expect(player.combat.stun).toBeLessThan(SLAM.spinBreakStun);
  });

  it("is dodged by i-frames and jumped over", () => {
    const dodge = world({ gap: 16 });
    swing(dodge.brute, "bruteSlam");
    run(dodge.state, SLAM.startup + 10, (t) => ({
      dodge: t === firstActive("bruteSlam") - 2,
    }));
    expect(dodge.player.hp).toBe(100);

    const jump = world({ gap: 16 });
    swing(jump.brute, "bruteSlam");
    run(jump.state, SLAM.startup + 10, (t) => ({
      jump: t === firstActive("bruteSlam") - 10,
    }));
    expect(jump.player.hp).toBe(100);
  });
});

describe("brute move choice", () => {
  const picks = (target: Entity, brute: Entity, state: SimState) => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 400; i++) {
      const id = pickMove(state, brute, MOBS.oniBrute, target) ?? "none";
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  };

  it("prefers the slam when the target is spinning", () => {
    const { state, player, brute } = world({ gap: 30 });
    player.state = "spin";
    const counts = picks(player, brute, state);
    expect(counts.bruteSlam ?? 0).toBeGreaterThan(400 * 0.7);
  });

  it("mixes its moves when the target is not spinning", () => {
    const { state, player, brute } = world({ gap: 30 });
    const counts = picks(player, brute, state);
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(3);
    expect(counts.bruteSlam ?? 0).toBeLessThan(400 * 0.4);
  });

  it("skips moves that do not fit the distance", () => {
    const { state, player, brute } = world({ gap: 60 });
    expect(MOBS.oniBrute.moves.bruteSmash.pickMaxDist).toBeLessThan(60);
    expect(picks(player, brute, state).bruteSmash).toBeUndefined();
  });

  it("commits to the slam against a spinner in a live fight", () => {
    const { state, player, brute } = world({ eager: true, gap: 40 });
    immortal(player);
    player.combat.spinMeter = 100;
    let chosen: string | null = null;
    run(
      state,
      400,
      () => ({ spin: true }),
      () => {
        if (chosen === null && brute.state === "attack") {
          chosen = brute.combat.attackId;
        }
      },
    );
    expect(chosen).toBe("bruteSlam");
  });

  it("varies its attacks against a player who does not spin", () => {
    const { state, player, brute } = world({ eager: true, gap: 40 });
    immortal(player);
    const seen = new Set<string>();
    run(
      state,
      4000,
      () => ({}),
      () => {
        if (brute.state === "attack" && brute.combat.attackId !== null) {
          seen.add(brute.combat.attackId);
        }
      },
    );
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe("brute token", () => {
  it("fills the shared pool so nothing attacks alongside it", () => {
    const { state, brute } = world();
    const grunt = spawnMob(state, "melee", { x: 60, y: 40 });
    expect(tryAcquireToken(state, brute, MOBS.oniBrute.tokenWeight)).toBe(true);
    expect(tryAcquireToken(state, grunt, MOBS.melee.tokenWeight)).toBe(false);
    expect(holdsToken(state, brute)).toBe(true);
  });
});

describe("brute unblockable", () => {
  const CRUSH = ATTACKS.bruteCrush;
  const HIT = firstActive("bruteCrush");

  it("goes through a block and drains no guard", () => {
    const { state, player, brute } = world();
    swing(brute, "bruteCrush");
    run(state, HIT + 2, () => ({ block: true }));
    expect(player.hp).toBe(100 - CRUSH.damage);
    expect(player.combat.guard).toBe(COMBAT.block.guardMax);
  });

  it("is avoided by a dodge anywhere its active frames can be covered", () => {
    for (let start = HIT - 4; start <= HIT; start++) {
      const { state, player, brute } = world();
      swing(brute, "bruteCrush");
      run(state, HIT + 12, dodgeAt(start, { moveX: -1 }));
      expect(player.hp, `dodge at ${start}`).toBe(100);
    }
  });

  it("rewards a perfect dodge with a counter window", () => {
    const { state, player, brute } = world();
    swing(brute, "bruteCrush");
    run(state, HIT + 1, (t) => ({ dodge: t === HIT - 2 }));
    expect(player.combat.counterWindow).toBeGreaterThan(0);
  });

  it("hits a jumper, because it hits the air", () => {
    const { state, player, brute } = world();
    swing(brute, "bruteCrush");
    run(state, HIT + 2, (t) => ({ jump: t === HIT - 10 }));
    expect(player.hp).toBe(100 - CRUSH.damage);
    expect(player.z).toBe(0);
  });
});

describe("brute sweep", () => {
  const SWEEP = ATTACKS.bruteSweep;
  const HIT = firstActive("bruteSweep");
  const total = SWEEP.startup + SWEEP.active + 4;
  const fight = (): World => {
    const w = world({ gap: 28 });
    swing(w.brute, "bruteSweep");
    return w;
  };

  it("hits a player who does nothing", () => {
    const { state, player } = fight();
    run(state, total);
    expect(player.hp).toBe(100 - SWEEP.damage);
  });

  it("is beaten by a block", () => {
    const { state, player } = fight();
    run(state, total, () => ({ block: true }));
    expect(player.hp).toBe(100);
    expect(player.combat.guard).toBe(COMBAT.block.guardMax - SWEEP.guardDamage);
  });

  it("is beaten by a jump", () => {
    const { state, player } = fight();
    run(state, total, (t) => ({ jump: t === HIT - 10 }));
    expect(player.hp).toBe(100);
  });

  it("is not beaten by a dodge at its first active frame", () => {
    const { state, player } = fight();
    run(state, total, dodgeAt(HIT, { moveX: -1 }));
    expect(player.hp).toBe(100 - SWEEP.damage);
  });
});

describe("F4 brute wave", () => {
  it("spawns one brute with a full health bar", () => {
    const state = createSim({ seed: 2 });
    const spawned = spawnWave(state, WAVES[1]);
    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.mobType).toBe("oniBrute");
    expect(spawned[0]?.hp).toBe(BRUTE.maxHp);
    expect(spawned[0]?.faction).toBe("oni");
  });
});

describe("determinism with jump and a brute", () => {
  const inputs = Array.from({ length: 900 }, (_, i) =>
    idleInput({
      moveX: Math.sin(i / 11),
      moveY: Math.cos(i / 17),
      attack: i % 9 < 2,
      dodge: i % 53 === 0,
      jump: i % 61 === 0,
      block: i % 101 < 15,
      spin: i % 160 > 120,
    }),
  );
  const make = (seed: number): SimState => {
    const state = createSim({ seed });
    spawnWave(state, WAVES[1]);
    spawnWave(state, WAVES[0]);
    return state;
  };

  it("reproduces identical state from the same seed", () => {
    const a = make(31);
    const b = make(31);
    for (const input of inputs) {
      step(a, input);
      step(b, input);
    }
    expect(a).toEqual(b);
  });

  it("survives a JSON round trip mid-fight", () => {
    const a = make(32);
    for (const input of inputs.slice(0, 400)) step(a, input);
    const restored: SimState = JSON.parse(JSON.stringify(a));
    for (const input of inputs.slice(400)) {
      step(a, input);
      step(restored, input);
    }
    expect(restored).toEqual(a);
  });
});
