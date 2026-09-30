import { describe, expect, it } from "vitest";
import { ATTACKS } from "../data/attacks";
import { COMBAT } from "../data/combat";
import { KITS } from "../data/kits";
import { PROJECTILES } from "../data/projectiles";
import { createTuning, type Tuning } from "../data/tuning";
import { jumpHeight } from "./jump";
import { spawnMob } from "./spawner";
import { enterStun } from "./states";
import { createSim, step } from "./step";
import { entityOfKind, forceAttack, idleInput } from "./testing";
import type { ActionFrame, Entity, SimState } from "./types";

const JUMP = KITS.ninja.jump;
const PLAYER_AT = { x: 120, y: 80 };

interface World {
  state: SimState;
  tuning: Tuning;
  player: Entity;
}

// Mobs never decide anything on their own, so the tests place every swing.
function world(tune?: (t: Tuning) => void): World {
  const tuning = createTuning();
  for (const mob of Object.values(tuning.mobs)) mob.reactionDelay = 1_000_000;
  tune?.(tuning);
  const state = createSim({ seed: 4, tuning });
  state.entities = state.entities.filter((e) => e.kind !== "dummy");
  const player = entityOfKind(state, "player");
  player.pos = { ...PLAYER_AT };
  return { state, tuning, player };
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

const jumpAt =
  (tick: number, rest: Partial<ActionFrame> = {}) =>
  (t: number): Partial<ActionFrame> => ({ ...rest, jump: t === tick });

// The stick only matters on the tick the dodge starts; holding it earlier would walk the player out of range first.
const dodgeAt =
  (tick: number, dir: Partial<ActionFrame>) =>
  (t: number): Partial<ActionFrame> =>
    t === tick ? { ...dir, dodge: true } : {};

function immortal(e: Entity): void {
  e.hp = 1_000_000;
  e.maxHp = 1_000_000;
}

function bolt(at: Entity["pos"], life: number) {
  return {
    id: 99,
    kind: "oniBolt",
    ownerId: 50,
    faction: "oni" as const,
    pos: { ...at },
    vel: { x: 0, y: 0 },
    life,
    spent: [],
    deflected: false,
  };
}

describe("jump arc", () => {
  it("rises and falls on a parabola over the data's frames", () => {
    const { state, player } = world();
    const zs: number[] = [];
    run(state, JUMP.frames + JUMP.landingRecovery + 2, jumpAt(0), () =>
      zs.push(player.z),
    );
    expect(zs[0]).toBe(0);
    expect(Math.max(...zs)).toBeCloseTo(JUMP.peakHeight, 5);
    expect(zs.indexOf(Math.max(...zs))).toBe(JUMP.frames / 2);
    expect(zs[JUMP.frames]).toBe(0);
    for (let f = 1; f < JUMP.frames; f++) {
      expect(zs[f]).toBeCloseTo(jumpHeight(JUMP, f), 9);
      expect(zs[f]).toBeGreaterThan(0);
    }
  });

  it("holds the state through the landing recovery, then frees the player", () => {
    const { state, player } = world();
    const states: string[] = [];
    run(state, JUMP.frames + JUMP.landingRecovery + 2, jumpAt(0), () =>
      states.push(player.state),
    );
    const last = JUMP.frames + JUMP.landingRecovery;
    for (let t = 0; t < last; t++) expect(states[t]).toBe("jump");
    expect(states[last]).toBe("idle");
    expect(player.z).toBe(0);
  });

  it("keeps the feet on the ground plane when standing still", () => {
    const { state, player } = world();
    run(state, JUMP.frames, jumpAt(0));
    expect(player.pos).toEqual(PLAYER_AT);
  });

  it("steers at the air scale and freezes during the landing recovery", () => {
    const { state, player } = world();
    run(state, JUMP.frames, (t) => ({ moveX: 1, jump: t === 0 }));
    const speed = KITS.ninja.moveSpeed * JUMP.airSteerScale;
    expect(player.pos.x - PLAYER_AT.x).toBeCloseTo(
      (speed * JUMP.frames) / 60,
      5,
    );
    const landedX = player.pos.x;
    run(state, JUMP.landingRecovery - 1, () => ({ moveX: 1 }));
    expect(player.state).toBe("jump");
    expect(player.pos.x).toBe(landedX);
  });

  it("still collides with walls while in the air", () => {
    const { state, player } = world();
    player.pos = { x: 24, y: 80 };
    run(state, JUMP.frames, (t) => ({ moveX: -1, jump: t === 0 }));
    const wallEdge = state.arena.tileSize;
    expect(player.pos.x).toBeGreaterThanOrEqual(wallEdge + player.feet.w / 2);
  });

  it("can start from an attack swing", () => {
    const { state, player } = world();
    run(state, 3, (t) => ({ attack: t === 0, jump: t === 2 }));
    expect(player.state).toBe("jump");
    expect(player.combat.attackId).toBeNull();
  });
});

describe("no actions mid-air", () => {
  it("ignores attack, block, dodge and spin until the landing recovery ends", () => {
    const { state, player } = world();
    player.combat.spinMeter = 100;
    const end = JUMP.frames + JUMP.landingRecovery;
    run(
      state,
      end,
      (t) => ({
        jump: t === 0,
        attack: t % 2 === 0 && t > 0,
        dodge: t % 3 === 0 && t > 0,
        block: t > 0,
        spin: t > 0,
      }),
      () => {
        expect(player.state).toBe("jump");
        expect(player.combat.attackId).toBeNull();
      },
    );
    expect(player.combat.spinMeter).toBe(100);
  });

  it.each([
    [
      "spin",
      (p: Entity) => {
        p.combat.spinMeter = 100;
      },
    ],
    ["dizzy", (p: Entity) => enterStun(p, "dizzy", 30)],
    ["hurt", (p: Entity) => enterStun(p, "hurt", 30)],
    ["stagger", (p: Entity) => enterStun(p, "stagger", 30)],
    ["guardBreak", (p: Entity) => enterStun(p, "guardBreak", 30)],
  ])("cannot start from %s", (name, setup) => {
    const { state, player } = world();
    setup(player);
    run(state, 6, (t) => ({ spin: name === "spin", jump: t === 2 }));
    expect(player.state).toBe(name);
    expect(player.z).toBe(0);
  });

  it("cannot start from a dodge", () => {
    const { state, player } = world();
    run(state, 6, (t) => ({ dodge: t === 0, jump: t === 2 }));
    expect(player.state).toBe("dodge");
    expect(player.z).toBe(0);
  });

  it("gives a kit without jump data no jump", () => {
    const { state, player } = world((t) => {
      const kit = t.kits.ninja;
      if (kit) kit.jump = null;
    });
    run(state, 4, jumpAt(0));
    expect(player.state).not.toBe("jump");
  });
});

describe("airborne targets", () => {
  const groundedMelee = Object.entries(ATTACKS).filter(
    ([, a]) => !a.hitsAir && !("projectile" in a),
  );

  // The attacker stands 12 px right of the player, facing left. The swing is
  // placed directly so the test is about the hit rule, not the AI.
  function swing(attackId: string, z: number): Entity {
    const { state, player } = world();
    immortal(player);
    player.z = z;
    const mob = spawnMob(state, "melee", {
      x: PLAYER_AT.x + 12,
      y: PLAYER_AT.y,
    });
    forceAttack(mob, attackId, { x: -1, y: 0 });
    run(state, 90);
    return player;
  }

  it.each(groundedMelee)("%s connects with a grounded target", (id) => {
    expect(swing(id, 0).hp).toBeLessThan(1_000_000);
  });

  it.each(groundedMelee)("%s misses an airborne target", (id) => {
    expect(swing(id, JUMP.peakHeight).hp).toBe(1_000_000);
  });

  it("does not count a height at the threshold as airborne", () => {
    expect(swing("oniSlash", COMBAT.airborneZ).hp).toBeLessThan(1_000_000);
  });

  it("lets a hitsAir attack through", () => {
    expect(ATTACKS.bruteCrush.hitsAir).toBe(true);
    expect(swing("bruteCrush", JUMP.peakHeight).hp).toBeLessThan(1_000_000);
  });

  it("lets a projectile hit an airborne target and knocks it to the ground", () => {
    const { state, player } = world();
    run(state, 12, jumpAt(0));
    expect(player.z).toBeGreaterThan(COMBAT.airborneZ);
    state.projectiles.push(bolt(player.pos, 100));
    run(state, 1);
    expect(player.hp).toBe(100 - ATTACKS.oniBolt.damage);
    expect(player.state).toBe("hurt");
    expect(player.z).toBe(0);
  });

  it("makes a projectile ignore a jumper when its data says so", () => {
    const { state, player } = world((t) => {
      const data = t.projectiles.oniBolt;
      if (data) data.hitsAir = false;
    });
    run(state, 12, jumpAt(0));
    state.projectiles.push(bolt(player.pos, 5));
    run(state, 1);
    expect(player.hp).toBe(100);
  });
});

describe("attack data flags", () => {
  const airHitters = new Set(["oniBolt", "bruteCrush"]);

  it("lets only projectiles and the forced-dodge attack hit the air", () => {
    for (const [id, attack] of Object.entries(ATTACKS)) {
      expect(attack.hitsAir, id).toBe(airHitters.has(id));
    }
    for (const p of Object.values(PROJECTILES)) expect(p.hitsAir).toBe(true);
  });

  it("never lets a ground attack hit the air", () => {
    for (const [id, attack] of Object.entries(ATTACKS)) {
      if (attack.ground) expect(attack.hitsAir, id).toBe(false);
    }
  });
});

describe("sweep constraint", () => {
  const dodgeTravel = (COMBAT.dodge.speed * COMBAT.dodge.duration) / 60;
  const sweeps = Object.entries(ATTACKS).filter(([, a]) => a.sweep);

  it("has sweeps to check", () => {
    expect(sweeps.map(([id]) => id)).toEqual(["sweeperSweep", "bruteSweep"]);
  });

  it.each(sweeps)(
    "%s outlasts a dodge's i-frames or outreaches its travel",
    (_id, sweep) => {
      const reach = sweep.hitbox.offset + sweep.hitbox.length / 2;
      const outlasts = sweep.active > COMBAT.dodge.iframes;
      const outreaches = reach > dodgeTravel;
      expect(outlasts || outreaches).toBe(true);
    },
  );

  it.each(sweeps)(
    "%s is a blockable, telegraphed ground attack",
    (_id, sweep) => {
      expect(sweep.ground).toBe(true);
      expect(sweep.hitsAir).toBe(false);
      expect(sweep.unblockable).toBe(false);
      expect(sweep.telegraph).toBe(true);
    },
  );
});

describe("sweeper scenarios", () => {
  const SWEEP = ATTACKS.sweeperSweep;
  // attackFrame reaches `startup` on the tick with this index, and hits resolve
  // on that same tick.
  const FIRST_ACTIVE = SWEEP.startup - 1;
  const total = SWEEP.startup + SWEEP.active + 4;

  function sweeperFight(): World {
    const w = world();
    const mob = spawnMob(w.state, "sweeper", {
      x: PLAYER_AT.x + 28,
      y: PLAYER_AT.y,
    });
    forceAttack(mob, "sweeperSweep", { x: -1, y: 0 });
    return w;
  }

  it("hits a player who does nothing", () => {
    const { state, player } = sweeperFight();
    run(state, total);
    expect(player.hp).toBe(100 - SWEEP.damage);
  });

  it("is avoided by a jump", () => {
    const { state, player } = sweeperFight();
    run(state, total, jumpAt(FIRST_ACTIVE - 10));
    expect(player.hp).toBe(100);
  });

  it("is survived by a block, which pays in guard", () => {
    const { state, player } = sweeperFight();
    run(state, total, () => ({ block: true }));
    expect(player.hp).toBe(100);
    expect(player.combat.guard).toBeLessThan(COMBAT.block.guardMax);
  });

  const directions = [
    ["away", { moveX: -1, moveY: 0 }],
    ["toward", { moveX: 1, moveY: 0 }],
    ["up", { moveX: 0, moveY: -1 }],
    ["down", { moveX: 0, moveY: 1 }],
  ] as const;

  it.each(directions)(
    "still hits a dodge %s started at the first active frame",
    (_name, dir) => {
      const { state, player } = sweeperFight();
      run(state, total, dodgeAt(FIRST_ACTIVE, dir));
      expect(player.hp).toBe(100 - SWEEP.damage);
    },
  );

  it.each(directions)(
    "still hits a dodge %s started anywhere near the active window",
    (_name, dir) => {
      for (let start = FIRST_ACTIVE - 8; start <= FIRST_ACTIVE + 4; start++) {
        const { state, player } = sweeperFight();
        run(state, total, dodgeAt(start, dir));
        expect(player.hp, `dodge at ${start}`).toBe(100 - SWEEP.damage);
      }
    },
  );

  it("gives a dodge no perfect-dodge counter against a sweep", () => {
    const { state, player } = sweeperFight();
    let counterSeen = false;
    run(state, total, dodgeAt(FIRST_ACTIVE, { moveX: -1 }), () => {
      if (player.combat.counterWindow > 0) counterSeen = true;
    });
    expect(counterSeen).toBe(false);
  });
});

describe("determinism with jump", () => {
  const inputs = Array.from({ length: 600 }, (_, i) =>
    idleInput({
      moveX: Math.sin(i / 9),
      moveY: Math.cos(i / 13),
      attack: i % 7 < 2,
      dodge: i % 41 === 0,
      jump: i % 53 === 0,
      block: i % 97 < 20,
    }),
  );
  const make = (): SimState => {
    const state = createSim({ seed: 21 });
    spawnMob(state, "sweeper", { x: 150, y: 70 });
    return state;
  };

  it("reproduces identical state from the same seed and inputs", () => {
    const a = make();
    const b = make();
    for (const input of inputs) {
      step(a, input);
      step(b, input);
    }
    expect(a).toEqual(b);
  });
});
