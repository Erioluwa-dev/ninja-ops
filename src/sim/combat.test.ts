import { describe, expect, it } from "vitest";
import { ATTACKS } from "../data/attacks";
import { COMBAT } from "../data/combat";
import { canDamage } from "../data/factions";
import { KITS } from "../data/kits";
import { createTuning, type Tuning } from "../data/tuning";
import { activeHitbox, attackTotalFrames } from "./attack";
import { createEntity } from "./entity";
import { STATE_PRIORITY } from "./states";
import { createSim, step } from "./step";
import { entityOfKind, holdRange, idleInput, runScript } from "./testing";
import type { Entity, SimState } from "./types";

interface Rig {
  state: SimState;
  tuning: Tuning;
  player: Entity;
  dummy: Entity;
}

interface RigOptions {
  /** Dummy distance in front of the player, along +x. */
  dummyDx?: number;
  playerPos?: { x: number; y: number };
  tune?: (tuning: Tuning) => void;
}

function rig(opts: RigOptions = {}): Rig {
  const tuning = createTuning();
  opts.tune?.(tuning);
  const state = createSim({ seed: 1, tuning });
  const player = entityOfKind(state, "player");
  const dummy = entityOfKind(state, "dummy");
  if (opts.playerPos) player.pos = { ...opts.playerPos };
  dummy.pos = { x: player.pos.x + (opts.dummyDx ?? 20), y: player.pos.y };
  return { state, tuning, player, dummy };
}

// interval 1 makes the scripted dummy press attack on tick 0, so its swing
// lands on tick `dummySwing.startup` (30 by default).
const scripted = (tuning: Tuning): void => {
  tuning.combat.dummy.scriptedAttack = true;
  tuning.combat.dummy.interval = 1;
};

const SWING_HIT_TICK = ATTACKS.dummySwing.startup;

const HIT1 = ATTACKS.ninjaHit1;
const HIT1_TOTAL = attackTotalFrames(HIT1);

describe("attack frames", () => {
  it("exposes a hitbox only during active frames", () => {
    const { state, tuning, player } = rig({ dummyDx: 100 });
    const active: boolean[] = [];
    runScript(state, { 0: { attack: true } }, HIT1_TOTAL, () => {
      active.push(activeHitbox(player, tuning) !== null);
    });
    const expected = Array.from(
      { length: HIT1_TOTAL },
      (_, t) => t >= HIT1.startup && t < HIT1.startup + HIT1.active,
    );
    expect(active).toEqual(expected);
  });

  it("offsets the hitbox by facing", () => {
    const { state, tuning, player } = rig({ dummyDx: 100 });
    player.facing = { x: -1, y: 0 };
    runScript(state, { 0: { attack: true } }, HIT1.startup + 1);
    const box = activeHitbox(player, tuning);
    expect(box).not.toBeNull();
    if (!box) return;
    expect((box.minX + box.maxX) / 2).toBeCloseTo(
      player.pos.x - HIT1.hitbox.offset,
    );
    expect(box.maxX - box.minX).toBeCloseTo(HIT1.hitbox.length);
  });

  it("damages the target only on active frames and only once per swing", () => {
    const { state, dummy } = rig();
    const hpByTick: number[] = [];
    runScript(state, holdRange({ attack: true }, 0, 40), 40, () => {
      hpByTick.push(dummy.hp);
    });
    for (let t = 0; t < HIT1.startup; t++) expect(hpByTick[t]).toBe(100);
    expect(hpByTick[HIT1.startup]).toBe(100 - HIT1.damage);
    expect(hpByTick.at(-1)).toBe(100 - HIT1.damage);
  });

  it("misses a target outside the hitbox", () => {
    const { state, dummy } = rig({ dummyDx: 60 });
    runScript(state, { 0: { attack: true } }, 30);
    expect(dummy.hp).toBe(100);
  });
});

