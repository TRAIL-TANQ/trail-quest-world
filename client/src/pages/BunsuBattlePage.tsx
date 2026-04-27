/**
 * BunsuBattlePage — 🔵 分数バトル
 *
 * 分数の計算問題を連続で解くスコアアタック。5段階の難易度。
 *
 * 回答ルール:
 *   - ★1: 同分母のみ、約分不要（生成時点で既約）
 *   - ★2〜★4: 約分必須（未約分は不正解）
 *   - ★5: 帯分数許容。整数部>0のときは分子 < 分母 必須。分数部は約分必須
 *   - 分母に 0 は入力できない
 *   - 値比較は既約形（canonical）で行う
 *
 * 問題生成は答えの分母が 20 以下、★5 の整数部は 5 以下に制限。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { playSuccess, playError, playTap, playDefeat, playBattleStart } from '@/lib/sfx';
import { finalizeAltGame, getGameDailyRemaining } from '@/lib/altGameService';
import { useGameTimer } from '@/hooks/useGameTimer';

type Phase = 'start' | 'playing' | 'result';
type DiffId = 1 | 2 | 3 | 4 | 5;
type Field = 'integer' | 'numerator' | 'denominator';

interface Frac {
  integer: number;
  numerator: number;
  denominator: number;
}

interface Problem {
  text: string;
  answer: Frac;
}

interface ComboTier {
  threshold: number;
  multiplier: number;
  label: string;
}

interface DiffConfig {
  id: DiffId;
  label: string;
  timeSeconds: number;
  altPerCorrect: number;
  comboTiers: ComboTier[];
  needsReduce: boolean;   // 入力を既約形に限定するか
  allowsMixed: boolean;   // 整数部入力を許可するか（★5のみ）
  note?: string;          // ルール説明
}

const GAME_TYPE = 'bunsu_battle' as const;
const BEST_KEY_PREFIX = 'bunsu_best_';

const DIFF_CONFIGS: Record<DiffId, DiffConfig> = {
  1: { id: 1, label: 'かんたん',   timeSeconds: 30, altPerCorrect: 1, comboTiers: [], needsReduce: false, allowsMixed: false, note: '同分母の足し引き' },
  2: { id: 2, label: 'ふつう',     timeSeconds: 30, altPerCorrect: 1, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
  ], needsReduce: true, allowsMixed: false, note: '約分して答える' },
  3: { id: 3, label: 'むずかしい', timeSeconds: 30, altPerCorrect: 2, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
  ], needsReduce: true, allowsMixed: false, note: '通分＋約分' },
  4: { id: 4, label: 'ゲキむず',   timeSeconds: 45, altPerCorrect: 3, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
  ], needsReduce: true, allowsMixed: false, note: '分数の掛け割り' },
  5: { id: 5, label: '鬼',         timeSeconds: 30, altPerCorrect: 5, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
    { threshold: 15, multiplier: 5, label: '✨ 伝説コンボ ×5' },
  ], needsReduce: true, allowsMixed: true, note: '帯分数＋四則混合' },
};

const DIFF_ORDER: DiffId[] = [1, 2, 3, 4, 5];

// ===== Math helpers =====

function gcd(a: number, b: number): number {
  a = Math.abs(Math.floor(a)); b = Math.abs(Math.floor(b));
  while (b !== 0) { [a, b] = [b, a % b]; }
  return a || 1;
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function reduceFrac(num: number, den: number): { num: number; den: number } {
  const g = gcd(num, den);
  return { num: Math.floor(num / g), den: Math.floor(den / g) };
}

function canonical(f: Frac): { num: number; den: number } {
  // mixed form → improper fraction, then reduce
  const n = f.integer * f.denominator + f.numerator;
  return reduceFrac(n, f.denominator);
}

function valueToMixed(num: number, den: number): Frac {
  const r = reduceFrac(num, den);
  const integer = Math.floor(r.num / r.den);
  const numerator = r.num - integer * r.den;
  return { integer, numerator, denominator: r.den };
}

function valueToProper(num: number, den: number): Frac {
  const r = reduceFrac(num, den);
  return { integer: 0, numerator: r.num, denominator: r.den };
}

// ===== Problem generation =====

function genLv1(): Problem {
  // 同分母の足し引き、分母は {2,3,4,5}、答えは0<x<1かつ既約
  for (let i = 0; i < 40; i++) {
    const den = [2, 3, 4, 5][rand(0, 3)];
    const op = Math.random() < 0.5 ? '+' : '-';
    const a = rand(1, den - 1);
    const b = rand(1, den - 1);
    if (op === '+') {
      const sum = a + b;
      if (sum >= den) continue; // 1以上になると帯分数必要。★1では避ける
      if (gcd(sum, den) !== 1) continue;
      return { text: `${a}/${den} + ${b}/${den}`, answer: { integer: 0, numerator: sum, denominator: den } };
    } else {
      if (a <= b) continue;
      const diff = a - b;
      if (gcd(diff, den) !== 1) continue;
      return { text: `${a}/${den} - ${b}/${den}`, answer: { integer: 0, numerator: diff, denominator: den } };
    }
  }
  // フォールバック
  return { text: `1/4 + 2/4`, answer: { integer: 0, numerator: 3, denominator: 4 } };
}

function genLv2(): Problem {
  // 同分母、分母は {4,6,8,9,10,12}、答えは0<x<1、約分必要なことがある
  for (let i = 0; i < 40; i++) {
    const den = [4, 6, 8, 9, 10, 12][rand(0, 5)];
    const op = Math.random() < 0.5 ? '+' : '-';
    const a = rand(1, den - 1);
    const b = rand(1, den - 1);
    if (op === '+') {
      const sum = a + b;
      if (sum >= den) continue;
      const r = reduceFrac(sum, den);
      return { text: `${a}/${den} + ${b}/${den}`, answer: { integer: 0, numerator: r.num, denominator: r.den } };
    } else {
      if (a <= b) continue;
      const diff = a - b;
      const r = reduceFrac(diff, den);
      return { text: `${a}/${den} - ${b}/${den}`, answer: { integer: 0, numerator: r.num, denominator: r.den } };
    }
  }
  return { text: `2/6 + 2/6`, answer: { integer: 0, numerator: 2, denominator: 3 } };
}

function genLv3(): Problem {
  // 異分母の足し引き、分母は {2..6}、答えは0<x<1、既約に
  for (let i = 0; i < 60; i++) {
    const d1 = rand(2, 6);
    let d2 = rand(2, 6);
    if (d2 === d1) d2 = d1 + 1 > 6 ? d1 - 1 : d1 + 1;
    const a = rand(1, d1 - 1);
    const b = rand(1, d2 - 1);
    const op = Math.random() < 0.5 ? '+' : '-';
    const L = lcm(d1, d2);
    if (L > 30) continue;
    const an = a * (L / d1);
    const bn = b * (L / d2);
    const resNum = op === '+' ? an + bn : an - bn;
    if (resNum <= 0) continue;
    if (resNum >= L) continue;
    const r = reduceFrac(resNum, L);
    if (r.den > 20) continue;
    return { text: `${a}/${d1} ${op} ${b}/${d2}`, answer: { integer: 0, numerator: r.num, denominator: r.den } };
  }
  return { text: `1/3 + 1/4`, answer: { integer: 0, numerator: 7, denominator: 12 } };
}

function genLv4(): Problem {
  // 分数の掛け割り、分子分母は {2..6}、答えの分母 ≤ 20
  for (let i = 0; i < 60; i++) {
    const op = Math.random() < 0.5 ? '×' : '÷';
    const a = rand(1, 5);
    const b = rand(2, 6);
    const c = rand(1, 5);
    const d = rand(2, 6);
    if (a >= b || c >= d) continue; // 真分数のみ使う
    let n: number, dn: number;
    if (op === '×') {
      n = a * c; dn = b * d;
    } else {
      n = a * d; dn = b * c;
    }
    if (n === 0) continue;
    const r = reduceFrac(n, dn);
    if (r.den > 20) continue;
    if (r.num === 0) continue;
    if (r.num >= r.den) continue; // 真分数に限定して簡単に
    return { text: `${a}/${b} ${op} ${c}/${d}`, answer: { integer: 0, numerator: r.num, denominator: r.den } };
  }
  return { text: `2/3 × 3/4`, answer: { integer: 0, numerator: 1, denominator: 2 } };
}

function genLv5(): Problem {
  // 帯分数＋簡単分数、または 分数×分数＋分数
  for (let i = 0; i < 80; i++) {
    const pattern = Math.random();
    if (pattern < 0.5) {
      // A + a/b op c/d  (opは +/-)
      const A = rand(1, 3);
      const b = rand(2, 6);
      const a = rand(1, b - 1);
      const d = rand(2, 6);
      const c = rand(1, d - 1);
      const op = Math.random() < 0.5 ? '+' : '-';
      const L = lcm(b, d);
      if (L > 30) continue;
      // value = A*b + a (over b) op c (over d) ; convert to L
      const left = (A * b + a) * (L / b);
      const right = c * (L / d);
      const resNum = op === '+' ? left + right : left - right;
      if (resNum <= 0) continue;
      const r = reduceFrac(resNum, L);
      if (r.den > 20) continue;
      const mixed = valueToMixed(r.num, r.den);
      return {
        text: `${A}と${a}/${b} ${op} ${c}/${d}`,
        answer: mixed,
      };
    }
    // a/b × c/d + e/f
    const a = rand(1, 4), b = rand(2, 6);
    const c = rand(1, 4), d = rand(2, 6);
    const e = rand(1, 4), f = rand(2, 6);
    if (a >= b || c >= d || e >= f) continue;
    // (a*c)/(b*d) + e/f
    const n1 = a * c, d1 = b * d;
    const L = lcm(d1, f);
    if (L > 40) continue;
    const numSum = n1 * (L / d1) + e * (L / f);
    if (numSum === 0) continue;
    const r = reduceFrac(numSum, L);
    if (r.den > 20) continue;
    const mixed = valueToMixed(r.num, r.den);
    return {
      text: `${a}/${b} × ${c}/${d} + ${e}/${f}`,
      answer: mixed,
    };
  }
  return { text: `1と1/3 + 2/5`, answer: { integer: 1, numerator: 11, denominator: 15 } };
}

function generate(diff: DiffId): Problem {
  switch (diff) {
    case 1: return genLv1();
    case 2: return genLv2();
    case 3: return genLv3();
    case 4: return genLv4();
    case 5: return genLv5();
  }
}

function generateUnique(diff: DiffId, prev: Problem | null): Problem {
  for (let i = 0; i < 10; i++) {
    const p = generate(diff);
    if (!prev || p.text !== prev.text) return p;
  }
  return generate(diff);
}

// ===== Answer check =====

function isValidInput(input: Frac, cfg: DiffConfig): boolean {
  if (input.denominator <= 0) return false;
  if (input.numerator < 0 || input.integer < 0) return false;
  if (!cfg.allowsMixed && input.integer !== 0) return false;
  if (cfg.allowsMixed && input.integer > 0 && input.numerator >= input.denominator) return false;
  if (cfg.needsReduce) {
    // 分子が0でなく、かつ分子と分母に共通因数がある場合は不正解
    if (input.numerator > 0 && gcd(input.numerator, input.denominator) !== 1) return false;
  }
  return true;
}

function checkAnswer(input: Frac, expected: Frac, cfg: DiffConfig): boolean {
  if (!isValidInput(input, cfg)) return false;
  const a = canonical(input);
  const b = canonical(expected);
  return a.num === b.num && a.den === b.den;
}

// ===== combo helpers =====

function comboMult(combo: number, tiers: ComboTier[]): number {
  let mult = 1;
  for (const t of tiers) if (combo >= t.threshold) mult = t.multiplier;
  return mult;
}
function tierFor(combo: number, tiers: ComboTier[]): ComboTier | null {
  for (let i = tiers.length - 1; i >= 0; i--) if (combo === tiers[i].threshold) return tiers[i];
  return null;
}

// ===== best score =====
function bestKey(childId: string, diff: DiffId): string {
  return `${BEST_KEY_PREFIX}${childId}_d${diff}`;
}
function getBestScore(childId: string, diff: DiffId): number {
  try { return parseInt(localStorage.getItem(bestKey(childId, diff)) || '0', 10); } catch { return 0; }
}
function saveBestScore(childId: string, diff: DiffId, score: number): boolean {
  const prev = getBestScore(childId, diff);
  if (score > prev) {
    try { localStorage.setItem(bestKey(childId, diff), String(score)); } catch { /* */ }
    return true;
  }
  return false;
}

