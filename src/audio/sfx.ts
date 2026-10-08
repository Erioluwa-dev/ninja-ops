/**
 * Tiny Web Audio SFX bus: blips, hums and UI clicks without external files.
 * Falls back silently if AudioContext is unavailable. Call `ensure()` on first
 * user gesture (attack confirm) so the context resumes.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctx = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  return ctx;
}

export function ensureAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
}

function tone(
  freq: number,
  durMs: number,
  gain: number,
  type: OscillatorType = "square",
): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(c.destination);
  const now = c.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durMs / 1000);
  osc.start(now);
  osc.stop(now + durMs / 1000);
}

const BLIP_FREQ: Record<string, number> = {
  wu: 220,
  kai: 260,
  jay: 320,
  zane: 180,
  cole: 200,
  fifth: 240,
};

export function blip(speaker: string | null): void {
  const freq = speaker ? (BLIP_FREQ[speaker] ?? 240) : 240;
  // Short, soft square blip like a GBA text tick.
  tone(freq, 45, 0.08, "square");
}

export function confirmSfx(): void {
  tone(480, 80, 0.12, "square");
  setTimeout(() => tone(640, 80, 0.1, "square"), 60);
}

export function cancelSfx(): void {
  tone(180, 100, 0.1, "square");
}

export function choiceMoveSfx(): void {
  tone(360, 40, 0.07, "square");
}

export function unlockSfx(): void {
  tone(440, 120, 0.12, "square");
  setTimeout(() => tone(550, 120, 0.12, "square"), 100);
  setTimeout(() => tone(660, 160, 0.12, "square"), 200);
}

export function sceneWhoosh(): void {
  tone(120, 180, 0.06, "sine");
}

/** Low hum for the blade / corruption, called occasionally not per-frame. */
export function humSfx(intensity: number): void {
  const freq = 55 + intensity * 0.8;
  tone(freq, 220, 0.04 + intensity * 0.0006, "sine");
}