describe("combo and buffering", () => {
  const lastBufferedPress = HIT1_TOTAL - 1;
  const bufferSize = COMBAT.inputBuffer;

  it("chains hit 2 when a press lands inside the buffer window", () => {
    const { state, player } = rig({ dummyDx: 100 });
    const firstInWindow = HIT1_TOTAL - bufferSize + 1;
    runScript(
      state,
      { 0: { attack: true }, [firstInWindow]: { attack: true } },
      HIT1_TOTAL + 1,
    );
    expect(player.state).toBe("attack");
    expect(player.combat.comboIndex).toBe(1);
    expect(player.combat.attackId).toBe("ninjaHit2");
  });

  it("ignores a press made before the buffer window opens", () => {
    const { state, player } = rig({ dummyDx: 100 });
    const tooEarly = HIT1_TOTAL - bufferSize;
    runScript(
      state,
      { 0: { attack: true }, [tooEarly]: { attack: true } },
      HIT1_TOTAL + 1,
    );
    expect(player.state).toBe("idle");
    expect(player.combat.comboIndex).toBe(0);
  });

  it("starts the next hit on the tick the previous one ends", () => {
    const { state, player } = rig({ dummyDx: 100 });
    runScript(
      state,
      { 0: { attack: true }, [lastBufferedPress]: { attack: true } },
      HIT1_TOTAL + 1,
    );
    expect(player.combat.comboIndex).toBe(1);
    expect(player.combat.attackFrame).toBe(0);
  });

  it("does not repeat an attack from a held button", () => {
    const { state, player } = rig({ dummyDx: 100 });
    runScript(state, holdRange({ attack: true }, 0, 100), 100);
    expect(player.combat.comboIndex).toBe(0);
    expect(player.state).toBe("idle");
  });

  it("lands all three hits of a mashed combo on the dummy", () => {
    const { state, dummy, tuning } = rig();
    const mash: Record<number, { attack: boolean }> = {};
    for (let t = 0; t < 45; t += 2) mash[t] = { attack: true };
    runScript(state, mash, 120);
    const total = ["ninjaHit1", "ninjaHit2", "ninjaHit3"].reduce(
      (sum, id) => sum + (tuning.attacks[id]?.damage ?? 0),
      0,
    );
    expect(dummy.hp).toBe(100 - total);
  });
});

describe("hitstop", () => {
  it("freezes attacker and target but not bystanders", () => {
    const { state, tuning, player, dummy } = rig();
    const bystander = createEntity(
      3,
      "dummy",
      "neutral",
      "dummy",
      { x: 100, y: 40 },
      { x: -1, y: 0 },
      tuning,
    );
    bystander.combat.knock = { x: 0, y: 120 };
    state.entities.push(bystander);

    runScript(state, { 0: { attack: true } }, HIT1.startup + 1);
    expect(player.combat.hitstop).toBe(HIT1.hitstop);
    expect(dummy.combat.hitstop).toBe(HIT1.hitstop);
    expect(bystander.combat.hitstop).toBe(0);

    const frame = player.combat.attackFrame;
    const dummyX = dummy.pos.x;
    for (let i = 0; i < HIT1.hitstop; i++) {
      const bystanderY = bystander.pos.y;
      step(state, idleInput());
      expect(player.combat.attackFrame).toBe(frame);
      expect(dummy.pos.x).toBe(dummyX);
      expect(bystander.pos.y).toBeGreaterThan(bystanderY);
    }

    step(state, idleInput());
    expect(player.combat.attackFrame).toBe(frame + 1);
    expect(dummy.pos.x).toBeGreaterThan(dummyX);
  });

  it("does not advance timers on a frozen entity", () => {
    const { state, dummy } = rig();
    runScript(state, { 0: { attack: true } }, HIT1.startup + 1);
    const stun = dummy.combat.stun;
    step(state, idleInput());
    expect(dummy.combat.stun).toBe(stun);
  });
});

describe("knockback", () => {
  it("pushes the target along the attacker's facing and decays", () => {
    const { state, dummy } = rig();
    const x0 = dummy.pos.x;
    runScript(state, { 0: { attack: true } }, 60);
    const moved = dummy.pos.x - x0;
    expect(moved).toBeGreaterThan(1);
    expect(moved).toBeLessThan(HIT1.knockback / 60 / (1 - 0.85) + 0.01);
    expect(dummy.combat.knock).toEqual({ x: 0, y: 0 });
  });

  it("stops at a wall instead of passing through", () => {
    const { state, dummy } = rig({
      playerPos: { x: 196, y: 88 },
      dummyDx: 18,
      tune: (t) => {
        const hit = t.attacks.ninjaHit1;
        if (hit) hit.knockback = 400;
      },
    });
    const wallInnerEdge = state.arena.cols * state.arena.tileSize - 16;
    let maxX = 0;
    runScript(state, { 0: { attack: true } }, 60, () => {
      maxX = Math.max(maxX, dummy.pos.x);
    });
    expect(maxX).toBeLessThanOrEqual(wallInnerEdge - dummy.feet.w / 2 + 1e-6);
    expect(dummy.pos.x).toBeCloseTo(wallInnerEdge - dummy.feet.w / 2);
  });
});

