import { describe, expect, it } from "vitest";
import { ATTACKS } from "../../data/attacks";
import { ECHO, type EchoMoveId } from "../../data/echo";
import { createTuning } from "../../data/tuning";
import { nearestHostile } from "../intent";
import { spawnMob } from "../spawner";
import { createSim, step } from "../step";
import {
  entityOfKind,
  forceAttack,
  holdRange,
  idleInput,
  runScript,
} from "../testing";
import type { ActionFrame, Entity, SimState } from "../types";
import { liveGhosts, spawnGhost } from "./ghost";

interface Rig {
  state: SimState;
  player: Entity;
  dummy: Entity;
}

function rig(
  opts: { moves?: readonly EchoMoveId[]; dummyDx?: number } = {},
): Rig {
  const state = createSim({ seed: 1, echoMoves: opts.moves });
  const player = entityOfKind(state, "player");
  const dummy = entityOfKind(state, "dummy");
  dummy.pos = { x: player.pos.x + (opts.dummyDx ?? 300), y: player.pos.y };
  return { state, player, dummy };
}

const run = (state: SimState, ticks: number, input = idleInput()): void => {
  for (let t = 0; t < ticks; t++) step(state, input);
};

const DELAY = ECHO.afterstep.delayFrames;

// Presses every fourth tick so the input buffer chains the whole combo.
const comboScript = (): Record<number, Partial<ActionFrame>> => {
  const script: Record<number, Partial<ActionFrame>> = {};
  for (let t = 0; t < 60; t += 4) script[t] = { attack: true };
  for (let t = 1; t < 60; t += 4) script[t] = { attack: false };
  return script;
};

describe("echo config", () => {
  it("matches the Bible numbers", () => {
    expect(ECHO.bufferFrames).toBe(90); // 1.5 s
    expect(ECHO.ghostDelayFrames).toBe(30); // 0.5 s
    expect(ECHO.afterstep.delayFrames).toBe(24); // 0.4 s
    expect(ECHO.rewindStep.windowFrames).toBe(60); // 1 s
    expect(ECHO.decoyVeil.standStillFrames).toBe(60); // 1 s
    expect(ECHO.decoyVeil.tauntFrames).toBe(180); // 3 s
    expect(ECHO.maxPips).toBe(4);
    expect(ECHO.ghostDamageScale).toBe(0.5);
  });
});

describe("recorder", () => {
  it("keeps only the last 1.5 s, oldest first, with the pre-tick position", () => {
    const { state, player } = rig();
    const start = { ...player.pos };
    run(state, 200, idleInput({ moveX: 0, moveY: 0 }));
    const { buffer } = state.echo;
    expect(buffer).toHaveLength(ECHO.bufferFrames);
    expect(buffer[0]?.tick).toBe(200 - ECHO.bufferFrames);
    expect(buffer.at(-1)?.tick).toBe(199);
    expect(buffer[0]?.pos).toEqual(start);
  });

  it("stores the input as given", () => {
    const { state } = rig();
    step(state, idleInput({ moveX: 1, attack: true }));
    expect(state.echo.buffer[0]?.input.moveX).toBe(1);
    expect(state.echo.buffer[0]?.input.attack).toBe(true);
  });
});

