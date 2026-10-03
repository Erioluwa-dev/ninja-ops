import { describe, expect, it } from "vitest";
import { paginate, revealedChars, speakerName, wrapText } from "./dialogueText";

describe("wrapText", () => {
  it("wraps on word boundaries within the width and upper-cases", () => {
    expect(
      wrapText("Your spinjitzu doesn't spin true. It trails.", 20),
    ).toEqual(["YOUR SPINJITZU", "DOESN'T SPIN TRUE.", "IT TRAILS."]);
  });

  it("splits a word that is longer than a line", () => {
    expect(wrapText("abcdefghij", 4)).toEqual(["ABCD", "EFGH", "IJ"]);
  });

  it("collapses whitespace and returns nothing for empty text", () => {
    expect(wrapText("  a \n  b ", 10)).toEqual(["A B"]);
    expect(wrapText("   ", 10)).toEqual([]);
  });

  it("never exceeds the width", () => {
    const text = "the quick brown fox jumps over the lazy dog ".repeat(5);
    for (const line of wrapText(text, 13)) {
      expect(line.length).toBeLessThanOrEqual(13);
    }
  });

  it("rejects a zero width", () => {
    expect(() => wrapText("a", 0)).toThrow();
  });
});

describe("paginate", () => {
  it("groups lines into pages", () => {
    expect(paginate("a b c d e f", 1, 2)).toEqual(["A\nB", "C\nD", "E\nF"]);
  });

  it("gives one empty page for empty text so a box still shows", () => {
    expect(paginate("", 10, 3)).toEqual([""]);
  });
});

describe("revealedChars", () => {
  it("reveals one character per interval and caps at the total", () => {
    expect(revealedChars(0, 2, 10)).toBe(0);
    expect(revealedChars(5, 2, 10)).toBe(2);
    expect(revealedChars(100, 2, 10)).toBe(10);
  });
});

describe("speakerName", () => {
  it("names the cast and leaves narration blank", () => {
    expect(speakerName("wu")).toBe("WU");
    expect(speakerName(null)).toBe("");
  });
});