describe("hurt and i-frames", () => {
  const cornered = {
    playerPos: { x: 21, y: 88 },
    dummyDx: 20,
  };
  const fastSwings = (t: Tuning): void => {
    scripted(t);
    const swing = t.attacks.dummySwing;
    if (swing) {
      swing.startup = 5;
      swing.recovery = 5;
    }
  };

  it("stuns, damages and briefly shields the player", () => {
    const { state, player } = rig({ ...cornered, tune: scripted });
    runScript(state, {}, SWING_HIT_TICK + 1);
    expect(player.hp).toBe(100 - ATTACKS.dummySwing.damage);
    expect(player.state).toBe("hurt");
    expect(player.combat.hurtIframes).toBe(KITS.ninja.hurtIframes);
  });

  it("does not let repeated swings chain while i-frames last", () => {
    const { state, player } = rig({ ...cornered, tune: fastSwings });
    runScript(state, {}, 50);
    expect(player.hp).toBe(100 - ATTACKS.dummySwing.damage);
    runScript(state, {}, 120);
    expect(player.hp).toBeLessThan(100 - ATTACKS.dummySwing.damage);
  });

  it("chains freely without i-frames", () => {
    const { state, player } = rig({
      ...cornered,
      tune: (t) => {
        fastSwings(t);
        const ninja = t.kits.ninja;
        if (ninja) ninja.hurtIframes = 0;
      },
    });
    runScript(state, {}, 50);
    expect(player.hp).toBeLessThan(100 - ATTACKS.dummySwing.damage);
  });

  it("gives the dummy no i-frames so combos land", () => {
    expect(KITS.dummy.hurtIframes).toBe(0);
  });

  it("keeps the dummy alive at the hp floor and regenerates it", () => {
    const { state, dummy } = rig({
      tune: (t) => {
        const hit = t.attacks.ninjaHit1;
        if (hit) hit.damage = 500;
      },
    });
    runScript(state, { 0: { attack: true } }, 20);
    expect(dummy.hp).toBe(KITS.dummy.hpFloor);
    runScript(state, {}, 260);
    expect(dummy.hp).toBe(dummy.maxHp);
  });
});