describe("determinism", () => {
  const script: Record<number, Partial<ActionFrame>> = {
    ...comboScript(),
    70: { dodge: true, moveX: 1 },
    110: { dodge: true },
  };

  function playthrough(): { state: SimState; ghostPath: string } {
    const { state } = rig({ dummyDx: 30 });
    state.echo.resonance = 2;
    const path: string[] = [];
    runScript(state, script, 260, () => {
      for (const g of liveGhosts(state)) {
        path.push(`${g.id}:${g.pos.x.toFixed(4)},${g.pos.y.toFixed(4)}`);
      }
    });
    return { state, ghostPath: path.join("|") };
  }

  it("gives an identical ghost path and state hash for identical input", () => {
    const a = playthrough();
    const b = playthrough();
    expect(a.ghostPath).not.toBe("");
    expect(a.ghostPath).toBe(b.ghostPath);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});

describe("Afterstep", () => {
  it("raises a ghost 0.4 s later that repeats the dash from where it began", () => {
    const { state, player } = rig();
    const origin = { ...player.pos };
    const script = { 0: { dodge: true, moveX: 1 } };
    runScript(state, script, DELAY - 1);
    expect(liveGhosts(state)).toHaveLength(0);
    runScript(state, {}, 1);
    const ghost = liveGhosts(state)[0];
    expect(ghost?.pos).toEqual(origin);

    const playerEnd = player.pos.x;
    run(state, 20);
    expect(ghost?.pos.x).toBeGreaterThan(origin.x + 10);
    // Same path: it covers the same dash distance the player did.
    expect((ghost?.pos.x ?? 0) - origin.x).toBeCloseTo(playerEnd - origin.x, 0);
  });

  it("fades by itself after lingering", () => {
    // Decoy Veil would raise a fresh ghost once the player has stood still.
    const { state } = rig({ moves: ["afterstep"] });
    runScript(state, { 0: { dodge: true, moveX: 1 } }, DELAY + 5);
    expect(liveGhosts(state)).toHaveLength(1);
    run(state, ECHO.afterstep.lingerFrames + 2);
    expect(liveGhosts(state)).toHaveLength(0);
    expect(state.echo.resonance).toBe(0);
  });

  it("does nothing while the move is locked", () => {
    const { state } = rig({ moves: [] });
    runScript(state, { 0: { dodge: true, moveX: 1 } }, DELAY + 5);
    expect(liveGhosts(state)).toHaveLength(0);
  });
});

describe("Twin Strike", () => {
  it("repeats only the combo finisher from the ghost 0.5 s later", () => {
    const { state, player } = rig({ dummyDx: 300 });
    let finisherTick = -1;
    const ids: (string | null)[] = [];
    runScript(state, comboScript(), 120, (t) => {
      if (finisherTick < 0 && player.combat.comboIndex === 2) {
        finisherTick = t;
      }
      const ghost = liveGhosts(state)[0];
      if (ghost) ids.push(ghost.combat.attackId);
    });
    expect(finisherTick).toBeGreaterThan(0);
    expect(ids).toContain("ninjaHit3");
    expect(ids).not.toContain("ninjaHit1");
  });

  it("hits for half the player's damage", () => {
    const { state, player, dummy } = rig({ dummyDx: 300 });
    dummy.pos = { x: player.pos.x + 20, y: player.pos.y };
    spawnGhost(state, {
      owner: player,
      move: "twinStrike",
      pos: { x: player.pos.x - 4, y: player.pos.y },
      facing: { x: 1, y: 0 },
      replayTick: state.tick,
      actFrames: 1,
      follow: false,
      press: "attack",
      attackId: "ninjaHit1",
      ttl: 60,
      taunt: false,
    });
    run(state, 20);
    expect(dummy.hp).toBe(100 - ATTACKS.ninjaHit1.damage * 0.5);
  });
});

describe("Decoy Veil", () => {
  it("raises a taunting ghost after standing still for 1 s", () => {
    const { state, player } = rig();
    run(state, ECHO.decoyVeil.standStillFrames - 1);
    expect(liveGhosts(state)).toHaveLength(0);
    run(state, 1);
    const ghost = liveGhosts(state)[0];
    expect(ghost?.ghost?.taunt).toBe(true);
    expect(ghost?.pos).toEqual(player.pos);
  });

  it("does not raise one if the player keeps moving", () => {
    const { state } = rig();
    run(state, 120, idleInput({ moveY: 1 }));
    expect(liveGhosts(state)).toHaveLength(0);
  });

  it("makes enemies target the ghost for 3 s, then the player again", () => {
    const { state, player } = rig();
    run(state, ECHO.decoyVeil.standStillFrames);
    const ghost = liveGhosts(state)[0];
    // The player walks off so the mob would otherwise pick them.
    const mob = spawnMob(state, "melee", {
      x: player.pos.x + 60,
      y: player.pos.y,
    });
    player.pos = { x: player.pos.x + 40, y: player.pos.y };
    expect(nearestHostile(state, mob)).toBe(ghost);

    run(state, ECHO.decoyVeil.tauntFrames, idleInput({ moveY: 1 }));
    expect(liveGhosts(state)).toHaveLength(0);
    expect(nearestHostile(state, mob)).toBe(player);
  });
});

describe("Rewind Step", () => {
  const rewindScript = { 0: { dodge: true, moveX: 1 }, 45: { dodge: true } };

  it("snaps the player back to where the ghost stands, spending 1 pip and the ghost", () => {
    const { state, player } = rig();
    state.echo.resonance = 2;
    // The player keeps walking after the dash, so the ghost trails 0.4 s behind.
    const walk = holdRange({ moveX: 1 }, 15, 45);
    let ghostPos = { x: 0, y: 0 };
    runScript(
      state,
      { 0: { dodge: true, moveX: 1 }, ...walk, 45: { dodge: true } },
      46,
      (t) => {
        const ghost = liveGhosts(state)[0];
        if (t === 44 && ghost) ghostPos = { ...ghost.pos };
      },
    );
    expect(ghostPos.x).toBeGreaterThan(0);
    expect(player.pos.x).toBeCloseTo(ghostPos.x, 5);
    expect(state.echo.resonance).toBe(2 - ECHO.rewindStep.cost);
    expect(liveGhosts(state)).toHaveLength(0);
    expect(player.state).not.toBe("dodge");
  });

  it("is an ordinary dodge when there is no pip to spend", () => {
    const { state, player } = rig();
    runScript(state, rewindScript, 46);
    expect(player.pos.x).toBeGreaterThan(0);
    expect(player.state).toBe("dodge");
  });

  it("closes after the 1 s window", () => {
    const { state, player } = rig();
    state.echo.resonance = 2;
    const late = ECHO.rewindStep.windowFrames + 5;
    runScript(
      state,
      { 0: { dodge: true, moveX: 1 }, [late]: { dodge: true } },
      late + 1,
    );
    expect(state.echo.resonance).toBe(2);
    expect(player.state).toBe("dodge");
  });
});

describe("resonance", () => {
  it("gains a pip per 3 landed hits and caps at 4", () => {
    const { state, player, dummy } = rig();
    dummy.pos = { x: player.pos.x + 20, y: player.pos.y };
    dummy.combat.hurtIframes = 0;
    // Three separate swings, each landing on the dummy.
    for (let n = 0; n < 3; n++) {
      forceAttack(player, "ninjaHit1", { x: 1, y: 0 });
      run(state, ATTACKS.ninjaHit1.startup + 2);
      run(state, 30);
    }
    expect(state.echo.resonance).toBe(1);
    state.echo.resonance = 4;
    state.echo.hitCount = 2;
    forceAttack(player, "ninjaHit1", { x: 1, y: 0 });
    run(state, ATTACKS.ninjaHit1.startup + 2);
    expect(state.echo.resonance).toBe(4);
  });

  it("gains a pip from a perfect dodge", () => {
    // The dummy reads its script when it is created, so tune before createSim.
    const tuning = createTuning();
    tuning.combat.dummy.scriptedAttack = true;
    tuning.combat.dummy.interval = 1;
    const state = createSim({ seed: 1, tuning });
    const player = entityOfKind(state, "player");
    const dummy = entityOfKind(state, "dummy");
    dummy.pos = { x: player.pos.x + 20, y: player.pos.y };
    const swingTick = ATTACKS.dummySwing.startup;
    runScript(state, { [swingTick - 4]: { dodge: true } }, swingTick + 1);
    expect(player.hp).toBe(100);
    expect(state.echo.resonance).toBe(ECHO.gain.perfectDodge);
  });
});

describe("ghost weakness", () => {
  it("dissolves when an enemy hits it and costs a pip", () => {
    const { state, player } = rig();
    state.echo.resonance = 2;
    const ghost = spawnGhost(state, {
      owner: player,
      move: "decoyVeil",
      pos: { x: player.pos.x + 100, y: player.pos.y },
      facing: { x: 1, y: 0 },
      replayTick: -1,
      actFrames: 0,
      follow: false,
      press: null,
      attackId: null,
      ttl: 300,
      taunt: true,
    });
    const mob = spawnMob(state, "melee", {
      x: ghost.pos.x + 12,
      y: ghost.pos.y,
    });
    forceAttack(mob, "oniSlash", { x: -1, y: 0 });
    run(state, ATTACKS.oniSlash.startup + 3);
    expect(ghost.state).toBe("dead");
    expect(liveGhosts(state)).toHaveLength(0);
    expect(state.echo.resonance).toBe(1);
    expect(player.hp).toBe(player.maxHp);
  });

  it("never drops resonance below 0", () => {
    const { state, player } = rig();
    const ghost = spawnGhost(state, {
      owner: player,
      move: "decoyVeil",
      pos: { x: player.pos.x + 100, y: player.pos.y },
      facing: { x: 1, y: 0 },
      replayTick: -1,
      actFrames: 0,
      follow: false,
      press: null,
      attackId: null,
      ttl: 300,
      taunt: true,
    });
    const mob = spawnMob(state, "melee", {
      x: ghost.pos.x + 12,
      y: ghost.pos.y,
    });
    forceAttack(mob, "oniSlash", { x: -1, y: 0 });
    run(state, ATTACKS.oniSlash.startup + 3);
    expect(ghost.state).toBe("dead");
    expect(state.echo.resonance).toBe(0);
  });
});

describe("ghost limit", () => {
  it("keeps one ghost: a newer one replaces the older without a pip loss", () => {
    const { state } = rig();
    state.echo.resonance = 2;
    // Decoy first, then an Afterstep whose ghost lands while the decoy stands.
    runScript(
      state,
      {
        [ECHO.decoyVeil.standStillFrames + 1]: { dodge: true, moveX: 1 },
      },
      ECHO.decoyVeil.standStillFrames + DELAY + 5,
    );
    const ghosts = liveGhosts(state);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]?.ghost?.move).toBe("afterstep");
    expect(state.echo.resonance).toBe(2);
  });

  it("lets two ghosts stand once the limit is raised", () => {
    const { state } = rig();
    state.echo.ghostLimit = 2;
    runScript(
      state,
      { [ECHO.decoyVeil.standStillFrames + 1]: { dodge: true, moveX: 1 } },
      ECHO.decoyVeil.standStillFrames + DELAY + 5,
    );
    expect(liveGhosts(state)).toHaveLength(2);
  });
});

describe("ghost bodies", () => {
  it("neither blocks nor is blocked by other bodies", () => {
    const { state, player } = rig();
    const ghost = spawnGhost(state, {
      owner: player,
      move: "decoyVeil",
      pos: { ...player.pos },
      facing: { x: 1, y: 0 },
      replayTick: -1,
      actFrames: 0,
      follow: false,
      press: null,
      attackId: null,
      ttl: 300,
      taunt: false,
    });
    const before = player.pos.x;
    run(state, 30, idleInput({ moveX: 1 }));
    expect(player.pos.x).toBeGreaterThan(before + 10);
    expect(ghost.pos.x).toBe(before);
  });
});
