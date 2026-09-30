import { afterEach, describe, expect, it } from "vitest";
import { ATTACKS } from "../data/attacks";
import { KITS } from "../data/kits";
import { createTuning, type Tuning } from "../data/tuning";
import { spawnMob } from "./spawner";
import { dizzyFrames, SPIN_MODIFIERS, type SpinHookContext } from "./spin";
import { enterStun } from "./states";
import { createSim, step } from "./step";
import { entityOfKind, idleInput } from "./testing";
import type { Entity, SimState } from "./types";

const SPIN = KITS.ninja.spin;

interface World {
  state: SimState;
  tuning: Tuning;
  player: Entity;
}

function world(tune?: (t: Tuning) => void): World {
  const tuning = createTuning();
  for (const mob of Object.values(tuning.mobs)) mob.reactionDelay = 1_000_000;
  tune?.(tuning);
  const state = createSim({ seed: 3, tuning });
  state.entities = state.entities.filter((e) => e.kind !== "dummy");
  return { state, tuning, player: entityOfKind(state, "player") };
}

const spinning = idleInput({ spin: true });

function run(
  state: SimState,
  ticks: number,
  input = spinning,
  onTick?: (t: number) => void,
): void {
  for (let t = 0; t < ticks; t++) {
    step(state, input);
    onTick?.(t);
  }
}

describe("spin start and meter", () => {
  it("cannot start below the minimum meter", () => {
    const { state, player } = world();
    player.combat.spinMeter = SPIN.minMeter - 1;
    run(state, 5);
    expect(player.state).not.toBe("spin");
  });

  it("starts at the minimum meter", () => {
    const { state, player } = world();
    player.combat.spinMeter = SPIN.minMeter;
    run(state, 2);
    expect(player.state).toBe("spin");
  });

  it("drains the meter every spinning tick", () => {
    const { state, player } = world();
    player.combat.spinMeter = 100;
    const meter: number[] = [];
    run(state, 10, spinning, () => meter.push(player.combat.spinMeter));
    for (let i = 2; i < meter.length; i++) {
      expect((meter[i - 1] ?? 0) - (meter[i] ?? 0)).toBeCloseTo(
        SPIN.drainPerTick,
      );
    }
  });

  it("ends on release into dizzy", () => {
    const { state, player } = world();
    player.combat.spinMeter = 100;
    run(state, 20);
    expect(player.state).toBe("spin");
    run(state, 1, idleInput());
    expect(player.state).toBe("dizzy");
  });

  it("ends when the meter runs empty even while held", () => {
    const { state, player } = world();
    player.combat.spinMeter = SPIN.minMeter;
    let ended = -1;
    run(state, 200, spinning, (t) => {
      if (ended < 0 && player.state === "dizzy") ended = t;
    });
    expect(ended).toBeGreaterThan(0);
    expect(ended).toBeLessThanOrEqual(
      Math.ceil(SPIN.minMeter / SPIN.drainPerTick) + 2,
    );
    expect(player.combat.spinMeter).toBe(0);
  });

  it("fills from landed hits and not from spin hits", () => {
    const { state, player } = world();
    const mob = spawnMob(state, "melee", {
      x: player.pos.x + 20,
      y: player.pos.y,
    });
    run(state, 8, idleInput({ attack: true }));
    expect(mob.hp).toBeLessThan(mob.maxHp);
    expect(player.combat.spinMeter).toBe(
      createTuning().combat.meters.spinGainPerHit,
    );

    player.combat.spinMeter = 50;
    run(state, 12, spinning);
    expect(player.combat.spinMeter).toBeLessThanOrEqual(50);
  });

  it("steers slower than walking", () => {
    const walk = world();
    const spin = world();
    spin.player.combat.spinMeter = 100;
    run(walk.state, 20, idleInput({ moveX: 1 }));
    run(spin.state, 20, idleInput({ moveX: 1, spin: true }));
    const walked = walk.player.pos.x - 40;
    const spun = spin.player.pos.x - 40;
    expect(spun).toBeGreaterThan(0);
    expect(spun).toBeLessThan(walked * 0.75);
  });
});