describe("dodge", () => {
  const dodgeAt = (t: number) => ({ [t]: { dodge: true } });

  it("dashes in the move direction for the dodge duration", () => {
    const { state, player } = rig({ dummyDx: 100 });
    const y0 = player.pos.y;
    runScript(
      state,
      { 0: { moveY: 1, dodge: true }, ...holdRange({ moveY: 1 }, 1, 14) },
      COMBAT.dodge.duration,
    );
    expect(player.pos.y - y0).toBeCloseTo(
      (COMBAT.dodge.speed / 60) * COMBAT.dodge.duration,
    );
    expect(player.pos.x).toBeCloseTo(40);
  });

  it("dashes along facing when there is no move input", () => {
    const { state, player } = rig({ dummyDx: 100 });
    const x0 = player.pos.x;
    runScript(state, dodgeAt(0), 3);
    expect(player.state).toBe("dodge");
    expect(player.pos.x).toBeGreaterThan(x0);
  });

  it("ends after its duration and enforces the cooldown", () => {
    const { state, player } = rig({ dummyDx: 100 });
    const states: string[] = [];
    runScript(state, { ...dodgeAt(0), ...dodgeAt(20) }, 60, () => {
      states.push(player.state);
    });
    expect(states[0]).toBe("dodge");
    expect(states[COMBAT.dodge.duration]).toBe("idle");
    expect(states.slice(20, 40)).not.toContain("dodge");

    const second = rig({ dummyDx: 100 });
    const later: string[] = [];
    runScript(
      second.state,
      { ...dodgeAt(0), ...dodgeAt(COMBAT.dodge.cooldown) },
      COMBAT.dodge.cooldown + 2,
      () => later.push(second.player.state),
    );
    expect(later[COMBAT.dodge.cooldown]).toBe("dodge");
  });

  describe("against the dummy swing", () => {
    // Dodge frame on the swing's hit tick is SWING_HIT_TICK - pressTick.
    const inFrames = (frame: number) => SWING_HIT_TICK - frame;
    const singleTick = (t: Tuning): void => {
      scripted(t);
      const swing = t.attacks.dummySwing;
      if (swing) swing.active = 1;
    };

    it("takes the hit when the dodge is too early to cover it", () => {
      const { state, player } = rig({ tune: scripted });
      runScript(state, dodgeAt(5), SWING_HIT_TICK + 2);
      expect(player.hp).toBe(100 - ATTACKS.dummySwing.damage);
    });

    it("ignores hits during i-frames outside the perfect window", () => {
      const { state, player } = rig({ tune: singleTick });
      const frame = COMBAT.dodge.perfectWindow;
      runScript(state, dodgeAt(inFrames(frame)), SWING_HIT_TICK + 4);
      expect(player.hp).toBe(100);
      expect(player.combat.counterWindow).toBe(0);
      expect(player.combat.spinMeter).toBe(0);
    });

    it("takes the hit on the first frame after i-frames end", () => {
      const { state, player } = rig({ tune: singleTick });
      runScript(
        state,
        dodgeAt(inFrames(COMBAT.dodge.iframes)),
        SWING_HIT_TICK + 4,
      );
      expect(player.hp).toBe(100 - ATTACKS.dummySwing.damage);
    });

    it("counts a hit on the last perfect frame as a perfect dodge", () => {
      const { state, player } = rig({ tune: singleTick });
      const frame = COMBAT.dodge.perfectWindow - 1;
      runScript(state, dodgeAt(inFrames(frame)), SWING_HIT_TICK + 1);
      expect(player.hp).toBe(100);
      expect(player.combat.counterWindow).toBe(COMBAT.counter.window);
      expect(player.combat.spinMeter).toBe(COMBAT.meters.perfectDodgeSpinGain);
    });

    it("spends the swing on a perfect dodge even if it stays active", () => {
      const { state, player } = rig({ tune: scripted });
      runScript(state, dodgeAt(inFrames(0)), SWING_HIT_TICK + 30);
      expect(player.hp).toBe(100);
      expect(player.combat.spinMeter).toBe(COMBAT.meters.perfectDodgeSpinGain);
    });
  });
});

