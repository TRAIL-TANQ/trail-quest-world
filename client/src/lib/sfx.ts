/**
 * Lightweight Web Audio SFX helpers (no audio files needed).
 * Browsers require a user gesture before audio contexts can start; we lazily
 * create the context on first play().
 */

let _ctx: AudioContext | null = null;
let _muted = false;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) return null;
    try { _ctx = new AC(); } catch { return null; }
  }
  if (_ctx.state === 'suspended') { void _ctx.resume().catch(() => {}); }
  return _ctx;
}

export function setSfxMuted(m: boolean) { _muted = m; }
export function isSfxMuted() { return _muted; }

interface ToneOpts {
  freq: number;
  freqEnd?: number;
  dur: number;      // seconds
  type?: OscillatorType;
  gain?: number;
  delay?: number;   // seconds
}

function tone(opts: ToneOpts) {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  const now = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), now + opts.dur);
  }
  const peak = opts.gain ?? 0.08;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + opts.dur + 0.02);
}

/** 軽いタップ（カード選択など） */
export function playTap() {
  tone({ freq: 900, freqEnd: 1200, dur: 0.06, type: 'triangle', gain: 0.05 });
}

/** カードがめくれる / プレビュー表示 */
export function playCardFlip() {
  tone({ freq: 600, freqEnd: 1400, dur: 0.12, type: 'square', gain: 0.04 });
  tone({ freq: 1400, freqEnd: 900, dur: 0.08, type: 'triangle', gain: 0.05, delay: 0.08 });
}

/** カードが場に着地 */
export function playCardLand() {
  tone({ freq: 220, freqEnd: 110, dur: 0.15, type: 'sine', gain: 0.12 });
  tone({ freq: 1800, freqEnd: 900, dur: 0.08, type: 'triangle', gain: 0.05, delay: 0.02 });
}

/** バトル開始 / 大きなアクション */
export function playBattleStart() {
  tone({ freq: 400, freqEnd: 800, dur: 0.22, type: 'sawtooth', gain: 0.08 });
  tone({ freq: 800, freqEnd: 1600, dur: 0.18, type: 'square', gain: 0.05, delay: 0.1 });
}

/** 正解・ポジティブ通知 */
export function playSuccess() {
  tone({ freq: 880, dur: 0.1, type: 'triangle', gain: 0.07 });
  tone({ freq: 1320, dur: 0.12, type: 'triangle', gain: 0.06, delay: 0.08 });
}

/** 不正解・ネガティブ */
export function playError() {
  tone({ freq: 280, freqEnd: 140, dur: 0.25, type: 'sawtooth', gain: 0.07 });
}