describe("spin priority", () => {
  it("wins over block when both are held", () => {
    const { state, player } = world();
    player.combat.spinMeter = 100;
    run(state, 3, idleInput({ block: true, spin: true }));
    expect(player.state).toBe("spin");
  });

  it("preempts an attack and a dodge", () => {
    const a = world();
    a.player.combat.spinMeter = 100;
    run(a.state, 2, idleInput({ attack: true }));
    expect(a.player.state).toBe("attack");
    run(a.state, 1, spinning);
    expect(a.player.state).toBe("spin");
    expect(a.player.combat.attackId).toBeNull();

    const b = world();
    b.player.combat.spinMeter = 100;
    run(b.state, 2, idleInput({ dodge: true }));
    expect(b.player.state).toBe("dodge");
    run(b.state, 1, spinning);
    expect(b.player.state).toBe("spin");
  });

  it("is interrupted by hurt", () => {
    const { state, player } = world();
    player.combat.spinMeter = 100;
    run(state, 3);
    expect(player.state).toBe("spin");
    enterStun(player, "hurt", 10);
    run(state, 1);
    expect(player.state).toBe("hurt");
    expect(player.combat.spinFrame).toBe(0);
  });

  it("is impossible for a kit without a spin", () => {
    const { state, player } = world((t) => {
      const kit = t.kits.ninja;
      if (kit) kit.spin = null;
    });
    player.combat.spinMeter = 100;
    run(state, 10);
    expect(player.state).not.toBe("spin");
  });
});

describe("spin hits", () => {
  const crowd = (tune?: (t: Tuning) => void) => {
    const w = world(tune);
    w.player.combat.spinMeter = 100;
    const mobs = [
      spawnMob(w.state, "melee", { x: w.player.pos.x + 12, y: w.player.pos.y }),
      spawnMob(w.state, "melee", { x: w.player.pos.x - 12, y: w.player.pos.y }),
      spawnMob(w.state, "melee", { x: w.player.pos.x, y: w.player.pos.y + 10 }),
    ];
    for (const m of mobs) {
      m.hp = 1000;
      m.maxHp = 1000;
    }
    return { ...w, mobs };
  };

  it("hits a whole crowd on the re-hit interval", () => {
    const { state, mobs } = crowd((t) => {
      const kit = t.kits.ninja;
      if (kit?.spin) kit.spin.hit.hitstop = 0;
    });
    const hitTicks: number[][] = mobs.map(() => []);
    const last = mobs.map((m) => m.hp);
    run(state, 30, spinning, (t) => {
      mobs.forEach((m, i) => {
        if (m.hp < (last[i] ?? 0)) hitTicks[i]?.push(t);
        last[i] = m.hp;
      });
    });
    for (const ticks of hitTicks) {
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks[0]).toBe(hitTicks[0]?.[0]);
      expect((ticks[1] ?? 0) - (ticks[0] ?? 0)).toBe(SPIN.hitInterval);
    }
    mobs.forEach((m, i) => {
      expect(m.hp).toBe(1000 - SPIN.hit.damage * (hitTicks[i]?.length ?? 0));
    });
  });

  it("knocks targets away from the spinner", () => {
    const { state, player, mobs } = crowd();
    const before = mobs.map((m) => Math.abs(m.pos.x - player.pos.x));
    run(state, 12);
    const first = mobs[0];
    expect(first && Math.abs(first.pos.x - player.pos.x)).toBeGreaterThan(
      before[0] ?? 0,
    );
  });

  it("still lands hits with default hitstop", () => {
    const { state, mobs } = crowd();
    run(state, 40);
    for (const m of mobs) {
      expect(m.hp).toBeLessThan(1000 - SPIN.hit.damage);
    }
  });
});

describe("spin deflect", () => {
  const shooter = (tune?: (t: Tuning) => void) => {
    const w = world(tune);
    w.player.combat.spinMeter = 100;
    for (const mob of Object.values(w.tuning.mobs)) {
      mob.reactionDelay = 0;
      mob.reactionJitter = 0;
    }
    const mob = spawnMob(w.state, "ranged", {
      x: w.player.pos.x + 80,
      y: w.player.pos.y,
    });
    mob.ai = mob.ai && { ...mob.ai, timer: 0 };
    return { ...w, mob };
  };

  it("sends the bolt straight back and hits the shooter", () => {
    const { state, player, mob } = shooter();
    let deflected = false;
    let reversed = false;
    run(state, 170, spinning, () => {
      for (const p of state.projectiles) {
        if (p.deflected && !deflected) {
          deflected = true;
          reversed = p.vel.x > 0 && p.vel.y === 0 && p.faction === "ninja";
        }
      }
    });
    expect(deflected).toBe(true);
    expect(reversed).toBe(true);
    expect(mob.hp).toBeLessThan(mob.maxHp);
    expect(player.hp).toBe(100);
  });

  it("does not deflect when the kit turns it off", () => {
    const { state, player, mob } = shooter((t) => {
      const kit = t.kits.ninja;
      if (kit?.spin) kit.spin.deflect = false;
    });
    run(state, 170, spinning);
    expect(mob.hp).toBe(mob.maxHp);
    expect(player.hp).toBeLessThan(100);
  });
});