describe("block", () => {
  const blockFrom = (t: number, to = 60) => holdRange({ block: true }, t, to);
  // A block started on tick t has been up for SWING_HIT_TICK - t frames when hit.
  const startFor = (frame: number) => SWING_HIT_TICK - frame;

  it("negates frontal damage and drains guard", () => {
    const { state, player } = rig({ tune: scripted });
    runScript(state, blockFrom(0), SWING_HIT_TICK + 1);
    expect(player.hp).toBe(100);
    expect(player.state).toBe("block");
    expect(player.combat.guard).toBe(
      COMBAT.block.guardMax - ATTACKS.dummySwing.guardDamage,
    );
  });

  it("pushes the blocker back but still collides", () => {
    const { state, player } = rig({ tune: scripted });
    const x0 = player.pos.x;
    runScript(state, blockFrom(0), SWING_HIT_TICK + 20);
    expect(player.pos.x).toBeLessThan(x0);
  });

  it("does not block hits from behind", () => {
    const { state, player } = rig({ tune: scripted });
    player.facing = { x: -1, y: 0 };
    runScript(state, blockFrom(0), SWING_HIT_TICK + 1);
    expect(player.hp).toBe(100 - ATTACKS.dummySwing.damage);
  });

  it("breaks guard into a stun, then regenerates", () => {
    const { state, player } = rig({
      tune: (t) => {
        scripted(t);
        const swing = t.attacks.dummySwing;
        if (swing) swing.guardDamage = 500;
      },
    });
    runScript(state, blockFrom(0, 41), SWING_HIT_TICK + 1);
    expect(player.state).toBe("guardBreak");
    expect(player.combat.guard).toBe(0);
    expect(player.hp).toBe(100);

    runScript(state, {}, COMBAT.block.guardBreakStun + 30);
    expect(player.state).not.toBe("guardBreak");
    runScript(state, {}, 60);
    expect(player.combat.guard).toBeGreaterThan(0);
  });

  it("regenerates guard only while not blocking", () => {
    const { state, player } = rig({ tune: scripted });
    runScript(state, blockFrom(0, 41), 130);
    const drained = COMBAT.block.guardMax - ATTACKS.dummySwing.guardDamage;
    expect(player.combat.guard).toBeGreaterThan(drained);
    expect(player.combat.guard).toBeLessThanOrEqual(COMBAT.block.guardMax);
  });

  it("does not regenerate guard while held", () => {
    const { state, player } = rig({ dummyDx: 100 });
    player.combat.guard = 10;
    runScript(state, blockFrom(0, 200), 1);
    const held = player.combat.guard;
    runScript(state, blockFrom(0, 200), 199);
    expect(player.combat.guard).toBe(held);
  });

  it("lets unblockable attacks through", () => {
    const { state, player } = rig({
      tune: (t) => {
        scripted(t);
        const swing = t.attacks.dummySwing;
        if (swing) swing.unblockable = true;
      },
    });
    runScript(state, blockFrom(0), SWING_HIT_TICK + 1);
    expect(player.hp).toBe(100 - ATTACKS.dummySwing.damage);
    expect(player.state).toBe("hurt");
    expect(player.combat.guard).toBe(COMBAT.block.guardMax);
  });

  it("moves at reduced speed and turns to face the move direction", () => {
    const { state, player } = rig({ dummyDx: 100 });
    const y0 = player.pos.y;
    runScript(state, holdRange({ block: true, moveY: 1 }, 0, 10), 10);
    const expected =
      (10 * KITS.ninja.moveSpeed * COMBAT.block.moveSpeedScale) / 60;
    expect(player.pos.y - y0).toBeCloseTo(expected);
    expect(player.state).toBe("block");
    expect(player.facing).toEqual({ x: 0, y: 1 });
  });

  describe("parry window", () => {
    const perfect = COMBAT.block.perfectWindow;

    it("parries a hit on the last perfect frame", () => {
      const { state, player, dummy } = rig({ tune: scripted });
      runScript(state, blockFrom(startFor(perfect - 1)), SWING_HIT_TICK + 1);
      expect(player.hp).toBe(100);
      expect(player.combat.guard).toBe(COMBAT.block.guardMax);
      expect(dummy.state).toBe("stagger");
      expect(player.combat.counterWindow).toBe(COMBAT.counter.window);
    });

    it("treats the first frame past the window as an ordinary block", () => {
      const { state, player, dummy } = rig({ tune: scripted });
      runScript(state, blockFrom(startFor(perfect)), SWING_HIT_TICK + 1);
      expect(player.hp).toBe(100);
      expect(player.combat.guard).toBeLessThan(COMBAT.block.guardMax);
      expect(dummy.state).not.toBe("stagger");
      expect(player.combat.counterWindow).toBe(0);
    });
  });
});

