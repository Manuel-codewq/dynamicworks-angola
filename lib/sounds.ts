/**
 * Sons sintetizados via Web Audio API — sem ficheiros externos.
 * Preferência de mute persistida em localStorage ("dw_sound_enabled").
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem("dw_sound_enabled");
  return v === null ? true : v === "1";
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem("dw_sound_enabled", enabled ? "1" : "0");
}

function tone(
  frequency: number,
  duration: number,
  startTime: number,
  gainPeak: number,
  type: OscillatorType = "sine",
) {
  const c = getCtx();
  if (!c) return;
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type      = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/** Clique curto ao abrir uma operação */
export function playOpen(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  tone(880, 0.07, now,       0.18, "sine");
  tone(440, 0.06, now + 0.07, 0.08, "sine");
}

/** Sequência ascendente de vitória */
export function playWin(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  tone(600,  0.10, now,        0.20, "sine");
  tone(800,  0.10, now + 0.11, 0.22, "sine");
  tone(1000, 0.10, now + 0.22, 0.22, "sine");
  tone(1300, 0.18, now + 0.33, 0.25, "sine");
}

/** Tom descendente de derrota */
export function playLoss(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  tone(350, 0.14, now,        0.20, "sine");
  tone(250, 0.20, now + 0.15, 0.18, "sine");
}
