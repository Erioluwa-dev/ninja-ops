import { describe, expect, it } from "vitest";
import { ATTACKS } from "../data/attacks";
import { KITS } from "../data/kits";
import { MOBS } from "../data/mobs";
import { createTuning, type Tuning } from "../data/tuning";
import { attackPhase, currentAttack } from "./attack";
import { spawnMob, spawnWave } from "./spawner";
import { enterStun } from "./states";
import { createSim, step } from "./step";
import { entityOfKind, idleInput } from "./testing";
import {
  holdsToken,
  tokenCapacity,
  tokensInUse,
  tryAcquireToken,
} from "./tokens";
import type { Entity, SimState } from "./types";

interface World {
  state: SimState;
  tuning: Tuning;
  player: Entity;
}

function world(tune?: (t: Tuning) => void): World {
  const tuning = createTuning();
  tune?.(tuning);
  const state = createSim({ seed: 5, tuning });
  state.entities = state.entities.filter((e) => e.kind !== "dummy");
  const player = entityOfKind(state, "player");
  return { state, tuning, player };
}

const immortal = (player: Entity): void => {
  player.hp = 1_000_000;
  player.maxHp = 1_000_000;
};

const eager = (t: Tuning): void => {
  for (const mob of Object.values(t.mobs)) {
    mob.reactionDelay = 0;
    mob.reactionJitter = 0;
  }
};

// Never decides anything, so it stays put as a target.
const inert = (t: Tuning): void => {
  for (const mob of Object.values(t.mobs)) mob.reactionDelay = 1_000_000;
};

const run = (
  state: SimState,
  ticks: number,
  input = idleInput(),
  onTick?: (t: number) => void,
): void => {
  for (let t = 0; t < ticks; t++) {
    step(state, input);
    onTick?.(t);
  }
};