describe("counter window", () => {
  const parryScript = holdRange(
    { block: true },
    SWING_HIT_TICK - 2,
    SWING_HIT_TICK + 20,
  );
  const punish = (
    tune: (c: Tuning["combat"]["counter"]) => void = () => undefined,
    pressTick = SWING_HIT_TICK + 12,
  ) => {
    const r = rig({
      tune: (t) => {
        scripted(t);
        tune(t.combat.counter);
      },
    });
    runScript(
      r.state,
      { ...parryScript, [pressTick]: { block: true, attack: true } },
      pressTick + HIT1.startup + 2,
    );
    return r;
  };

  it("lets a punish cut through held block after a parry", () => {
    const { player } = punish();
    expect(player.state).toBe("attack");
  });

  it("rewards the counter with bonus damage and a stagger", () => {
    const { dummy } = punish();
    expect(dummy.hp).toBe(100 - HIT1.damage * COMBAT.counter.damageMultiplier);
    expect(dummy.state).toBe("stagger");
  });

  it("applies each reward independently", () => {
    const noBonus = punish((c) => {
      c.bonusDamage = false;
    });
    expect(noBonus.dummy.hp).toBe(100 - HIT1.damage);
    expect(noBonus.dummy.state).toBe("stagger");

    const noStagger = punish((c) => {
      c.stagger = false;
    });
    expect(noStagger.dummy.hp).toBe(
      100 - HIT1.damage * COMBAT.counter.damageMultiplier,
    );
    expect(noStagger.dummy.state).toBe("hurt");
  });

  it("gives nothing once the window has expired", () => {
    const late = punish((c) => {
      c.window = 3;
    });
    expect(late.dummy.hp).toBe(100);
  });

  it("is spent on the first attack", () => {
    const { player } = punish();
    expect(player.combat.counterWindow).toBe(0);
    expect(player.combat.attackCounter).toBe(false);
  });

  it("opens after a perfect dodge and cuts through the dodge", () => {
    const r = rig({
      tune: (t) => {
        scripted(t);
      },
    });
    const pressTick = SWING_HIT_TICK + 3;
    runScript(
      r.state,
      {
        [SWING_HIT_TICK - 4]: { dodge: true },
        [pressTick]: { attack: true },
      },
      pressTick + HIT1.startup + 2,
    );
    expect(r.dummy.hp).toBe(
      100 - HIT1.damage * COMBAT.counter.damageMultiplier,
    );
  });

  it("does not let a plain attack press cut through block", () => {
    const { state, player } = rig({ dummyDx: 100 });
    runScript(
      state,
      {
        ...holdRange({ block: true }, 0, 20),
        5: { block: true, attack: true },
      },
      20,
    );
    expect(player.state).toBe("block");
  });
});

describe("state priority", () => {
  it("orders states hurt > spin > jump > dodge > block > attack > move", () => {
    const rank = (s: (typeof STATE_PRIORITY)[number]) =>
      STATE_PRIORITY.indexOf(s);
    const chain = [
      "hurt",
      "spin",
      "jump",
      "dodge",
      "block",
      "attack",
      "move",
    ] as const;
    for (let i = 0; i < chain.length - 1; i++) {
      const higher = chain[i];
      const lower = chain[i + 1];
      if (higher && lower) expect(rank(higher)).toBeGreaterThan(rank(lower));
    }
  });

  it("lets dodge cancel an attack", () => {
    const { state, player } = rig({ dummyDx: 100 });
    runScript(state, { 0: { attack: true }, 2: { dodge: true } }, 3);
    expect(player.state).toBe("dodge");
    expect(player.combat.attackId).toBeNull();
  });

  it("lets block cancel an attack", () => {
    const { state, player } = rig({ dummyDx: 100 });
    runScript(
      state,
      { 0: { attack: true }, ...holdRange({ block: true }, 2, 5) },
      5,
    );
    expect(player.state).toBe("block");
  });

  it("does not start an attack from block or a dodge", () => {
    const { state, player } = rig({ dummyDx: 100 });
    runScript(state, { 0: { dodge: true }, 2: { attack: true } }, 4);
    expect(player.state).toBe("dodge");
  });

  it("lets a hit override a dodge that is past its i-frames", () => {
    const { state, player } = rig({ tune: scripted });
    runScript(
      state,
      { [SWING_HIT_TICK - COMBAT.dodge.iframes - 1]: { dodge: true } },
      SWING_HIT_TICK + 1,
    );
    expect(player.state).toBe("hurt");
  });

  it("holds block over attack when both are pressed together", () => {
    const { state, player } = rig({ dummyDx: 100 });
    runScript(
      state,
      { ...holdRange({ block: true }, 0, 4), 0: { block: true, attack: true } },
      4,
    );
    expect(player.state).toBe("block");
  });
});