// ===== Frac display helpers =====

function fracText(f: Frac): string {
  if (f.integer === 0) return `${f.numerator}/${f.denominator}`;
  return `${f.integer}と${f.numerator}/${f.denominator}`;
}

// ===== Component =====

export default function BunsuBattlePage() {
  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const [phase, setPhase] = useState<Phase>('start');
  const [selectedDiff, setSelectedDiff] = useState<DiffId>(1);
  const [activeDiff, setActiveDiff] = useState<DiffId>(1);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [inputInt, setInputInt] = useState('');
  const [inputNum, setInputNum] = useState('');
  const [inputDen, setInputDen] = useState('');
  const [activeField, setActiveField] = useState<Field>('numerator');

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [altEarned, setAltEarned] = useState(0);
  const [limited, setLimited] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showAnswerFrac, setShowAnswerFrac] = useState<Frac | null>(null);
  const [comboFlash, setComboFlash] = useState<string | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const activeCfg = DIFF_CONFIGS[activeDiff];
  const selectedCfg = DIFF_CONFIGS[selectedDiff];

  const bestScore = useMemo(() => getBestScore(userId, selectedDiff), [userId, selectedDiff, phase]);
  const remaining = useMemo(() => getGameDailyRemaining(userId, GAME_TYPE), [userId, phase]);

  const altAccumRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const gameTimer = useGameTimer();

  const startGame = useCallback(() => {
    playBattleStart();
    const cfg = DIFF_CONFIGS[selectedDiff];
    altAccumRef.current = 0;
    savedRef.current = false;
    gameTimer.start();
    setActiveDiff(selectedDiff);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setAltEarned(0);
    setLimited(false);
    setTimeLeft(cfg.timeSeconds);
    setFeedback(null);
    setShowAnswerFrac(null);
    setComboFlash(null);
    setIsNewBest(false);
    setInputInt('');
    setInputNum('');
    setInputDen('');
    setActiveField(cfg.allowsMixed ? 'integer' : 'numerator');
    setProblem(generateUnique(selectedDiff, null));
    setPhase('playing');
  }, [selectedDiff]);

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          playDefeat();
          setPhase('result');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [phase]);

  // Save on result
  useEffect(() => {
    if (phase !== 'result' || savedRef.current) return;
    savedRef.current = true;
    const newBest = saveBestScore(userId, activeDiff, score);
    setIsNewBest(newBest);
    void finalizeAltGame({
      childId: userId,
      gameType: GAME_TYPE,
      difficulty: activeDiff,
      rawAltEarned: altAccumRef.current,
      score,
      maxCombo,
      durationSeconds: gameTimer.getElapsedSeconds(),
    }).then(({ altEarned: granted, limited: wasLimited }) => {
      if (granted > 0) addTotalAlt(granted);
      setAltEarned(granted);
      setLimited(wasLimited);
    });
  }, [phase, score, userId, activeDiff, maxCombo, addTotalAlt]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const submit = useCallback(() => {
    if (phase !== 'playing' || !problem || feedback) return;
    const cfg = activeCfg;
    const input: Frac = {
      integer: inputInt === '' ? 0 : parseInt(inputInt, 10),
      numerator: inputNum === '' ? 0 : parseInt(inputNum, 10),
      denominator: inputDen === '' ? 0 : parseInt(inputDen, 10),
    };

    const ok = checkAnswer(input, problem.answer, cfg);
    if (ok) {
      playSuccess();
      setFeedback('correct');
      const newCombo = combo + 1;
      const mult = comboMult(newCombo, cfg.comboTiers);
      altAccumRef.current += cfg.altPerCorrect * mult;
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));
      setScore((s) => s + 1);
      const tier = tierFor(newCombo, cfg.comboTiers);
      if (tier) setComboFlash(tier.label);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        setShowAnswerFrac(null);
        setComboFlash(null);
        setInputInt(''); setInputNum(''); setInputDen('');
        setActiveField(cfg.allowsMixed ? 'integer' : 'numerator');
        setProblem((prev) => generateUnique(activeDiff, prev));
      }, 300);
    } else {
      playError();
      setFeedback('wrong');
      setShowAnswerFrac(problem.answer);
      setCombo(0);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        setShowAnswerFrac(null);
        setInputInt(''); setInputNum(''); setInputDen('');
        setActiveField(cfg.allowsMixed ? 'integer' : 'numerator');
        setProblem((prev) => generateUnique(activeDiff, prev));
      }, 800);
    }
  }, [phase, problem, feedback, inputInt, inputNum, inputDen, activeCfg, combo, activeDiff]);

  const appendDigit = (d: string) => {
    if (feedback) return;
    playTap();
    const apply = (cur: string, setter: (v: string) => void) => {
      if (cur.length >= 3) return;
      setter(cur + d);
    };
    if (activeField === 'integer') apply(inputInt, setInputInt);
    else if (activeField === 'numerator') apply(inputNum, setInputNum);
    else apply(inputDen, setInputDen);
  };

  const backspace = () => {
    if (feedback) return;
    playTap();
    if (activeField === 'integer') setInputInt((s) => s.slice(0, -1));
    else if (activeField === 'numerator') setInputNum((s) => s.slice(0, -1));
    else setInputDen((s) => s.slice(0, -1));
  };

  const cycleField = () => {
    if (feedback) return;
    playTap();
    if (activeCfg.allowsMixed) {
      setActiveField((f) => (f === 'integer' ? 'numerator' : f === 'numerator' ? 'denominator' : 'integer'));
    } else {
      setActiveField((f) => (f === 'numerator' ? 'denominator' : 'numerator'));
    }
  };

  // ===== Render =====

  if (phase === 'start') {
    return (
      <div className="px-4 pt-6 pb-6 tqw-animate-fadeIn">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/alt-games">
            <button className="text-[12px] px-2 py-1 rounded"
              style={{ background: 'rgba(255,215,0,0.1)', color: 'var(--tqw-gold)', border: '1px solid rgba(255,215,0,0.25)' }}>
              ← もどる
            </button>
          </Link>
        </div>
        <div className="tqw-card-panel rounded-2xl p-6 text-center">
          <div className="text-6xl mb-3">🔵</div>
          <h1 className="text-2xl font-black mb-2 tqw-title-game">分数バトル</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--tqw-text-gray)' }}>
            分数の計算を正確に！<br />難易度を えらんでね
          </p>

          <div className="grid grid-cols-5 gap-1 mb-4">
            {DIFF_ORDER.map((d) => {
              const cfg = DIFF_CONFIGS[d];
              const sel = d === selectedDiff;
              return (
                <button
                  key={d}
                  onClick={() => { playTap(); setSelectedDiff(d); }}
                  className={`rounded-xl py-2 px-1 transition-all active:scale-95 ${sel ? 'tqw-btn-gold' : ''}`}
                  style={sel ? { minHeight: 56 } : {
                    minHeight: 56,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1.5px solid rgba(255,215,0,0.15)',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  <div className="text-[11px] font-black leading-none mb-0.5">{'★'.repeat(d)}</div>
                  <div className="text-[9px] font-bold leading-tight">{cfg.label}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-4 text-[10px]">
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>時間</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>{selectedCfg.timeSeconds}秒</div>
            </div>
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>1問</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>+{selectedCfg.altPerCorrect}</div>
            </div>
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>ルール</div>
              <div className="text-[10px] font-black leading-tight" style={{ color: 'var(--tqw-gold)' }}>{selectedCfg.note}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5 text-[12px]">
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>ハイスコア</div>
              <div className="text-lg font-black" style={{ color: 'var(--tqw-gold)' }}>{bestScore} 問</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>今日の残り</div>
              <div className="text-lg font-black" style={{ color: remaining > 0 ? 'var(--tqw-gold)' : '#ef4444' }}>
                {remaining}/5 回
              </div>
            </div>
          </div>
          {remaining === 0 && (
            <div className="text-[11px] mb-3 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              今日のALT獲得は終了。練習プレイは可能！
            </div>
          )}
          <button
            onClick={startGame}
            className="tqw-btn-battle w-full py-4 rounded-xl text-lg font-black"
            style={{ minHeight: 56 }}
          >
            スタート！
          </button>
        </div>
        <div className="tqw-card-panel rounded-xl p-4 mt-4 text-[11px]" style={{ color: 'var(--tqw-text-gray)' }}>
          <div className="font-bold mb-1" style={{ color: 'var(--tqw-gold)' }}>ルール</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>分子と分母を入力して決定</li>
            <li>★3以上は約分必須（4/6ではなく2/3）</li>
            <li>★5は「整数」ボックスに帯分数の整数部を入力</li>
            <li>入力欄をタップ or 「切替」で入力先を変更</li>
          </ul>
        </div>
      </div>
    );
  }

  if (phase === 'playing' && problem) {
    const timePct = (timeLeft / activeCfg.timeSeconds) * 100;
    const timeColor = timeLeft > activeCfg.timeSeconds * 0.5 ? '#22c55e' : timeLeft > activeCfg.timeSeconds * 0.2 ? '#eab308' : '#ef4444';
    const showMixed = activeCfg.allowsMixed;

    const fieldBox = (f: Field, value: string, widthCls: string) => {
      const isActive = activeField === f;
      return (
        <button
          onClick={() => { playTap(); setActiveField(f); }}
          className={`${widthCls} rounded-lg flex items-center justify-center font-black text-2xl active:scale-95`}
          style={{
            minHeight: 44,
            background: isActive ? 'rgba(255,215,0,0.18)' : 'rgba(0,0,0,0.4)',
            border: isActive ? '2px solid var(--tqw-gold)' : '2px solid rgba(255,215,0,0.2)',
            color: feedback === 'correct' ? '#22c55e' : feedback === 'wrong' ? '#ef4444' : '#fff',
            boxShadow: isActive ? '0 0 10px rgba(255,215,0,0.4)' : 'none',
          }}
        >
          {value || '　'}
        </button>
      );
    };

    const numerator = showAnswerFrac ? String(showAnswerFrac.numerator) : inputNum;
    const denominator = showAnswerFrac ? String(showAnswerFrac.denominator) : inputDen;
    const integerPart = showAnswerFrac ? (showAnswerFrac.integer > 0 ? String(showAnswerFrac.integer) : '') : inputInt;

    return (
      <div className="px-4 pt-4 pb-4 min-h-[calc(100vh-140px)] relative"
        style={{
          background: feedback === 'wrong'
            ? 'radial-gradient(ellipse at center, rgba(239,68,68,0.15), transparent 70%)'
            : combo >= 15
            ? 'radial-gradient(ellipse at center, rgba(255,215,0,0.18), transparent 70%)'
            : undefined,
          transition: 'background 0.2s',
        }}
      >
        <div className="flex items-center justify-between mb-3 text-[12px]">
          <div className="tqw-hud-pill">
            <span className="hud-label">{'★'.repeat(activeDiff)}</span>
          </div>
          <div className="tqw-hud-pill">
            <span className="hud-label">正解</span>
            <span className="hud-value">{score}</span>
          </div>
          <div className="tqw-hud-pill tqw-hud-pill--gold">
            <span className="hud-label">コンボ</span>
            <span className="hud-value">{combo}</span>
          </div>
        </div>

        <div className="w-full h-3 rounded-full overflow-hidden mb-3"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}
        >
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${timePct}%`, background: `linear-gradient(90deg, ${timeColor}, ${timeColor}cc)`, boxShadow: `0 0 8px ${timeColor}88` }}
          />
        </div>
        <div className="text-center text-[11px] mb-3" style={{ color: 'var(--tqw-text-gray)' }}>のこり {timeLeft} 秒</div>

        {comboFlash && (
          <div className="fixed left-1/2 -translate-x-1/2 top-1/3 z-40 pointer-events-none animate-pulse">
            <div className="text-3xl font-black px-5 py-3 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,100,0,0.25))',
                color: 'var(--tqw-gold)',
                border: '2px solid rgba(255,215,0,0.5)',
                boxShadow: '0 0 30px rgba(255,215,0,0.6)',
                textShadow: '0 0 10px rgba(255,215,0,0.8)',
              }}
            >
              {comboFlash}
            </div>
          </div>
        )}

        {/* Problem */}
        <div className="tqw-card-panel rounded-2xl p-5 mb-3 text-center"
          style={{
            border: feedback === 'correct' ? '2px solid #22c55e' :
                    feedback === 'wrong' ? '2px solid #ef4444' :
                    '1px solid rgba(197,160,63,0.3)',
          }}
        >
          <div className="text-3xl font-black mb-1" style={{ color: 'var(--tqw-gold)', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
            {problem.text} = ?
          </div>
          {showAnswerFrac && (
            <div className="text-[10px] mt-1" style={{ color: '#ef4444' }}>せいかいは {fracText(showAnswerFrac)}</div>
          )}
        </div>

        {/* Answer input */}
        <div className="tqw-card-panel rounded-2xl p-4 mb-3">
          <div className="flex items-center justify-center gap-3">
            {showMixed && (
              <>
                {fieldBox('integer', integerPart, 'w-14')}
                <div className="text-xl font-black" style={{ color: 'var(--tqw-gold)' }}>と</div>
              </>
            )}
            <div className="flex flex-col items-center gap-1">
              {fieldBox('numerator', numerator, 'w-14')}
              <div className="w-16 h-[3px] rounded" style={{ background: 'var(--tqw-gold)' }} />
              {fieldBox('denominator', denominator, 'w-14')}
            </div>
          </div>
          <div className="text-center mt-2 text-[10px]" style={{ color: 'var(--tqw-text-gray)' }}>
            {activeField === 'integer' ? '整数を入力中' : activeField === 'numerator' ? '分子（上）を入力中' : '分母（下）を入力中'}
          </div>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9'].map((d) => (
            <button
              key={d}
              onClick={() => appendDigit(d)}
              className="py-3 rounded-xl text-xl font-black active:scale-95 transition-all"
              style={{
                background: 'linear-gradient(180deg, rgba(30,40,70,0.9), rgba(15,20,40,0.95))',
                color: '#fff',
                border: '1.5px solid rgba(255,215,0,0.25)',
                minHeight: 48,
              }}
            >
              {d}
            </button>
          ))}
          <button
            onClick={cycleField}
            className="py-3 rounded-xl text-sm font-black active:scale-95 transition-all"
            style={{
              background: 'rgba(96,165,250,0.2)',
              color: '#60a5fa',
              border: '1.5px solid rgba(96,165,250,0.4)',
              minHeight: 48,
            }}
          >
            切替 ↹
          </button>
          <button
            onClick={() => appendDigit('0')}
            className="py-3 rounded-xl text-xl font-black active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(180deg, rgba(30,40,70,0.9), rgba(15,20,40,0.95))',
              color: '#fff',
              border: '1.5px solid rgba(255,215,0,0.25)',
              minHeight: 48,
            }}
          >
            0
          </button>
          <button
            onClick={backspace}
            className="py-3 rounded-xl text-lg font-black active:scale-95 transition-all"
            style={{
              background: 'rgba(239,68,68,0.15)',
              color: '#f87171',
              border: '1.5px solid rgba(239,68,68,0.4)',
              minHeight: 48,
            }}
          >
            ←
          </button>
        </div>
        <button
          onClick={submit}
          disabled={!inputNum || !inputDen || !!feedback}
          className="w-full mt-2 py-3 rounded-xl text-lg font-black active:scale-95 transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(180deg, var(--tqw-gold-light) 0%, var(--tqw-gold) 50%, var(--tqw-gold-dark) 100%)',
            color: '#1a1000',
            border: '2px solid var(--tqw-gold)',
            minHeight: 48,
          }}
        >
          決定
        </button>
      </div>
    );
  }

  // Result
  return (
    <div className="px-4 pt-6 pb-6 tqw-animate-fadeIn">
      <div className="tqw-card-panel rounded-2xl p-6 text-center">
        <div className="text-5xl mb-2">🏁</div>
        <h1 className="text-xl font-black mb-1 tqw-title-game">リザルト</h1>
        <div className="text-[12px] mb-4" style={{ color: 'var(--tqw-gold)' }}>
          {'★'.repeat(activeDiff)} {activeCfg.label}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-[12px]">
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>正解</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{score}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>最大コンボ</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{maxCombo}</div>
          </div>
          <div className="rounded-lg p-3 col-span-2" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>獲得ALT</div>
            <div className="text-2xl font-black" style={{ color: altEarned > 0 ? 'var(--tqw-gold)' : '#888' }}>+{altEarned}</div>
          </div>
        </div>

        {isNewBest && (
          <div className="text-sm font-black mb-3" style={{ color: '#ffe066', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>
            ✨ {'★'.repeat(activeDiff)} のハイスコア更新！
          </div>
        )}
        {limited && (
          <div className="text-[11px] mb-3 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            今日のALT獲得上限に達しているよ（練習プレイ）
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={startGame} className="tqw-btn-battle flex-1 py-3 rounded-xl text-base font-black" style={{ minHeight: 48 }}>
            もう一回
          </button>
          <Link href="/alt-games" className="flex-1">
            <button className="tqw-btn-quest w-full py-3 rounded-xl text-base font-black" style={{ minHeight: 48 }}>
              もどる
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
