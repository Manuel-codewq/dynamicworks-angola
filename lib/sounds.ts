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

/** Win — estilo Pocket Option: 3 blings rápidos com harmónicos metálicos */
export function playWin(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  // Bling 1 — fundamental + oitava (efeito coin)
  tone(1046, 0.09, now,        0.28, "sine");
  tone(2093, 0.09, now,        0.09, "sine");
  // Bling 2
  tone(1318, 0.09, now + 0.08, 0.30, "sine");
  tone(2637, 0.09, now + 0.08, 0.09, "sine");
  // Bling 3 — final mais longo e brilhante
  tone(1568, 0.22, now + 0.16, 0.36, "sine");
  tone(3136, 0.22, now + 0.16, 0.10, "sine");
}

/** Loss — estilo Pocket Option: 2 tons descendentes "womp womp" */
export function playLoss(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  tone(300, 0.22, now,        0.30, "sawtooth");
  tone(200, 0.30, now + 0.24, 0.24, "sawtooth");
}