describe("factions in combat", () => {
  it("lets anyone damage neutral but never neutral damage anyone", () => {
    expect(canDamage("ninja", "neutral")).toBe(true);
    expect(canDamage("oni", "neutral")).toBe(true);
    expect(canDamage("neutral", "ninja")).toBe(false);
    expect(canDamage("neutral", "neutral")).toBe(false);
    expect(canDamage("ninja", "oni")).toBe(true);
    expect(canDamage("ninja", "ninja")).toBe(false);
  });

  it("keeps an unscripted dummy neutral and harmless", () => {
    const { state, player, dummy } = rig();
    runScript(state, {}, 300);
    expect(dummy.faction).toBe("neutral");
    expect(player.hp).toBe(100);
  });

  it("does not let a neutral attacker hit even with an active hitbox", () => {
    const { state, player, dummy } = rig();
    dummy.state = "attack";
    dummy.combat.attackId = "dummySwing";
    dummy.combat.attackFrame = ATTACKS.dummySwing.startup - 1;
    dummy.facing = { x: -1, y: 0 };
    runScript(state, {}, 3);
    expect(player.hp).toBe(100);
  });

  it("makes the scripted dummy hostile and toggles back to neutral", () => {
    const { state, tuning, dummy } = rig({ tune: scripted });
    step(state, idleInput());
    expect(dummy.faction).toBe("oni");
    tuning.combat.dummy.scriptedAttack = false;
    step(state, idleInput());
    expect(dummy.faction).toBe("neutral");
  });

  it("telegraphs before swinging", () => {
    const { state, tuning, dummy } = rig({ tune: scripted });
    runScript(state, {}, 5);
    expect(dummy.state).toBe("attack");
    expect(tuning.attacks.dummySwing?.telegraph).toBe(true);
    expect(dummy.combat.attackFrame).toBeLessThan(ATTACKS.dummySwing.startup);
  });
});

describe("tuning", () => {
  it("copies the source data so edits never reach it", () => {
    const tuning = createTuning();
    const hit = tuning.attacks.ninjaHit1;
    if (hit) hit.damage = 999;
    expect(ATTACKS.ninjaHit1.damage).toBe(HIT1.damage);
    expect(createTuning().attacks.ninjaHit1?.damage).toBe(HIT1.damage);
  });

  it("makes the sim read live edits", () => {
    const { state, tuning, dummy } = rig();
    const hit = tuning.attacks.ninjaHit1;
    if (hit) hit.damage = 20;
    runScript(state, { 0: { attack: true } }, 10);
    expect(dummy.hp).toBe(80);
  });

  it("references only attacks that exist", () => {
    for (const kit of Object.values(KITS)) {
      for (const id of kit.comboAttacks) expect(ATTACKS).toHaveProperty(id);
    }
  });

  it("keeps perfect windows inside their protection", () => {
    expect(COMBAT.dodge.perfectWindow).toBeLessThanOrEqual(
      COMBAT.dodge.iframes,
    );
    expect(COMBAT.dodge.iframes).toBeLessThanOrEqual(COMBAT.dodge.duration);
  });
});

describe("determinism with combat", () => {
  const inputs = Array.from({ length: 600 }, (_, i) =>
    idleInput({
      moveX: Math.sin(i / 9),
      moveY: Math.cos(i / 13),
      attack: i % 7 < 2,
      dodge: i % 41 === 0,
      block: i % 97 < 20,
    }),
  );

  const scriptedSim = (): SimState => {
    const tuning = createTuning();
    scripted(tuning);
    tuning.combat.dummy.interval = 40;
    return createSim({ seed: 9, tuning });
  };

  it("reproduces identical state from the same seed and inputs", () => {
    const a = scriptedSim();
    const b = scriptedSim();
    for (const input of inputs) {
      step(a, input);
      step(b, input);
    }
    expect(a).toEqual(b);
  });

  it("survives a JSON round trip mid-fight", () => {
    const a = scriptedSim();
    for (const input of inputs.slice(0, 300)) step(a, input);
    const restored: SimState = JSON.parse(JSON.stringify(a));
    for (const input of inputs.slice(300)) {
      step(a, input);
      step(restored, input);
    }
    expect(restored).toEqual(a);
  });

  it("ignores the pause action", () => {
    const a = createSim({ seed: 3 });
    const b = createSim({ seed: 3 });
    for (const input of inputs.slice(0, 100)) {
      step(a, input);
      step(b, { ...input, pause: true });
    }
    expect(b.entities).toEqual(a.entities);
  });
});