describe("dizzy", () => {
  const dizzyAfter = (spinTicks: number): { stun: number; w: World } => {
    const w = world();
    w.player.combat.spinMeter = 100;
    run(w.state, spinTicks);
    run(w.state, 1, idleInput());
    return { stun: w.player.combat.stun, w };
  };

  it("lasts longer the longer the spin", () => {
    const short = dizzyAfter(20);
    const long = dizzyAfter(80);
    expect(short.w.player.state).toBe("dizzy");
    expect(long.stun).toBeGreaterThan(short.stun);
  });

  it("follows base plus per-second and caps at max", () => {
    const { stun } = dizzyAfter(60);
    expect(stun).toBe(dizzyFrames(SPIN, 59));
    expect(dizzyFrames(SPIN, 100_000)).toBe(SPIN.dizzy.max);
    expect(dizzyFrames(SPIN, 0)).toBe(SPIN.dizzy.base);
  });

  it("cannot act while dizzy and recovers", () => {
    const { w } = dizzyAfter(20);
    const { state, player } = w;
    const x = player.pos.x;
    run(
      state,
      5,
      idleInput({ moveX: 1, attack: true, dodge: true, block: true }),
    );
    expect(player.state).toBe("dizzy");
    expect(player.pos.x).toBe(x);
    run(state, 200, idleInput());
    expect(player.state).toBe("idle");
  });

  it("leaves the dizzy player open to hits", () => {
    const w = world((t) => {
      const grunt = t.mobs.melee;
      if (grunt) {
        grunt.reactionDelay = 0;
        grunt.reactionJitter = 0;
      }
    });
    const { state, player } = w;
    player.combat.spinMeter = 100;
    run(state, 20);
    run(state, 1, idleInput());
    expect(player.state).toBe("dizzy");
    spawnMob(state, "melee", { x: player.pos.x + 14, y: player.pos.y });
    run(state, 120, idleInput());
    expect(player.hp).toBeLessThan(100);
  });
});

describe("spin hooks", () => {
  afterEach(() => {
    delete SPIN_MODIFIERS.probe;
  });

  it("runs onSpinTick while spinning and onSpinEnd once", () => {
    const ticks: number[] = [];
    let ends = 0;
    SPIN_MODIFIERS.probe = {
      onSpinTick: (ctx: SpinHookContext) => ticks.push(ctx.spinFrame),
      onSpinEnd: () => {
        ends += 1;
      },
    };
    const { state, player } = world((t) => {
      const spin = t.kits.ninja?.spin;
      if (spin) {
        spin.onSpinTick = [{ id: "probe", params: {} }];
        spin.onSpinEnd = [{ id: "probe", params: {} }];
      }
    });
    player.combat.spinMeter = 100;
    run(state, 10);
    run(state, 1, idleInput());
    expect(ticks.length).toBeGreaterThan(5);
    expect(ticks[0]).toBe(1);
    expect(ends).toBe(1);
  });

  it("starts with no modifiers and rejects unknown ids", () => {
    expect(SPIN.onSpinTick).toHaveLength(0);
    expect(SPIN.onSpinEnd).toHaveLength(0);
    const { state, player } = world((t) => {
      const spin = t.kits.ninja?.spin;
      if (spin) spin.onSpinTick = [{ id: "missing", params: {} }];
    });
    player.combat.spinMeter = 100;
    expect(() => run(state, 5)).toThrow(/Unknown spin modifier/);
  });
});

describe("spin data", () => {
  it("keeps attack data for deflected bolts reachable", () => {
    expect(ATTACKS.oniBolt.projectile).toBe("oniBolt");
  });
});
