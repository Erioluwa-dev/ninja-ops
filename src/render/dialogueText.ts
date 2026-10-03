/**
 * Pure text layout for the dialogue box. The pack's 8x8 font only has capitals,
 * so everything shown is upper-cased here rather than in each view.
 */

/** Greedy word wrap; a word longer than a line is split so nothing overflows. */
export function wrapText(text: string, maxChars: number): string[] {
  if (maxChars < 1) throw new Error("maxChars must be at least 1");
  const lines: string[] = [];
  let line = "";
  const flush = (): void => {
    if (line !== "") lines.push(line);
    line = "";
  };
  for (const raw of text.toUpperCase().split(/\s+/)) {
    let word = raw;
    if (word === "") continue;
    while (word.length > maxChars) {
      flush();
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (line === "") line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      flush();
      line = word;
    }
  }
  flush();
  return lines;
}

/** Splits wrapped lines into box-sized pages, each joined for display. */
export function paginate(
  text: string,
  maxChars: number,
  linesPerPage: number,
): string[] {
  const lines = wrapText(text, maxChars);
  if (lines.length === 0) return [""];
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join("\n"));
  }
  return pages;
}

/** How many characters of a page show after `frames` ticks of typewriter. */
export function revealedChars(
  frames: number,
  framesPerChar: number,
  total: number,
): number {
  return Math.min(total, Math.floor(frames / framesPerChar));
}

const SPEAKER_NAMES: Record<string, string> = {
  wu: "WU",
  kai: "KAI",
  jay: "JAY",
  zane: "ZANE",
  cole: "COLE",
  // Placeholder until the owner names the player (PRD Q11).
  fifth: "FIFTH",
};

export function speakerName(speaker: string | null): string {
  if (speaker === null) return "";
  return SPEAKER_NAMES[speaker] ?? speaker.toUpperCase();
}
