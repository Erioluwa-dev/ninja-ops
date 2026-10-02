import { describe, expect, it } from "vitest";
import {
  bannerText,
  bossName,
  lineCount,
  meterWidth,
  resultBody,
  waveLabel,
} from "./hudText";

describe("bossName", () => {
  it("splits a camel-case kit id into capital words", () => {
    expect(bossName("oniBrute")).toBe("ONI BRUTE");
    expect(bossName("ninja")).toBe("NINJA");
  });
});

describe("meterWidth", () => {
  it("fills in proportion and rounds to whole pixels", () => {
    expect(meterWidth(0, 100, 60)).toBe(0);
    expect(meterWidth(50, 100, 60)).toBe(30);
    expect(meterWidth(100, 100, 60)).toBe(60);
    expect(meterWidth(33, 100, 60)).toBe(20);
  });

  it("never spills the frame or goes negative", () => {
    expect(meterWidth(150, 100, 60)).toBe(60);
    expect(meterWidth(-5, 100, 60)).toBe(0);
    expect(meterWidth(5, 0, 60)).toBe(0);
  });
});

describe("waveLabel", () => {
  it("names the phase in play and is blank on result screens", () => {
    expect(waveLabel("sandbox", 0, 3)).toBe("SANDBOX");
    expect(waveLabel("wave", 2, 3)).toBe("WAVE 2/3");
    expect(waveLabel("breather", 2, 3)).toBe("WAVE 2/3");
    expect(waveLabel("boss", 3, 3)).toBe("BOSS");
    expect(waveLabel("intro", 0, 3)).toBe("");
    expect(waveLabel("victory", 3, 3)).toBe("");
  });
});

describe("bannerText", () => {
  it("shows the phase banner only while its frames last", () => {
    expect(bannerText("wave", 2, 0, 90)).toBe("WAVE 2");
    expect(bannerText("wave", 2, 89, 90)).toBe("WAVE 2");
    expect(bannerText("wave", 2, 90, 90)).toBe("");
    expect(bannerText("boss", 3, 10, 90)).toBe("BOSS");
    expect(bannerText("breather", 2, 10, 90)).toBe("WAVE 2 CLEAR");
    expect(bannerText("sandbox", 0, 10, 90)).toBe("");
  });
});

describe("resultBody", () => {
  const base = {
    won: false,
    wavesCleared: 2,
    totalWaves: 3,
    runTicks: 615,
    hitsTaken: 4,
    canRestart: true,
  };

  it("lists the run's numbers", () => {
    const lines = resultBody(base).split("\n");
    expect(lines[0]).toBe("WAVES CLEARED  2/3");
    expect(lines[1]).toBe("TIME  10.3S");
    expect(lines[2]).toBe("HITS TAKEN  4");
  });

  it("adds the boss to a win and hides restart while it is locked", () => {
    const text = resultBody({ ...base, won: true, canRestart: false });
    expect(text.split("\n")[0]).toBe("WAVES CLEARED  2/3 + BOSS");
    expect(text).not.toContain("RESTART");
    expect(resultBody(base)).toContain("ATTACK  RESTART");
  });

  it("keeps a fixed number of lines so the panel does not jump", () => {
    expect(lineCount(resultBody(base))).toBe(
      lineCount(resultBody({ ...base, canRestart: false })),
    );
  });
});