describe("mob data", () => {
  it("makes every mob attack telegraphed with a readable windup", () => {
    for (const mob of Object.values(MOBS)) {
      for (const id of KITS[mob.kitId].comboAttacks) {
        const attack = ATTACKS[id as keyof typeof ATTACKS];
        expect(attack.telegraph).toBe(true);
        expect(attack.startup).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("keeps melee mobs at one to three hits from the ninja combo", () => {
    const hits = [
      ATTACKS.ninjaHit1.damage,
      ATTACKS.ninjaHit2.damage,
      ATTACKS.ninjaHit3.damage,
    ];
    let hp: number = KITS.oniGrunt.maxHp;
    let n = 0;
    for (const d of hits) {
      hp -= d;
      n += 1;
      if (hp <= 0) break;
    }
    expect(hp).toBeLessThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(3);
  });
});

describe("mob AI loop", () => {
  it("chases, telegraphs, then attacks, never active before the full windup", () => {
    const { state, tuning, player } = world(eager);
    immortal(player);
    const mob = spawnMob(state, "melee", {
      x: player.pos.x + 60,
      y: player.pos.y,
    });
    const modes: string[] = [];
    let startupTicks = 0;
    let checkedActive = false;
    run(state, 200, idleInput(), () => {
      if (mob.ai && modes.at(-1) !== mob.ai.mode) modes.push(mob.ai.mode);
      const attack = currentAttack(mob, tuning);
      if (!attack) return;
      const phase = attackPhase(attack, mob.combat.attackFrame);
      if (mob.combat.attackFrame === 0) startupTicks = 0;
      if (phase === "startup") startupTicks += 1;
      if (phase === "active" && !checkedActive) {
        checkedActive = true;
        expect(startupTicks).toBe(attack.startup);
      }
    });
    expect(modes).toContain("chase");
    expect(modes.indexOf("telegraph")).toBeGreaterThan(modes.indexOf("chase"));
    expect(modes.indexOf("attack")).toBeGreaterThan(modes.indexOf("telegraph"));
    expect(modes).toContain("recover");
    expect(checkedActive).toBe(true);
    expect(player.hp).toBeLessThan(1_000_000);
  });

  it("has a ranged mob reposition into a lane and fire", () => {
    const { state, player } = world(eager);
    immortal(player);
    const mob = spawnMob(state, "ranged", {
      x: player.pos.x + 80,
      y: player.pos.y + 30,
    });
    const modes = new Set<string>();
    let fired = false;
    run(state, 300, idleInput(), () => {
      if (mob.ai) modes.add(mob.ai.mode);
      if (state.projectiles.length > 0) fired = true;
    });
    expect(modes.has("reposition")).toBe(true);
    expect(modes.has("telegraph")).toBe(true);
    expect(fired).toBe(true);
  });

  it("keeps a ranged mob from closing to melee range", () => {
    const { state, player } = world(eager);
    immortal(player);
    const mob = spawnMob(state, "ranged", {
      x: player.pos.x + 30,
      y: player.pos.y,
    });
    run(state, 200);
    expect(
      Math.hypot(mob.pos.x - player.pos.x, mob.pos.y - player.pos.y),
    ).toBeGreaterThan(40);
  });

  it("separates mobs that spawn stacked", () => {
    const { state, player } = world(inert);
    immortal(player);
    player.pos = { x: 40, y: 40 };
    const a = spawnMob(state, "melee", { x: 150, y: 80 });
    const b = spawnMob(state, "melee", { x: 150, y: 80 });
    run(state, 90);
    expect(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y)).toBeGreaterThan(5);
  });
});

describe("attack tokens", () => {
  const crowd = (tune?: (t: Tuning) => void): World => {
    const w = world((t) => {
      eager(t);
      tune?.(t);
    });
    immortal(w.player);
    const around: [string, number, number][] = [
      ["melee", 30, 0],
      ["melee", -10, 35],
      ["melee", -10, -35],
      ["ranged", 70, 20],
      ["ranged", 70, -20],
      ["melee", 30, 40],
    ];
    for (const [type, dx, dy] of around) {
      spawnMob(w.state, type, {
        x: w.player.pos.x + dx,
        y: w.player.pos.y + dy,
      });
    }
    return w;
  };

  const attackerCount = (state: SimState): number =>
    state.entities.filter((e) => e.kind === "mob" && e.state === "attack")
      .length;

  it("never lets more than the pool attack at once with six mobs", () => {
    const { state } = crowd();
    let maxAttackers = 0;
    run(state, 1200, idleInput(), () => {
      maxAttackers = Math.max(maxAttackers, attackerCount(state));
      expect(tokensInUse(state)).toBeLessThanOrEqual(
        tokenCapacity(state.tuning),
      );
    });
    expect(maxAttackers).toBeGreaterThan(0);
    expect(maxAttackers).toBeLessThanOrEqual(2);
  });

  it("clamps a pool larger than the max", () => {
    const { state } = crowd((t) => {
      t.combat.tokens.pool = 99;
    });
    expect(tokenCapacity(state.tuning)).toBe(3);
    let maxAttackers = 0;
    run(state, 1200, idleInput(), () => {
      maxAttackers = Math.max(maxAttackers, attackerCount(state));
    });
    expect(maxAttackers).toBeLessThanOrEqual(3);
  });

  it("respects token weights", () => {
    const { state } = world();
    const a = spawnMob(state, "melee", { x: 100, y: 40 });
    const b = spawnMob(state, "melee", { x: 100, y: 100 });
    expect(tryAcquireToken(state, a, 2)).toBe(true);
    expect(tryAcquireToken(state, b, 1)).toBe(false);
  });

  it("releases a token when its holder is hurt", () => {
    const { state } = world(inert);
    const mob = spawnMob(state, "melee", { x: 100, y: 40 });
    expect(tryAcquireToken(state, mob, 1)).toBe(true);
    enterStun(mob, "hurt", 10);
    step(state, idleInput());
    expect(holdsToken(state, mob)).toBe(false);
  });

  it("releases a token when its holder is staggered or dies", () => {
    const { state } = world(inert);
    const a = spawnMob(state, "melee", { x: 100, y: 40 });
    const b = spawnMob(state, "melee", { x: 100, y: 100 });
    tryAcquireToken(state, a, 1);
    tryAcquireToken(state, b, 1);
    enterStun(a, "stagger", 30);
    b.state = "dead";
    step(state, idleInput());
    expect(state.tokens).toHaveLength(0);
  });

  it("releases the token when the attack ends", () => {
    const { state, player } = world(eager);
    immortal(player);
    const mob = spawnMob(state, "melee", {
      x: player.pos.x + 20,
      y: player.pos.y,
    });
    let held = false;
    let releasedAfterAttack = false;
    run(state, 200, idleInput(), () => {
      if (holdsToken(state, mob)) held = true;
      if (held && mob.ai?.mode === "recover" && !holdsToken(state, mob)) {
        releasedAfterAttack = true;
      }
    });
    expect(releasedAfterAttack).toBe(true);
  });
});

describe("projectiles", () => {
  const shooter = (tune?: (t: Tuning) => void): World & { mob: Entity } => {
    const w = world((t) => {
      eager(t);
      tune?.(t);
    });
    const mob = spawnMob(w.state, "ranged", {
      x: w.player.pos.x + 80,
      y: w.player.pos.y,
    });
    return { ...w, mob };
  };

  const bolt = (ownerId: number, x: number, life = 100) => ({
    id: 99,
    kind: "oniBolt",
    ownerId,
    faction: "oni" as const,
    pos: { x, y: 40 },
    vel: { x: 110, y: 0 },
    life,
    spent: [],
    deflected: false,
  });

  it("hits an idle player through the normal hit pipeline", () => {
    const { state, player } = shooter();
    run(state, 110);
    expect(player.hp).toBe(100 - ATTACKS.oniBolt.damage);
    expect(state.projectiles).toHaveLength(0);
  });

  it("is stopped by a block and drains guard", () => {
    const { state, player } = shooter();
    let minGuard = player.combat.guard;
    run(state, 110, idleInput({ block: true }), () => {
      minGuard = Math.min(minGuard, player.combat.guard);
    });
    expect(player.hp).toBe(100);
    expect(minGuard).toBeLessThanOrEqual(60 - ATTACKS.oniBolt.guardDamage);
    expect(state.projectiles).toHaveLength(0);
  });

  it("is avoided by a dodge with i-frames", () => {
    const { state, player } = shooter();
    let dodged = false;
    for (let t = 0; t < 120; t++) {
      const near =
        !dodged &&
        state.projectiles.some((p) => Math.abs(p.pos.x - player.pos.x) < 14);
      if (near) dodged = true;
      step(state, idleInput({ dodge: near }));
    }
    expect(dodged).toBe(true);
    expect(player.hp).toBe(100);
  });

  it("dies on a wall", () => {
    const { state } = world(inert);
    const mob = spawnMob(state, "ranged", { x: 13 * 16 + 8, y: 40 });
    state.projectiles.push(bolt(mob.id, 13 * 16 + 14));
    run(state, 5);
    expect(state.projectiles).toHaveLength(0);
  });

  it("expires after its lifetime", () => {
    const { state } = world(inert);
    const mob = spawnMob(state, "ranged", { x: 60, y: 40 });
    state.projectiles.push(bolt(mob.id, 70, 5));
    run(state, 6);
    expect(state.projectiles).toHaveLength(0);
  });

  it("skips airborne targets when hitsAir is off", () => {
    const { state, player } = shooter((t) => {
      const b = t.projectiles.oniBolt;
      if (b) b.hitsAir = false;
    });
    player.z = 10;
    run(state, 100);
    expect(player.hp).toBe(100);
  });
});

describe("death and defeat", () => {
  it("kills a mob in three hits, fades it, then removes it", () => {
    const { state, player } = world(inert);
    const mob = spawnMob(state, "melee", {
      x: player.pos.x + 20,
      y: player.pos.y,
    });
    tryAcquireToken(state, mob, 1);
    let deadSeen = false;
    let removedAt = -1;
    for (let t = 0; t < 200; t++) {
      step(state, idleInput({ attack: t % 2 === 0 && t < 80 }));
      if (mob.state === "dead") deadSeen = true;
      if (deadSeen && removedAt < 0 && !state.entities.includes(mob)) {
        removedAt = t;
      }
    }
    expect(deadSeen).toBe(true);
    expect(removedAt).toBeGreaterThan(0);
    expect(state.tokens).toHaveLength(0);
  });

  it("does not let a corpse block movement", () => {
    const { state, player } = world(inert);
    const mob = spawnMob(state, "melee", {
      x: player.pos.x + 20,
      y: player.pos.y,
    });
    mob.hp = 0;
    mob.state = "dead";
    mob.combat.stun = 30;
    run(state, 60, idleInput({ moveX: 1 }));
    expect(player.pos.x).toBeGreaterThan(mob.pos.x);
  });

  it("flags the player defeated and stops accepting input", () => {
    const { state, player } = world(eager);
    player.hp = 1;
    spawnMob(state, "melee", { x: player.pos.x + 20, y: player.pos.y });
    run(state, 300);
    expect(state.defeated).toBe(true);
    expect(player.state).toBe("dead");
    expect(state.entities).toContain(player);
    const x = player.pos.x;
    run(state, 30, idleInput({ moveX: 1, attack: true, spin: true }));
    expect(player.pos.x).toBe(x);
    expect(player.state).toBe("dead");
  });
});

describe("spawner", () => {
  it("spawns 3 melee and 2 ranged oni mobs on distinct spots", () => {
    const { state } = world();
    const mobs = spawnWave(state);
    expect(mobs.filter((m) => m.mobType === "melee")).toHaveLength(3);
    expect(mobs.filter((m) => m.mobType === "ranged")).toHaveLength(2);
    for (const m of mobs) expect(m.faction).toBe("oni");
    const spots = new Set(mobs.map((m) => `${m.pos.x},${m.pos.y}`));
    expect(spots.size).toBe(5);
    expect(new Set(state.entities.map((e) => e.id)).size).toBe(
      state.entities.length,
    );
  });

  it("keeps the training dummy", () => {
    const state = createSim({ seed: 1 });
    spawnWave(state);
    expect(state.entities.some((e) => e.kind === "dummy")).toBe(true);
  });
});

describe("determinism with mobs", () => {
  const inputs = Array.from({ length: 900 }, (_, i) =>
    idleInput({
      moveX: Math.sin(i / 11),
      moveY: Math.cos(i / 17),
      attack: i % 9 < 2,
      dodge: i % 53 === 0,
      block: i % 101 < 15,
      spin: i % 160 > 120,
    }),
  );
  const make = (seed: number): SimState => {
    const state = createSim({ seed });
    spawnWave(state);
    return state;
  };

  it("reproduces identical state from the same seed", () => {
    const a = make(11);
    const b = make(11);
    for (const input of inputs) {
      step(a, input);
      step(b, input);
    }
    expect(a).toEqual(b);
  });

  it("survives a JSON round trip mid-fight", () => {
    const a = make(12);
    for (const input of inputs.slice(0, 400)) step(a, input);
    const restored: SimState = JSON.parse(JSON.stringify(a));
    for (const input of inputs.slice(400)) {
      step(a, input);
      step(restored, input);
    }
    expect(restored).toEqual(a);
  });

  it("uses the seed", () => {
    const a = make(1);
    const b = make(2);
    expect(a.entities.map((e) => e.ai)).not.toEqual(
      b.entities.map((e) => e.ai),
    );
  });
});
