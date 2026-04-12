/**
 * Knowledge Challenger - Game Engine
 *
 * === Correct battle model (attack/defense auto-loop) ===
 *
 * 1. Deck phase (one time at the start): player picks 2 of 5 offered cards via quizzes.
 *    Player's deck becomes 10 (starter) + up to 2 = 12 cards.
 * 2. Battle phase: entirely automatic. The engine runs a loop of sub-battles.
 *
 *    Each sub-battle:
 *      a. flagHolder draws top of their deck as the defense card (uses defensePower)
 *      b. The attacker (the other side) reveals cards from the top of their deck one by one
 *         - each reveal adds card.attackPower to attackCurrentPower
 *      c. When attackCurrentPower >= defenseCard.defensePower the attacker wins the sub-battle
 *      d. Resolution:
 *          - defense card → defender's bench (check overflow)
 *          - all attack cards except the last → attacker's bench (check overflow)
 *          - last attack card becomes the new defender (held by the new flag holder)
 *          - flagHolder swaps to the old attacker
 *          - next sub-battle begins with the same defender card, new attacker draws from their deck
 *      e. If the attacker runs out of cards before beating the defender: game over,
 *         defender wins the match (deck-out condition)
 *      f. If any bench would overflow (>6 distinct card names): that side loses the match
 *
 * 3. Winner:
 *      - side whose opponent ran out of deck / bench first
 *      - ties are broken in favour of the player (ties cannot really happen in this model)
 *
 * === The player only interacts during the deck phase. ===
 * Battle is purely cinematic. The UI calls revealNextAttackCard() on a timer and
 * resolveBattleStep() when the attacker has accumulated enough power.
 */
import type { BattleCard } from './knowledgeCards';
import { EFFECT_COLORS, ALL_BATTLE_CARDS } from './knowledgeCards';
import type { StageRules } from './stages';

export const BENCH_MAX_SLOTS = 6;

// 2026-04 rework: 5 rounds (回戦), each containing a full battle phase.
// Each round ends when one side deck-outs or bench-overflows.
// After 5 rounds, fan totals decide the overall winner.
export const TOTAL_ROUNDS = 5;
export const TROPHY_FAN_RANGES: Array<[number, number]> = [
  [2, 3], [3, 5], [5, 7], [7, 9], [9, 11],
];
export function rollTrophyFans(round: number): number {
  const range = TROPHY_FAN_RANGES[round - 1];
  if (!range) return 0;
  const [min, max] = range;
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ---------- Types ----------

export type Side = 'player' | 'ai';

export interface BenchSlot {
  name: string;
  card: BattleCard;
  count: number;
}

export interface PlayerState {
  deck: BattleCard[];
  bench: BenchSlot[];
  isAI: boolean;
}

export type GamePhase =
  | 'deck_phase'      // player picks cards via quiz (at the start of each round)
  | 'battle_intro'    // turn banner "あなたの攻撃！" / "あなたが防御中！"
  | 'battle'          // attacker reveal loop, UI drives per-card reveals
  | 'battle_resolve'  // sub-battle ended: benches updated, about to swap roles
  | 'round_end'       // one side lost this round (deck-out or bench-overflow)
  | 'game_over';

export interface SubBattleResult {
  idx: number;
  defenderSide: Side;
  defenderCard: BattleCard;
  attackerSide: Side;
  attackCards: BattleCard[];
  attackPower: number;
  winner: Side;  // always the attacker (defender cannot win a sub-battle, they can only run out the attacker's deck → game over)
}

export interface BenchBoostDetail {
  benchCardName: string;
  atkBonus: number;
  defBonus: number;
}

export interface EffectTelop {
  text: string;
  color: string;
  key: number;
}

export interface GameState {
  phase: GamePhase;
  // Round counter (1..5). Only incremented in advanceToNextRound, NOT per sub-battle.
  round: number;
  // Sub-battle counter within the current round. Resets to 0 at each round start.
  subBattleCount: number;
  // Trophy fans: awarded to the round winner.
  trophyFans: number[];
  playerFans: number;
  aiFans: number;
  player: PlayerState;
  ai: PlayerState;
  // ===== Battle state =====
  flagHolder: Side;                     // side currently defending the flag
  defenseCard: BattleCard | null;       // defender card on the field
  attackRevealed: BattleCard[];         // cards revealed in the current attack
  attackCurrentPower: number;           // cumulative attack power so far
  lastSubBattle: SubBattleResult | null; // last resolved sub-battle (for outcome banner)
  // ===== Effect system =====
  // Per-sub-battle buffs (reset at resolveSubBattleWin)
  defenderBonus: number;                                      // ±defense for current defender
  roundAttackBonus: { player: number; ai: number };           // added to every reveal this sub-battle
  pendingAttackBonus: { player: number; ai: number };         // one-shot, consumed on next reveal
  // Persistent state
  quarantine: { player: BattleCard[]; ai: BattleCard[] };     // removed-from-play cards
  sealedBenchNames: { player: string[]; ai: string[] };       // bench names whose effects are disabled
  altBonus: number;                                           // extra ALT earned this match
  effectTelop: EffectTelop | null;                            // UI consumes & clears after 1.5s
  // Bench glow hint: set by bench-scanning effects. UI glows matching slots for ~1.5s then clears.
  benchGlow: { side: Side; names: string[]; key: number } | null;
  // Bench boost details: which bench cards contributed what bonuses (for power-up animation).
  benchBoostDetails: BenchBoostDetail[] | null;
  // How much power the last revealed attack card added (base + effects + auras, for UI display)
  lastRevealPowerAdded: number;
  // ===== Evolution / once-per-round tracking =====
  usedGiantSnake: { player: boolean; ai: boolean }; // 大蛇の呑み込み効果（1回戦1回）
  // ===== Stage rules =====
  stageRules: StageRules | null;      // null = free battle (no stage rules)
  // ===== Round result =====
  roundWinner: Side | null;           // winner of the current round (set at round_end)
  // ===== Result =====
  history: SubBattleResult[];
  winner: Side | null;
  message: string;
}

// ---------- Utilities ----------

function shuffleDeck(deck: BattleCard[]): BattleCard[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getBaseAttack(card: BattleCard): number {
  return card.attackPower ?? card.power;
}
export function getBaseDefense(card: BattleCard): number {
  return card.defensePower ?? card.power;
}

function distinctCount(bench: BenchSlot[]): number {
  return bench.length;
}

/** Get the bench max slots for a specific side, considering stage rules */
function getBenchMax(state: GameState, side: Side): number {
  if (!state.stageRules) return BENCH_MAX_SLOTS;
  if (side === 'player') return state.stageRules.benchLimit ?? BENCH_MAX_SLOTS;
  return state.stageRules.npcBenchSlots ?? BENCH_MAX_SLOTS;
}

function canAddToBench(bench: BenchSlot[], card: BattleCard, maxSlots: number = BENCH_MAX_SLOTS): boolean {
  if (bench.some((s) => s.name === card.name)) return true; // stack same-name
  return distinctCount(bench) < maxSlots;
}

function addToBench(bench: BenchSlot[], card: BattleCard): BenchSlot[] {
  const existing = bench.find((s) => s.name === card.name);
  if (existing) {
    return bench.map((s) => (s.name === card.name ? { ...s, count: s.count + 1 } : s));
  }
  return [...bench, { name: card.name, card, count: 1 }];
}

function otherSide(side: Side): Side {
  return side === 'player' ? 'ai' : 'player';
}

// ---------- Initial state ----------

export function initGameState(playerDeck: BattleCard[], aiDeck: BattleCard[], stageRules?: StageRules): GameState {
  const trophyFans = Array.from({ length: TOTAL_ROUNDS }, (_, i) => rollTrophyFans(i + 1));
  return {
    phase: 'deck_phase',
    round: 1,
    subBattleCount: 0,
    trophyFans,
    playerFans: 0,
    aiFans: 0,
    player: { deck: shuffleDeck(playerDeck), bench: [], isAI: false },
    ai: { deck: shuffleDeck(aiDeck), bench: [], isAI: true },
    flagHolder: 'player',  // player starts as flag holder (AI attacks first)
    defenseCard: null,
    attackRevealed: [],
    attackCurrentPower: 0,
    lastSubBattle: null,
    defenderBonus: 0,
    roundAttackBonus: { player: 0, ai: 0 },
    pendingAttackBonus: { player: 0, ai: 0 },
    quarantine: { player: [], ai: [] },
    sealedBenchNames: { player: [], ai: [] },
    altBonus: 0,
    effectTelop: null,
    benchGlow: null,
    benchBoostDetails: null,
    lastRevealPowerAdded: 0,
    usedGiantSnake: { player: false, ai: false },
    stageRules: stageRules ?? null,
    roundWinner: null,
    history: [],
    winner: null,
    message: 'デッキフェイズ：カードを選ぼう',
  };
}

// ---------- Effect system ----------

type Role = 'attacker' | 'defender';

export interface EffectResult {
  state: GameState;
  bonusAttack: number;  // extra attackCurrentPower added (attacker reveals only)
  telop?: { text: string; color: string };
}

function applySide(state: GameState, side: Side, next: PlayerState): GameState {
  return side === 'player' ? { ...state, player: next } : { ...state, ai: next };
}

function removeOneFromBench(bench: BenchSlot[], name: string): BenchSlot[] {
  return bench.flatMap((s) => {
    if (s.name !== name) return [s];
    if (s.count <= 1) return [];
    return [{ ...s, count: s.count - 1 }];
  });
}

/**
 * Apply a card's on-reveal effect. Called from startBattle (defender) and
 * revealNextAttackCard (attacker). Returns new state, any bonus attack power
 * to add on top of the card's base, and an optional telop for the UI.
 */
export function applyRevealEffect(
  state: GameState,
  card: BattleCard,
  side: Side,
  role: Role,
): EffectResult {
  const effId = card.effect?.id;
  if (!effId || !card.effect) return { state, bonusAttack: 0 };
  const opp = otherSide(side);
  const color = EFFECT_COLORS[card.effect.category];
  let next = state;
  let bonusAttack = 0;
  let telop: { text: string; color: string } | undefined;

  switch (effId) {
    case 'davinci': {
      if (role === 'attacker') {
        bonusAttack += 3;
        telop = { text: '🎨ダ・ヴィンチの万能の天才！攻撃+3', color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + 3 };
        telop = { text: '🎨ダ・ヴィンチの万能の天才！防御+3', color };
      }
      break;
    }
    case 'einstein': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasRelativity = my.bench.some((b) => b.name === '相対性理論の論文' && !sealed.includes(b.name));
      const hasLightspeed = my.bench.some((b) => b.name === '光速' && !sealed.includes(b.name));
      const einsteinGlow: string[] = [];
      if (hasRelativity) einsteinGlow.push('相対性理論の論文');
      if (hasLightspeed) einsteinGlow.push('光速');
      if (einsteinGlow.length > 0) next = withBenchGlow(next, side, einsteinGlow);
      if (role === 'attacker') {
        const atkBonus = hasRelativity ? 4 : 0;
        bonusAttack += atkBonus;
        if (hasRelativity && hasLightspeed) {
          const oppState = opp === 'player' ? next.player : next.ai;
          const weakened = oppState.deck.map((c) => ({
            ...c,
            attackPower: Math.max(0, getBaseAttack(c) - 1),
          }));
          next = applySide(next, opp, { ...oppState, deck: weakened });
        }
        telop = { text: `🧠アインシュタイン天才の頭脳！攻撃+${atkBonus}`, color };
      } else {
        const defBonus = hasLightspeed ? 3 : 0;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        if (hasRelativity && hasLightspeed) {
          const oppState = opp === 'player' ? next.player : next.ai;
          const weakened = oppState.deck.map((c) => ({
            ...c,
            attackPower: Math.max(0, getBaseAttack(c) - 1),
          }));
          next = applySide(next, opp, { ...oppState, deck: weakened });
        }
        telop = { text: `🧠アインシュタイン天才の頭脳！防御+${defBonus}`, color };
      }
      break;
    }
    case 'curie': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasRadium = my.bench.some((b) => b.name === 'ラジウム' && !sealed.includes(b.name));
      const hasNotes = my.bench.some((b) => b.name === '研究ノート' && !sealed.includes(b.name));
      const curieGlow: string[] = [];
      if (hasRadium) curieGlow.push('ラジウム');
      if (hasNotes) curieGlow.push('研究ノート');
      if (curieGlow.length > 0) next = withBenchGlow(next, side, curieGlow);
      if (role === 'attacker') {
        const atkBonus = hasRadium ? 3 : 0;
        bonusAttack += atkBonus;
        telop = { text: `☢️キュリー夫人！攻撃+${atkBonus}`, color };
      } else {
        const defBonus = hasNotes ? 3 : 0;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `☢️キュリー夫人！防御+${defBonus}`, color };
      }
      break;
    }
    case 'napoleon': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasCannon = my.bench.some((b) => b.name === '大砲' && !sealed.includes(b.name));
      const hasCode = my.bench.some((b) => b.name === 'ナポレオン法典' && !sealed.includes(b.name));
      const napoleonGlow: string[] = [];
      if (hasCannon) napoleonGlow.push('大砲');
      if (hasCode) napoleonGlow.push('ナポレオン法典');
      if (napoleonGlow.length > 0) next = withBenchGlow(next, side, napoleonGlow);
      if (role === 'attacker') {
        const atkBonus = hasCannon ? 4 : 0;
        bonusAttack += atkBonus;
        if (hasCannon && hasCode) {
          next = {
            ...next,
            roundAttackBonus: { ...next.roundAttackBonus, [side]: next.roundAttackBonus[side] + 1 },
          };
        }
        telop = { text: `⚡ナポレオン皇帝の号令！攻撃+${atkBonus}${hasCannon && hasCode ? ' 味方全攻+1' : ''}`, color };
      } else {
        const defBonus = hasCode ? 3 : 0;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        if (hasCannon && hasCode) {
          next = {
            ...next,
            roundAttackBonus: { ...next.roundAttackBonus, [side]: next.roundAttackBonus[side] + 1 },
          };
        }
        telop = { text: `⚡ナポレオン皇帝の号令！防御+${defBonus}`, color };
      }
      break;
    }
    case 'cleopatra': {
      const oppState = opp === 'player' ? next.player : next.ai;
      if (oppState.deck.length > 0) {
        const [top, ...rest] = oppState.deck;
        next = applySide(
          { ...next, quarantine: { ...next.quarantine, [opp]: [...next.quarantine[opp], top] } },
          opp,
          { ...oppState, deck: rest },
        );
        telop = { text: '💋クレオパトラの魅了！敵デッキ上を隔離', color };
      }
      break;
    }
    case 'nobunaga': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasGun = my.bench.some((b) => b.name === '鉄砲' && !sealed.includes(b.name));
      const hasRakuichi = my.bench.some((b) => b.name === '楽市楽座' && !sealed.includes(b.name));
      const nobunagaGlow: string[] = [];
      if (hasGun) nobunagaGlow.push('鉄砲');
      if (hasRakuichi) nobunagaGlow.push('楽市楽座');
      if (nobunagaGlow.length > 0) next = withBenchGlow(next, side, nobunagaGlow);
      if (role === 'attacker') {
        const atkBonus = hasGun ? 3 : 0;
        bonusAttack += atkBonus;
        if (hasGun && hasRakuichi) {
          const oppState = opp === 'player' ? next.player : next.ai;
          if (oppState.bench.length > 0) {
            const target = oppState.bench[0];
            next = {
              ...next,
              sealedBenchNames: {
                ...next.sealedBenchNames,
                [opp]: [...next.sealedBenchNames[opp], target.name],
              },
            };
          }
        }
        telop = { text: `🔥信長天下布武！攻撃+${atkBonus}${hasGun && hasRakuichi ? ' 敵封印' : ''}`, color };
      } else {
        const defBonus = hasRakuichi ? 2 : 0;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        if (hasGun && hasRakuichi) {
          const oppState = opp === 'player' ? next.player : next.ai;
          if (oppState.bench.length > 0) {
            const target = oppState.bench[0];
            next = {
              ...next,
              sealedBenchNames: {
                ...next.sealedBenchNames,
                [opp]: [...next.sealedBenchNames[opp], target.name],
              },
            };
          }
        }
        telop = { text: `🔥信長天下布武！防御+${defBonus}${hasGun && hasRakuichi ? ' 敵封印' : ''}`, color };
      }
      break;
    }
    case 'mozart': {
      next = {
        ...next,
        pendingAttackBonus: {
          ...next.pendingAttackBonus,
          [side]: next.pendingAttackBonus[side] + 2,
        },
      };
      telop = { text: '🎵モーツァルトの天才の旋律！次味方攻撃+2', color };
      break;
    }
    case 'galileo': {
      // Combo: +1/+1 per 「地動説」 on own bench (stacks).
      const myState = side === 'player' ? next.player : next.ai;
      const oppState = opp === 'player' ? next.player : next.ai;
      const heliocentricSlot = myState.bench.find((b) => b.name === '地動説');
      const heliocentricCount = heliocentricSlot?.count ?? 0;
      if (heliocentricCount > 0 && role === 'attacker') {
        bonusAttack += heliocentricCount;
        next = withBenchGlow(next, side, ['地動説']);
      }
      if (heliocentricCount > 0 && role === 'defender') {
        next = { ...next, defenderBonus: next.defenderBonus + heliocentricCount };
        next = withBenchGlow(next, side, ['地動説']);
      }
      // Original bench-swap effect (kept).
      const sumOf = (bench: BenchSlot[]) =>
        bench.reduce((s, b) => s + getBaseAttack(b.card) * b.count, 0);
      if (sumOf(oppState.bench) > sumOf(myState.bench)) {
        const mine = { ...myState, bench: oppState.bench };
        const theirs = { ...oppState, bench: myState.bench };
        next = applySide(applySide(next, side, mine), opp, theirs);
        telop = heliocentricCount > 0
          ? { text: `🌍ガリレオ + 地動説×${heliocentricCount}！パワー+${heliocentricCount} & ベンチ入替`, color }
          : { text: '🌍ガリレオの地動説！ベンチ入れ替え', color };
      } else if (heliocentricCount > 0) {
        telop = { text: `🌍ガリレオ + 地動説×${heliocentricCount}！攻防+${heliocentricCount}`, color };
      } else {
        telop = { text: '🌍ガリレオの地動説！入れ替え見送り', color };
      }
      break;
    }
    case 'heliocentric': {
      // Passive bench effect — no reveal action. The bonus is read by Galileo.
      telop = { text: '🌌コペルニクスの真理！ベンチでガリレオを強化', color };
      break;
    }
    case 'piranha': {
      if (role === 'attacker') {
        const myState = side === 'player' ? next.player : next.ai;
        const same = myState.bench.find((b) => b.name === card.name);
        const copies = same?.count ?? 0;
        console.log(`[Engine]   piranha check: role=${role}, benchMatch="${same?.name ?? 'none'}", copies=${copies}, bench=[${myState.bench.map(b => `${b.name}×${b.count}`).join(', ')}]`);
        if (copies > 0) {
          bonusAttack += copies;
          telop = { text: `🐟ピラニアの群れの猛攻！攻撃+${copies}`, color };
        }
      }
      break;
    }
    case 'lion': {
      if (role === 'attacker') {
        const myState = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const creatureCount = myState.bench.filter((b) => b.card.category === 'creature' && !sealed.includes(b.name)).length;
        if (creatureCount > 0) {
          bonusAttack += creatureCount;
          telop = { text: `🦁百獣の王！生き物ベンチ${creatureCount}枚で攻撃+${creatureCount}`, color };
        }
      }
      break;
    }
    case 'book_burning': {
      // 焚書坑儒: 相手デッキ上3枚を隔離。ベンチに始皇帝がいれば計5枚
      const oppState = opp === 'player' ? next.player : next.ai;
      const myState = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasQinshi = myState.bench.some((b) => b.name === '始皇帝' && !sealed.includes(b.name));
      const count = hasQinshi ? 5 : 3;
      const toQuarantine = oppState.deck.slice(0, count);
      const remaining = oppState.deck.slice(count);
      if (toQuarantine.length > 0) {
        next = applySide(
          { ...next, quarantine: { ...next.quarantine, [opp]: [...next.quarantine[opp], ...toQuarantine] } },
          opp,
          { ...oppState, deck: remaining },
        );
        if (hasQinshi) {
          next = withBenchGlow(next, side, ['始皇帝']);
          telop = { text: `📜焚書坑儒！始皇帝の命で${toQuarantine.length}枚隔離！`, color };
        } else {
          telop = { text: `📜焚書坑儒！敵デッキ上${toQuarantine.length}枚を隔離`, color };
        }
      }
      break;
    }
    case 'elixir': {
      // 不老不死の薬: passive bench effect (no reveal action)
      telop = { text: '💊不老不死の薬！始皇帝の復活を守る', color };
      break;
    }
    case 'photosynthesis': {
      // 光合成「密林の再生」: ベンチのアマゾン種族1枚をデッキ一番上に戻す
      const amazonNames = new Set(['ピラニア', 'アナコンダ', '毒矢カエル', '大蛇']);
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const amazonSlot = my.bench.find((b) => amazonNames.has(b.name) && !sealed.includes(b.name));
      if (amazonSlot) {
        // Remove one copy from bench, put on top of deck
        const newBench = removeOneFromBench(my.bench, amazonSlot.name);
        const newDeck = [amazonSlot.card, ...my.deck];
        next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
        next = withBenchGlow(next, side, [amazonSlot.name]);
        telop = { text: `🌿 密林の再生！${amazonSlot.name}をデッキ上に回収`, color };
      } else {
        telop = { text: '🌿 密林の再生（対象なし）', color };
      }
      break;
    }
    case 'dolphin': {
      const oppState = opp === 'player' ? next.player : next.ai;
      if (oppState.deck.length >= 2) {
        const [a, b, ...restDeck] = oppState.deck;
        const aStronger = getBaseAttack(a) >= getBaseAttack(b);
        const stronger = aStronger ? a : b;
        const weaker = aStronger ? b : a;
        const newDeck = [weaker, ...restDeck, stronger];
        next = applySide(next, opp, { ...oppState, deck: newDeck });
        telop = { text: '🐬イルカのエコーロケーション！敵強カード底送り', color };
      }
      break;
    }
    case 'internet': {
      const myState = side === 'player' ? next.player : next.ai;
      if (myState.bench.length > 0) {
        const pick = myState.bench[Math.floor(Math.random() * myState.bench.length)];
        const newBench = removeOneFromBench(myState.bench, pick.name);
        next = applySide(
          {
            ...next,
            quarantine: { ...next.quarantine, [side]: [...next.quarantine[side], pick.card] },
          },
          side,
          { ...myState, bench: newBench },
        );
        telop = { text: `🌐インターネットの情報革命！${pick.name}を隔離`, color };
      } else {
        telop = { text: '🌐インターネットの情報革命！対象なし', color };
      }
      break;
    }
    case 'phone': {
      telop = { text: '📞電話の通信！次デッキフェイズ強化', color };
      break;
    }
    case 'telescope': {
      // Combo: search own deck for 地動説; if found, move it to the top.
      const myState = side === 'player' ? next.player : next.ai;
      const idx = myState.deck.findIndex((c) => c.name === '地動説');
      if (idx > 0) {
        const newDeck = [...myState.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.unshift(moved);
        next = applySide(next, side, { ...myState, deck: newDeck });
        telop = { text: '🔭望遠鏡の天体観測！地動説をデッキトップへ', color };
      } else if (idx === 0) {
        telop = { text: '🔭望遠鏡の天体観測！地動説は既にトップ', color };
      } else {
        telop = { text: '🔭望遠鏡の天体観測！対象なし', color };
      }
      break;
    }
    case 'gunpowder': {
      // Passive bench effect — bonus read by Dynamite and Cannon.
      telop = { text: '💥火薬！ベンチでダイナマイト・大砲を強化', color };
      break;
    }
    case 'dynamite': {
      // Combo: +2 attack per 「火薬」 on own bench.
      if (role === 'attacker') {
        const myState = side === 'player' ? next.player : next.ai;
        const gunpowderSlot = myState.bench.find((b) => b.name === '火薬');
        const copies = gunpowderSlot?.count ?? 0;
        if (copies > 0) {
          bonusAttack += copies * 2;
          next = withBenchGlow(next, side, ['火薬']);
          telop = { text: `📋 火薬のベンチ効果！ダイナマイト 攻撃+${copies * 2}`, color };
        } else {
          telop = { text: '💣ダイナマイトの大爆発！火薬なし...', color };
        }
      }
      break;
    }
    case 'compass': {
      const my = side === 'player' ? next.player : next.ai;
      const idx = my.deck.findIndex((c) => c.name === 'コロンブス' || c.name === 'マゼラン');
      if (idx > 2) {
        const newDeck = [...my.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.splice(2, 0, moved);
        next = applySide(next, side, { ...my, deck: newDeck });
        telop = { text: `🧭羅針盤の航海術！${moved.name}を3枚以内に`, color };
      } else if (idx >= 0) {
        telop = { text: '🧭羅針盤の航海術！既に近い', color };
      } else {
        telop = { text: '🧭羅針盤の航海術！対象なし', color };
      }
      break;
    }
    case 'penicillin': {
      const myState = side === 'player' ? next.player : next.ai;
      if (myState.bench.length > 0) {
        const strongest = [...myState.bench].sort(
          (a, b) => getBaseAttack(b.card) - getBaseAttack(a.card),
        )[0];
        const newBench = removeOneFromBench(myState.bench, strongest.name);
        const newDeck = [...myState.deck, strongest.card];
        next = applySide(next, side, { ...myState, bench: newBench, deck: newDeck });
        telop = { text: `💊ペニシリンの治療！${strongest.name}をデッキへ`, color };
      } else {
        telop = { text: '💊ペニシリンの治療！対象なし', color };
      }
      break;
    }
    case 'paper': {
      next = { ...next, altBonus: next.altBonus + 5 };
      telop = { text: '📜紙の記録！+5 ALT', color };
      break;
    }
    // ===== 追加コンボ効果 =====
    case 'edison': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasBulb = my.bench.some((b) => b.name === '電球' && !sealed.includes(b.name));
      const hasPhono = my.bench.some((b) => b.name === '蓄音機' && !sealed.includes(b.name));
      const glowNames: string[] = [];
      if (hasBulb) glowNames.push('電球');
      if (hasPhono) glowNames.push('蓄音機');
      if (role === 'attacker') {
        let bonus = (hasBulb ? 1 : 0) + (hasPhono ? 1 : 0);
        if (hasBulb && hasPhono) bonus += 3;
        bonusAttack += bonus;
        if (bonus > 0) {
          next = withBenchGlow(next, side, glowNames);
          telop = { text: `📋 ${glowNames.join('・')} のベンチ効果！エジソン 攻撃+${bonus}`, color };
        }
      } else {
        if (hasPhono) {
          next = withBenchGlow({ ...next, defenderBonus: next.defenderBonus + 2 }, side, ['蓄音機']);
          telop = { text: '📋 蓄音機のベンチ効果！エジソン 防御+2', color };
        }
      }
      break;
    }
    case 'phonograph': {
      telop = { text: '🎙️蓄音機！ベンチでエジソンを強化', color };
      break;
    }
    case 'darwin': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const creatureSlots = my.bench.filter((b) => !sealed.includes(b.name) && b.card.category === 'creature');
      const creatureNamesSet: Record<string, true> = {};
      creatureSlots.forEach((b) => { creatureNamesSet[b.name] = true; });
      const creatureNames = Object.keys(creatureNamesSet);
      const n = creatureNames.length;
      const hasTortoise = creatureNames.includes('ゾウガメ');
      const hasFinch = creatureNames.includes('ダーウィンフィンチ');
      if (role === 'attacker') {
        const total = n + (hasFinch ? 2 : 0);
        bonusAttack += total;
        if (total > 0) next = withBenchGlow(next, side, creatureNames);
        telop = { text: `📋 生き物のベンチ効果！ダーウィン 攻撃+${total}`, color };
      } else {
        const total = n + (hasTortoise ? 2 : 0);
        next = { ...next, defenderBonus: next.defenderBonus + total };
        if (total > 0) next = withBenchGlow(next, side, creatureNames);
        telop = { text: `📋 生き物のベンチ効果！ダーウィン 防御+${total}`, color };
      }
      break;
    }
    case 'tortoise': case 'finch': {
      telop = { text: '🐢ガラパゴスの生き物！ダーウィンを強化', color };
      break;
    }
    case 'glider': {
      const my = side === 'player' ? next.player : next.ai;
      const idx = my.deck.findIndex((c) => c.name === 'ライト兄弟');
      if (idx > 2) {
        const newDeck = [...my.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.splice(2, 0, moved);
        next = applySide(next, side, { ...my, deck: newDeck });
        telop = { text: '🛩️グライダー！ライト兄弟を3枚以内に', color };
      } else {
        telop = { text: '🛩️グライダー！滑空試験', color };
      }
      break;
    }
    case 'wind_tunnel': {
      // 公開時：相手デッキ上2枚を隔離 (攻撃成功扱いを簡略化)
      const oppState = opp === 'player' ? next.player : next.ai;
      const slice = oppState.deck.slice(0, 2);
      if (slice.length > 0) {
        next = applySide(
          { ...next, quarantine: { ...next.quarantine, [opp]: [...next.quarantine[opp], ...slice] } },
          opp,
          { ...oppState, deck: oppState.deck.slice(slice.length) },
        );
      }
      telop = { text: `🌬️風洞実験！敵デッキ${slice.length}枚隔離`, color };
      break;
    }
    case 'wright_bros': {
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasGlider = my.bench.some((b) => b.name === 'グライダー' && !sealed.includes(b.name));
        const hasWT = my.bench.some((b) => b.name === '風洞' && !sealed.includes(b.name));
        let bonus = 0;
        if (hasGlider || hasWT) bonus += 3;
        if (hasWT) bonus += 2;
        bonusAttack += bonus;
        telop = { text: `✈️ライト兄弟初飛行！攻撃+${bonus}`, color };
      }
      break;
    }
    case 'plague': {
      const oppState = opp === 'player' ? next.player : next.ai;
      const names = oppState.bench.map((b) => b.name);
      next = {
        ...next,
        sealedBenchNames: {
          ...next.sealedBenchNames,
          [opp]: [...next.sealedBenchNames[opp], ...names],
        },
      };
      telop = { text: '🦠ペスト菌！相手ベンチ効果を封印', color };
      break;
    }
    case 'serum': {
      telop = { text: '💉血清！味方の防御を強化', color };
      break;
    }
    case 'kitasato': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasPlague = my.bench.some((b) => b.name === 'ペスト菌' && !sealed.includes(b.name));
      const hasSerum = my.bench.some((b) => b.name === '血清' && !sealed.includes(b.name));
      if (hasPlague && hasSerum && role === 'defender') {
        next = {
          ...next,
          defenderBonus: next.defenderBonus + 5,
          sealedBenchNames: { player: [], ai: [] },
        };
        telop = { text: '🧫北里柴三郎！防御+5 & 封印全解除', color };
      } else {
        telop = { text: '🧫北里柴三郎！医学の父', color };
      }
      break;
    }
    case 'terracotta': {
      telop = { text: '🗿兵馬俑！始皇帝を守護', color };
      break;
    }
    case 'qinshi': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const heritageCount = my.bench
        .filter((b) => !sealed.includes(b.name) && b.card.category === 'heritage')
        .reduce((s, b) => s + b.count, 0);
      if (role === 'attacker') {
        bonusAttack += heritageCount * 2;
        telop = { text: `👑始皇帝天下統一！攻撃+${heritageCount * 2}`, color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + heritageCount };
        telop = { text: `👑始皇帝天下統一！防御+${heritageCount}`, color };
      }
      break;
    }
    case 'amazon_river': {
      telop = { text: '🌊アマゾン川！生き物を鼓舞', color };
      break;
    }
    case 'anaconda': {
      if (role === 'attacker') {
        next = { ...next, defenderBonus: next.defenderBonus - 2 };
        // Check evolution: アマゾン川 + 毒矢カエル + ピラニア all on bench
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const benchNames = new Set(my.bench.filter((b) => !sealed.includes(b.name)).map((b) => b.name));
        if (benchNames.has('アマゾン川') && benchNames.has('毒矢カエル') && benchNames.has('ピラニア')) {
          // Evolve: replace アナコンダ in attackRevealed with 大蛇
          const giantSnakeTemplate = ALL_BATTLE_CARDS.find((c) => c.name === '大蛇');
          if (giantSnakeTemplate) {
            const evolved: BattleCard = { ...giantSnakeTemplate, id: `evolved-giant-snake-${Date.now()}` };
            const newRevealed = next.attackRevealed.map((c) => c.id === card.id ? evolved : c);
            // Recalculate power: remove anaconda's attack, add giant snake's attack
            const oldAtk = getBaseAttack(card);
            const newAtk = getBaseAttack(evolved);
            next = {
              ...next,
              attackRevealed: newRevealed,
              attackCurrentPower: next.attackCurrentPower - oldAtk + newAtk,
            };
            // Glow the 3 bench cards
            next = withBenchGlow(next, side, ['アマゾン川', '毒矢カエル', 'ピラニア']);
            telop = { text: '🐍 進化！アナコンダ → 大蛇！', color: '#ffd700' };
            console.log('[Engine] アナコンダ → 大蛇に進化！');
          } else {
            telop = { text: '🐍アナコンダ締めつけ！敵防御-2', color };
          }
        } else {
          telop = { text: '🐍アナコンダ締めつけ！敵防御-2', color };
        }
      }
      break;
    }
    case 'giant_snake': {
      // 大蛇「呑み込む者」: 攻撃時、相手防御カードを即座にベンチ送り（1回戦1回のみ）
      if (role === 'attacker' && !next.usedGiantSnake[side]) {
        if (next.defenseCard) {
          // Mark as used for this round
          next = { ...next, usedGiantSnake: { ...next.usedGiantSnake, [side]: true } };
          // Force attack power to exceed defense (instant win)
          const effectiveDef = Math.max(0, getBaseDefense(next.defenseCard!) + next.defenderBonus);
          const needed = effectiveDef - next.attackCurrentPower + getBaseAttack(card);
          if (needed > 0) {
            bonusAttack += needed;
          }
          telop = { text: '🐍 呑み込む者！防御カードを丸呑み！', color: '#ffd700' };
        }
      }
      break;
    }
    case 'poison_frog': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasAmazon = my.bench.some((b) => b.name === 'アマゾン川' && !sealed.includes(b.name));
      const n = hasAmazon ? 2 : 1;
      const oppState = opp === 'player' ? next.player : next.ai;
      const slice = oppState.deck.slice(0, n);
      if (slice.length > 0) {
        next = applySide(
          { ...next, quarantine: { ...next.quarantine, [opp]: [...next.quarantine[opp], ...slice] } },
          opp,
          { ...oppState, deck: oppState.deck.slice(slice.length) },
        );
        telop = { text: `🐸毒矢カエル！敵${slice.length}枚隔離`, color };
      }
      break;
    }
    case 'apple': {
      const my = side === 'player' ? next.player : next.ai;
      const idx = my.deck.findIndex((c) => c.name === 'ニュートン');
      if (idx > 0) {
        const newDeck = [...my.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.unshift(moved);
        next = applySide(next, side, { ...my, deck: newDeck });
        telop = { text: '🍎リンゴ！ニュートンをデッキ上へ', color };
      } else {
        telop = { text: '🍎リンゴ！落下', color };
      }
      break;
    }
    case 'prism': case 'gravity': {
      telop = { text: '🔮ニュートンを強化', color };
      break;
    }
    case 'newton': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasApple = my.bench.some((b) => b.name === 'リンゴ' && !sealed.includes(b.name));
      const hasPrism = my.bench.some((b) => b.name === 'プリズム' && !sealed.includes(b.name));
      const hasGrav = my.bench.some((b) => b.name === '万有引力' && !sealed.includes(b.name));
      const newtonGlow: string[] = [];
      if (hasApple) newtonGlow.push('リンゴ');
      if (hasPrism) newtonGlow.push('プリズム');
      if (hasGrav) newtonGlow.push('万有引力');
      if (newtonGlow.length > 0) next = withBenchGlow(next, side, newtonGlow);
      const types = (hasApple ? 1 : 0) + (hasPrism ? 1 : 0) + (hasGrav ? 1 : 0);
      const tier = types === 1 ? 1 : types === 2 ? 3 : types === 3 ? 5 : 0;
      if (role === 'attacker') {
        const total = tier + (hasPrism ? 2 : 0);
        bonusAttack += total;
        if (hasPrism) {
          // 相手防御効果無効：デバフ消去
          next = { ...next, defenderBonus: Math.min(0, next.defenderBonus) };
        }
        if (types === 3) {
          const oppState = opp === 'player' ? next.player : next.ai;
          next = {
            ...next,
            sealedBenchNames: {
              ...next.sealedBenchNames,
              [opp]: [...next.sealedBenchNames[opp], ...oppState.bench.map((b) => b.name)],
            },
          };
        }
        telop = { text: `🧠ニュートンプリンキピア！攻撃+${total}`, color };
      } else {
        const total = tier + (hasGrav ? 2 : 0);
        next = { ...next, defenderBonus: next.defenderBonus + total };
        telop = { text: `🧠ニュートンプリンキピア！防御+${total}`, color };
      }
      break;
    }
    case 'printing_press': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasBible = my.bench.some((b) => b.name === '聖書' && !sealed.includes(b.name));
      const n = hasBible ? 4 : 3;
      if (my.deck.length >= 2) {
        const topN = my.deck.slice(0, n);
        const sorted = [...topN].sort((a, b) => getBaseAttack(b) - getBaseAttack(a));
        next = applySide(next, side, { ...my, deck: [...sorted, ...my.deck.slice(n)] });
        telop = { text: `📖活版印刷！上${n}枚を並び替え`, color };
      }
      break;
    }
    case 'bible': {
      telop = { text: '✝️聖書！味方防御を強化', color };
      break;
    }
    case 'indulgence': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasLuther = my.bench.some((b) => b.name === 'ルター' && !sealed.includes(b.name));
      if (hasLuther) {
        telop = { text: '📜免罪符！ルターが封じた', color };
      } else if (my.bench.length > 0) {
        const strongest = [...my.bench].sort(
          (a, b) => getBaseAttack(b.card) - getBaseAttack(a.card),
        )[0];
        const newBench = removeOneFromBench(my.bench, strongest.name);
        next = applySide(next, side, { ...my, bench: newBench, deck: [...my.deck, strongest.card] });
        telop = { text: `📜免罪符！${strongest.name}をデッキへ`, color };
      }
      break;
    }
    case 'luther': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasBible = my.bench.some((b) => b.name === '聖書' && !sealed.includes(b.name));
      const hasPress = my.bench.some((b) => b.name === '活版印刷機' && !sealed.includes(b.name));
      if (hasBible && hasPress) {
        if (role === 'attacker') {
          bonusAttack += 5;
          const oppState = opp === 'player' ? next.player : next.ai;
          if (oppState.bench.length > 0) {
            const target = oppState.bench[0];
            const newBench = removeOneFromBench(oppState.bench, target.name);
            next = applySide(
              {
                ...next,
                quarantine: { ...next.quarantine, [opp]: [...next.quarantine[opp], target.card] },
              },
              opp,
              { ...oppState, bench: newBench },
            );
          }
        } else {
          next = { ...next, defenderBonus: next.defenderBonus + 3 };
        }
        telop = { text: '📖ルター95ヶ条！最大強化', color };
      } else if (hasBible || hasPress) {
        if (role === 'attacker') bonusAttack += 2;
        else next = { ...next, defenderBonus: next.defenderBonus + 2 };
        telop = { text: '📖ルター！強化+2', color };
      } else {
        telop = { text: '📖ルター！宗教改革', color };
      }
      break;
    }
    case 'sunflower': case 'starry_night': case 'cypress': {
      telop = { text: '🎨ゴッホの画材', color };
      break;
    }
    case 'gogh': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasS = my.bench.some((b) => b.name === 'ひまわり' && !sealed.includes(b.name));
      const hasStar = my.bench.some((b) => b.name === '星月夜' && !sealed.includes(b.name));
      const hasCyp = my.bench.some((b) => b.name === '糸杉' && !sealed.includes(b.name));
      const goghGlow: string[] = [];
      if (hasS) goghGlow.push('ひまわり');
      if (hasStar) goghGlow.push('星月夜');
      if (hasCyp) goghGlow.push('糸杉');
      if (goghGlow.length > 0) next = withBenchGlow(next, side, goghGlow);
      const types = (hasS ? 1 : 0) + (hasStar ? 1 : 0) + (hasCyp ? 1 : 0);
      const atkTier = types === 1 ? 2 : types === 2 ? 4 : types === 3 ? 6 : 0;
      const defTier = types === 2 ? 2 : types === 3 ? 4 : 0;
      if (role === 'attacker') {
        const total = atkTier + (hasS ? 2 : 0);
        bonusAttack += total;
        if (types === 3) {
          const oppState = opp === 'player' ? next.player : next.ai;
          next = {
            ...next,
            sealedBenchNames: {
              ...next.sealedBenchNames,
              [opp]: [...next.sealedBenchNames[opp], ...oppState.bench.map((b) => b.name)],
            },
          };
        }
        telop = { text: `🎨ゴッホ炎の画家！攻撃+${total}`, color };
      } else {
        const total = defTier + (hasStar ? 2 : 0);
        next = { ...next, defenderBonus: next.defenderBonus + total };
        telop = { text: `🎨ゴッホ炎の画家！防御+${total}`, color };
      }
      break;
    }
    case 'holy_sword': case 'banner': {
      telop = { text: '⚔️ジャンヌの装備', color };
      break;
    }
    case 'jeanne': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasSword = my.bench.some((b) => b.name === '聖剣' && !sealed.includes(b.name));
      const hasBanner = my.bench.some((b) => b.name === '軍旗' && !sealed.includes(b.name));
      const jeanneGlow: string[] = [];
      if (hasSword) jeanneGlow.push('聖剣');
      if (hasBanner) jeanneGlow.push('軍旗');
      if (jeanneGlow.length > 0) next = withBenchGlow(next, side, jeanneGlow);
      if (hasSword && hasBanner) {
        if (role === 'attacker') {
          bonusAttack += 4;
          const oppState = opp === 'player' ? next.player : next.ai;
          if (oppState.bench.length > 0) {
            next = {
              ...next,
              sealedBenchNames: {
                ...next.sealedBenchNames,
                [opp]: [...next.sealedBenchNames[opp], oppState.bench[0].name],
              },
            };
          }
        } else {
          next = { ...next, defenderBonus: next.defenderBonus + 4 };
        }
        telop = { text: '⚜️オルレアンの乙女！攻防+4', color };
      } else if (hasSword) {
        if (role === 'attacker') bonusAttack += 3;
        telop = { text: '⚔️聖剣の加護！攻撃+3', color };
      } else if (hasBanner) {
        if (role === 'defender') next = { ...next, defenderBonus: next.defenderBonus + 3 };
        telop = { text: '🚩軍旗の加護！防御+3', color };
      } else {
        telop = { text: '⚜️ジャンヌ・ダルク！', color };
      }
      break;
    }
    // ===== 新コンボ効果（第2弾） =====
    case 'columbus': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasCompass = my.bench.some((b) => b.name === '羅針盤' && !sealed.includes(b.name));
      if (role === 'attacker' && hasCompass) {
        bonusAttack += 3;
        next = withBenchGlow(next, side, ['羅針盤']);
      }
      // Exile 1 from top 3 of opponent deck
      const oppStateC = opp === 'player' ? next.player : next.ai;
      if (oppStateC.deck.length > 0) {
        const topN = Math.min(3, oppStateC.deck.length);
        let bestIdx = 0;
        for (let i = 1; i < topN; i++) {
          if (getBaseAttack(oppStateC.deck[i]) > getBaseAttack(oppStateC.deck[bestIdx])) bestIdx = i;
        }
        const exiled = oppStateC.deck[bestIdx];
        const newDeck = [...oppStateC.deck];
        newDeck.splice(bestIdx, 1);
        next = applySide(
          { ...next, quarantine: { ...next.quarantine, [opp]: [...next.quarantine[opp], exiled] } },
          opp, { ...oppStateC, deck: newDeck },
        );
      }
      telop = { text: hasCompass ? '🧭コロンブス新大陸発見！攻撃+3 & 敵1枚隔離' : '🌊コロンブス新大陸発見！敵1枚隔離', color };
      break;
    }
    case 'magellan': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasCompass = my.bench.some((b) => b.name === '羅針盤' && !sealed.includes(b.name));
      if (role === 'defender' && hasCompass) {
        next = { ...next, defenderBonus: next.defenderBonus + 4 };
        next = withBenchGlow(next, side, ['羅針盤']);
        telop = { text: '🌍マゼラン世界一周！防御+4', color };
      } else {
        telop = { text: '🌍マゼラン世界一周！', color };
      }
      break;
    }
    case 'caravel': case 'spice': {
      telop = { text: '⛵大航海時代の道具！', color };
      break;
    }
    case 'emc2': {
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasEinstein = my.bench.some((b) => b.name === 'アインシュタイン' && !sealed.includes(b.name));
        if (hasEinstein) {
          const baseAtk = card.attackPower ?? card.power;
          bonusAttack += baseAtk;
          next = withBenchGlow(next, side, ['アインシュタイン']);
          telop = { text: `⚛️E=mc²質量エネルギー！攻撃${baseAtk}→${baseAtk * 2}`, color };
        } else {
          telop = { text: '⚛️E=mc²！条件未達', color };
        }
      }
      break;
    }
    case 'relativity': case 'lightspeed': {
      telop = { text: '🔬アインシュタインを強化', color };
      break;
    }
    case 'gun': case 'rakuichi': {
      telop = { text: '🏯安土桃山の道具！', color };
      break;
    }
    case 'cannon': {
      // 大砲: ベンチに火薬があれば攻撃2倍
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasGunpowder = my.bench.some((b) => b.name === '火薬' && !sealed.includes(b.name));
        if (hasGunpowder) {
          const baseAtk = getBaseAttack(card);
          bonusAttack += baseAtk; // double: base already counted, add another base
          next = withBenchGlow(next, side, ['火薬']);
          telop = { text: `💥 火薬×大砲！攻撃2倍（${baseAtk}→${baseAtk * 2}）`, color };
        } else {
          telop = { text: '🏰大砲！ナポレオンの装備', color };
        }
      } else {
        telop = { text: '🏰大砲！ナポレオンの装備', color };
      }
      break;
    }
    case 'napoleon_code': case 'waterloo': {
      telop = { text: '🏰ナポレオンの装備！', color };
      break;
    }
    case 'radium': case 'research_notes': case 'nobel_medal': {
      telop = { text: '🔬科学研究の成果！', color };
      break;
    }
    case 'hideyoshi': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasNobunaga = my.bench.some((b) => b.name === '織田信長' && !sealed.includes(b.name));
      const hasRikyu = my.bench.some((b) => b.name === '千利休' && !sealed.includes(b.name));
      const hideyoshiGlow: string[] = [];
      if (hasNobunaga) hideyoshiGlow.push('織田信長');
      if (hasRikyu) hideyoshiGlow.push('千利休');
      if (hideyoshiGlow.length > 0) next = withBenchGlow(next, side, hideyoshiGlow);
      const atkBonus = hasNobunaga ? 3 : 0;
      const defBonus = (hasNobunaga ? 3 : 0) + (hasRikyu ? 2 : 0);
      if (role === 'attacker') {
        bonusAttack += atkBonus;
        telop = { text: `🌸秀吉天下統一！攻撃+${atkBonus}`, color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `🌸秀吉天下統一！防御+${defBonus}`, color };
      }
      break;
    }
    case 'rikyu': {
      telop = { text: '🍵千利休！味方防御強化', color };
      break;
    }
    case 'versailles': case 'cake': {
      telop = { text: '🏰マリーの権威', color };
      break;
    }
    case 'marie': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasVers = my.bench.some((b) => b.name === 'ヴェルサイユ宮殿' && !sealed.includes(b.name));
      const hasCake = my.bench.some((b) => b.name === 'ケーキ' && !sealed.includes(b.name));
      const marieGlow: string[] = [];
      if (hasVers) marieGlow.push('ヴェルサイユ宮殿');
      if (hasCake) marieGlow.push('ケーキ');
      if (marieGlow.length > 0) next = withBenchGlow(next, side, marieGlow);
      const deckLow = my.deck.length <= 4;
      let atk = hasCake ? 3 : 0;
      let def = hasVers ? 4 : 0;
      if (hasVers && hasCake && deckLow) {
        atk += 2;
        def += 2;
      }
      if (role === 'attacker') {
        bonusAttack += atk;
        telop = { text: `👑マリー最後の女王！攻撃+${atk}`, color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + def };
        telop = { text: `👑マリー最後の女王！防御+${def}`, color };
      }
      break;
    }
    // ===== 宝石カード + アフリカデッキ =====
    case 'diamond': {
      telop = { text: '💎ダイヤモンド不滅の輝き！防御を強化', color };
      break;
    }
    case 'ruby': {
      telop = { text: '❤️ルビー情熱の炎！攻撃を強化', color };
      break;
    }
    case 'sapphire': {
      telop = { text: '💙サファイア叡智の守り！防御を強化', color };
      break;
    }
    case 'emerald': {
      const my = side === 'player' ? next.player : next.ai;
      if (my.bench.length > 0) {
        const weakest = [...my.bench].sort(
          (a, b) => getBaseAttack(a.card) - getBaseAttack(b.card),
        )[0];
        const newBench = removeOneFromBench(my.bench, weakest.name);
        const newDeck = [...my.deck, weakest.card];
        if (newDeck.length > 0) {
          const top = newDeck[0];
          newDeck[0] = {
            ...top,
            attackPower: getBaseAttack(top) + 1,
            defensePower: getBaseDefense(top) + 1,
          };
        }
        next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
        telop = { text: `💚エメラルド再生の力！${weakest.name}をデッキへ＋上カード強化`, color };
      } else {
        telop = { text: '💚エメラルド再生の力！対象なし', color };
      }
      break;
    }
    case 'amethyst': {
      telop = { text: '💜アメジスト精神の盾！弱体化を無効化', color };
      break;
    }
    case 'mandela': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasApartheid = my.bench.some((b) => b.name === 'アパルトヘイト' && !sealed.includes(b.name));
      const distinctBenchCount = my.bench.length;
      const glow: string[] = [];
      if (hasApartheid) glow.push('アパルトヘイト');
      if (glow.length > 0) next = withBenchGlow(next, side, glow);
      // Unseal all
      next = {
        ...next,
        sealedBenchNames: { ...next.sealedBenchNames, [side]: [] },
      };
      if (role === 'attacker') {
        const atkBonus = distinctBenchCount >= 4 ? 3 : 0;
        bonusAttack += atkBonus;
        telop = { text: `✊マンデラ不屈の精神！攻撃+${atkBonus} 封印解除`, color };
      } else {
        const defBonus = hasApartheid ? 4 : 0;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `✊マンデラ不屈の精神！防御+${defBonus} 封印解除`, color };
      }
      break;
    }
    case 'apartheid': {
      telop = { text: '✊アパルトヘイト！マンデラを強化', color };
      break;
    }
    case 'african_elephant': {
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasSavanna = my.bench.some((b) => b.name === 'サバンナ' && !sealed.includes(b.name));
        let bonus = 2;
        if (hasSavanna) {
          bonus += 2;
          next = withBenchGlow(next, side, ['サバンナ']);
        }
        bonusAttack += bonus;
        telop = { text: `🐘アフリカゾウ突進！攻撃+${bonus}`, color };
      }
      break;
    }
    case 'savanna': {
      telop = { text: '🌿サバンナ！生き物を強化', color };
      break;
    }
    // ===== 産業革命デッキ =====
    case 'steam_engine': {
      telop = { text: '🔧蒸気機関！科学発明を強化', color };
      break;
    }
    case 'coal': {
      telop = { text: '⛏️石炭！燃料供給', color };
      break;
    }
    case 'spinning_machine': {
      next = { ...next, altBonus: next.altBonus + 5 };
      const myState = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasSteam = myState.bench.some((b) => b.name === '蒸気機関' && !sealed.includes(b.name));
      if (hasSteam) {
        next = { ...next, altBonus: next.altBonus + 5 };
        next = withBenchGlow(next, side, ['蒸気機関']);
        telop = { text: '🧵紡績機！ALT+10（蒸気機関込み）', color };
      } else {
        telop = { text: '🧵紡績機！ALT+5', color };
      }
      break;
    }
    case 'steam_locomotive': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasSteam = my.bench.some((b) => b.name === '蒸気機関' && !sealed.includes(b.name));
      const hasCoal = my.bench.some((b) => b.name === '石炭' && !sealed.includes(b.name));
      const wheelSlot = my.bench.find((b) => b.name === '車輪' && !sealed.includes(b.name));
      const wheelCount = wheelSlot?.count ?? 0;
      const glow: string[] = [];
      if (hasSteam) glow.push('蒸気機関');
      if (hasCoal) glow.push('石炭');
      if (wheelCount > 0) glow.push('車輪');
      if (glow.length > 0) next = withBenchGlow(next, side, glow);
      // 車輪ボーナス: +2/+2 per wheel card
      const wheelAtkBonus = wheelCount * 2;
      const wheelDefBonus = wheelCount * 2;
      if (hasSteam && hasCoal) {
        if (role === 'attacker') {
          bonusAttack += 4 + wheelAtkBonus;
        } else {
          next = { ...next, defenderBonus: next.defenderBonus + 2 + wheelDefBonus };
        }
        const quarantined = next.quarantine[side];
        if (quarantined.length > 0) {
          const recoverCount = Math.min(2, quarantined.length);
          const recovered = quarantined.slice(-recoverCount);
          const remaining = quarantined.slice(0, quarantined.length - recoverCount);
          next = applySide(
            { ...next, quarantine: { ...next.quarantine, [side]: remaining } },
            side,
            { ...my, deck: [...my.deck, ...recovered] },
          );
        }
        const atkTotal = role === 'attacker' ? 4 + wheelAtkBonus : 0;
        const defTotal = role === 'defender' ? 2 + wheelDefBonus : 0;
        telop = { text: `🚂蒸気機関車！${role === 'attacker' ? `攻撃+${atkTotal}` : `防御+${defTotal}`}${wheelCount > 0 ? ` 車輪×${wheelCount}` : ''} 隔離回収`, color };
      } else if (wheelCount > 0) {
        // 車輪のみ（蒸気機関+石炭なし）でも車輪ボーナスは付く
        if (role === 'attacker') {
          bonusAttack += wheelAtkBonus;
          telop = { text: `🚂蒸気機関車！車輪×${wheelCount}で攻撃+${wheelAtkBonus}`, color };
        } else {
          next = { ...next, defenderBonus: next.defenderBonus + wheelDefBonus };
          telop = { text: `🚂蒸気機関車！車輪×${wheelCount}で防御+${wheelDefBonus}`, color };
        }
      } else {
        telop = { text: '🚂蒸気機関車！条件未達', color };
      }
      break;
    }
    case 'wheel': {
      telop = { text: '🛞車輪！蒸気機関車を強化', color };
      break;
    }
    case 'watt': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const inventionCount = my.bench
        .filter((b) => !sealed.includes(b.name) && b.card.category === 'invention')
        .reduce((s, b) => s + b.count, 0);
      const glowNames = my.bench
        .filter((b) => !sealed.includes(b.name) && b.card.category === 'invention')
        .map((b) => b.name);
      if (glowNames.length > 0) next = withBenchGlow(next, side, glowNames);
      let atkBonus = 0;
      let defBonus = 0;
      if (inventionCount >= 4) {
        atkBonus = 5; defBonus = 3;
        next = {
          ...next,
          roundAttackBonus: { ...next.roundAttackBonus, [side]: next.roundAttackBonus[side] + 1 },
        };
      } else if (inventionCount === 3) {
        atkBonus = 3; defBonus = 2;
      } else if (inventionCount === 2) {
        atkBonus = 2; defBonus = 1;
      } else if (inventionCount === 1) {
        atkBonus = 1;
      }
      if (role === 'attacker') {
        bonusAttack += atkBonus;
        telop = { text: `⚙️ワット改良の天才！科学発明${inventionCount}枚 攻撃+${atkBonus}`, color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `⚙️ワット改良の天才！科学発明${inventionCount}枚 防御+${defBonus}`, color };
      }
      break;
    }
  }

  return { state: next, bonusAttack, telop };
}

function withTelop(state: GameState, telop?: { text: string; color: string }): GameState {
  if (!telop) return state;
  return { ...state, effectTelop: { ...telop, key: Date.now() + Math.floor(Math.random() * 1000) } };
}

function withBenchGlow(state: GameState, side: Side, names: string[]): GameState {
  if (names.length === 0) return state;
  return {
    ...state,
    benchGlow: { side, names, key: Date.now() + Math.floor(Math.random() * 1000) },
  };
}

// ===== Bench auras (passive buffs from any card on bench, not tied to a hero reveal) =====
function unsealedBenchNames(state: GameState, side: Side): { names: Set<string>; sunflower: number } {
  const me = side === 'player' ? state.player : state.ai;
  const sealed = state.sealedBenchNames[side];
  const alive = me.bench.filter((b) => !sealed.includes(b.name));
  return {
    names: new Set(alive.map((b) => b.name)),
    sunflower: alive.find((b) => b.name === 'ひまわり')?.count ?? 0,
  };
}

function computeAttackerAura(
  state: GameState,
  attackerSide: Side,
  card: BattleCard,
  priorRevealCount: number,
): { bonus: number; details: BenchBoostDetail[] } {
  const { names, sunflower } = unsealedBenchNames(state, attackerSide);
  let bonus = 0;
  const details: BenchBoostDetail[] = [];
  if (names.has('軍旗')) { bonus += 1; details.push({ benchCardName: '軍旗', atkBonus: 1, defBonus: 0 }); }
  if (names.has('アマゾン川') && card.category === 'creature') { bonus += 1; details.push({ benchCardName: 'アマゾン川', atkBonus: 1, defBonus: 0 }); }
  if (sunflower >= 2) { bonus += 1; details.push({ benchCardName: 'ひまわり', atkBonus: 1, defBonus: 0 }); }
  // Opponent 万有引力: 2枚目以降の攻撃 -1
  const opp = otherSide(attackerSide);
  const oppMe = opp === 'player' ? state.player : state.ai;
  const oppSealed = state.sealedBenchNames[opp];
  const oppHasGravity = oppMe.bench.some((b) => b.name === '万有引力' && !oppSealed.includes(b.name));
  if (oppHasGravity && priorRevealCount >= 1) { bonus -= 1; details.push({ benchCardName: '万有引力', atkBonus: -1, defBonus: 0 }); }
  // ルビー aura: 攻撃側全攻撃+1 (2枚以上で+2)
  const atkMe = attackerSide === 'player' ? state.player : state.ai;
  const atkSealed = state.sealedBenchNames[attackerSide];
  const rubySlot = atkMe.bench.find((b) => b.name === 'ルビー' && !atkSealed.includes(b.name));
  if (rubySlot) { const v = rubySlot.count >= 2 ? 2 : 1; bonus += v; details.push({ benchCardName: 'ルビー', atkBonus: v, defBonus: 0 }); }
  // サバンナ aura: 生き物カード攻撃+1
  if (names.has('サバンナ') && card.category === 'creature') { bonus += 1; details.push({ benchCardName: 'サバンナ', atkBonus: 1, defBonus: 0 }); }
  // サバンナ + アマゾン川 combo: 生き物さらに攻撃+1
  if (names.has('サバンナ') && names.has('アマゾン川') && card.category === 'creature') { bonus += 1; details.push({ benchCardName: 'サバンナ+アマゾン川', atkBonus: 1, defBonus: 0 }); }
  // 蒸気機関 aura: 科学発明カード攻撃+1 (石炭もあれば+2)
  if (names.has('蒸気機関') && card.category === 'invention') {
    const v = names.has('石炭') ? 2 : 1;
    bonus += v;
    details.push({ benchCardName: names.has('石炭') ? '蒸気機関+石炭' : '蒸気機関', atkBonus: v, defBonus: 0 });
  }
  return { bonus, details };
}

function applyDefenderAura(state: GameState, defenderSide: Side): { state: GameState; details: BenchBoostDetail[] } {
  const { names } = unsealedBenchNames(state, defenderSide);
  let bonus = 0;
  const details: BenchBoostDetail[] = [];
  if (names.has('血清')) { bonus += 1; details.push({ benchCardName: '血清', atkBonus: 0, defBonus: 1 }); }
  if (names.has('聖書')) { const v = names.has('活版印刷機') ? 2 : 1; bonus += v; details.push({ benchCardName: names.has('活版印刷機') ? '聖書+活版印刷機' : '聖書', atkBonus: 0, defBonus: v }); }
  if (names.has('千利休')) { bonus += 1; details.push({ benchCardName: '千利休', atkBonus: 0, defBonus: 1 }); }
  if (names.has('ダイヤモンド')) { bonus += 1; details.push({ benchCardName: 'ダイヤモンド', atkBonus: 0, defBonus: 1 }); }
  const defMe = defenderSide === 'player' ? state.player : state.ai;
  const defSealed = state.sealedBenchNames[defenderSide];
  const sapphireSlot = defMe.bench.find((b) => b.name === 'サファイア' && !defSealed.includes(b.name));
  if (sapphireSlot) { const v = sapphireSlot.count >= 2 ? 2 : 1; bonus += v; details.push({ benchCardName: 'サファイア', atkBonus: 0, defBonus: v }); }
  if (names.has('サバンナ') && state.defenseCard?.category === 'creature') { bonus += 1; details.push({ benchCardName: 'サバンナ', atkBonus: 0, defBonus: 1 }); }
  const coalSlot = defMe.bench.find((b) => b.name === '石炭' && !defSealed.includes(b.name));
  if (coalSlot && coalSlot.count >= 2 && state.defenseCard?.category === 'invention') { bonus += 1; details.push({ benchCardName: '石炭', atkBonus: 0, defBonus: 1 }); }
  if (bonus === 0) return { state, details: [] };
  return { state: { ...state, defenderBonus: state.defenderBonus + bonus }, details };
}

// ---------- Deck phase helpers (kept from previous version) ----------

export function addCardToDeck(state: GameState, card: BattleCard): GameState {
  return {
    ...state,
    player: { ...state.player, deck: [...state.player.deck, card] },
  };
}

export function removeCardFromDeck(state: GameState, removeIndex: number): GameState {
  const deck = [...state.player.deck];
  deck.splice(removeIndex, 1);
  return {
    ...state,
    player: { ...state.player, deck },
  };
}

export function swapCardInDeck(state: GameState, removeIndex: number, newCard: BattleCard): GameState {
  const deck = [...state.player.deck];
  deck.splice(removeIndex, 1);
  deck.push(newCard);
  return {
    ...state,
    player: { ...state.player, deck },
  };
}

// kept for stages.ts compatibility
export function aiDeckGrowth(state: GameState, newCards: BattleCard[]): GameState {
  return {
    ...state,
    ai: { ...state.ai, deck: [...state.ai.deck, ...newCards] },
  };
}

// ---------- Battle transitions ----------

/**
 * deck_phase → battle_intro.
 * Draws the initial defense card from the flag holder's deck.
 */
export function startBattle(state: GameState): GameState {
  if (state.phase !== 'deck_phase') return state;
  const holder = state.flagHolder === 'player' ? state.player : state.ai;
  if (holder.deck.length === 0) {
    // Flag holder's deck is empty at battle start → other side wins this round
    const roundWinnerSide = otherSide(state.flagHolder);
    return {
      ...state,
      phase: 'round_end',
      roundWinner: roundWinnerSide,
      message: `第${state.round}回戦: ${roundWinnerSide === 'player' ? 'あなた' : '相手'}の勝利！(デッキ切れ)`,
    };
  }
  const [defender, ...rest] = holder.deck;
  const updatedHolder: PlayerState = { ...holder, deck: rest };
  let next: GameState = {
    ...state,
    phase: 'battle_intro',
    player: state.flagHolder === 'player' ? updatedHolder : state.player,
    ai: state.flagHolder === 'ai' ? updatedHolder : state.ai,
    defenseCard: defender,
    attackRevealed: [],
    attackCurrentPower: 0,
    message: state.flagHolder === 'player' ? 'あなたが防御中！' : 'あなたの攻撃！',
  };

  // Defender reveal triggers effect
  console.log(`[Engine] startBattle: defender="${defender.name}" (effect=${defender.effect?.id ?? 'none'}) | flagHolder=${state.flagHolder}`);
  if (defender.effect) {
    const eff = applyRevealEffect(next, defender, state.flagHolder, 'defender');
    next = withTelop(eff.state, eff.telop);
    console.log(`[Engine]   defender effect "${defender.effect.id}" applied`);
  }
  const defAura = applyDefenderAura(next, state.flagHolder);
  next = defAura.state;
  if (defAura.details.length > 0) {
    next = { ...next, benchBoostDetails: defAura.details };
  }

  // NPC stage bonus (defense)
  if (state.flagHolder === 'ai' && state.stageRules) {
    const r = state.stageRules;
    if (r.npcDefenseBonus && r.npcDefenseBonusFilter) {
      if (defender.category === r.npcDefenseBonusFilter) {
        next = { ...next, defenderBonus: next.defenderBonus + r.npcDefenseBonus };
      }
    } else if (r.npcDefenseBonus) {
      next = { ...next, defenderBonus: next.defenderBonus + r.npcDefenseBonus };
    }
  }

  return next;
}

/**
 * battle_intro → battle. No state change beyond phase (the UI uses this
 * transition to know when to start the reveal loop).
 */
export function beginAttackLoop(state: GameState): GameState {
  if (state.phase !== 'battle_intro') return state;
  return { ...state, phase: 'battle' };
}

/**
 * Reveal the top card of the attacker's deck. Adds it to attackRevealed and
 * bumps attackCurrentPower by the card's attackPower.
 *
 * If the attacker's deck is empty and they haven't beaten the defender,
 * transitions to game_over with the defender as winner (deck-out rule).
 */
export function revealNextAttackCard(state: GameState): GameState {
  if (state.phase !== 'battle') return state;
  const attackerSide = otherSide(state.flagHolder);
  const attacker = attackerSide === 'player' ? state.player : state.ai;

  if (attacker.deck.length === 0) {
    // Attacker ran out of cards → defender wins THIS ROUND.
    const roundWinnerSide = state.flagHolder; // defender wins
    console.log(`[Engine] デッキ切れ: ${attackerSide} のデッキが0枚 → ${roundWinnerSide} が第${state.round}回戦勝利`);
    return {
      ...state,
      phase: 'round_end',
      roundWinner: roundWinnerSide,
      message: `第${state.round}回戦: ${roundWinnerSide === 'player' ? 'あなた' : '相手'}の勝利！(デッキ切れ)`,
    };
  }

  const [nextCard, ...rest] = attacker.deck;
  const updatedAttacker: PlayerState = { ...attacker, deck: rest };

  // Pre-compute buffs BEFORE consuming pending
  const roundBonus = state.roundAttackBonus[attackerSide];
  const pendingBonus = state.pendingAttackBonus[attackerSide];

  let next: GameState = {
    ...state,
    player: attackerSide === 'player' ? updatedAttacker : state.player,
    ai: attackerSide === 'ai' ? updatedAttacker : state.ai,
    attackRevealed: [...state.attackRevealed, nextCard],
    // Consume pending buff
    pendingAttackBonus: { ...state.pendingAttackBonus, [attackerSide]: 0 },
  };

  let addedPower = getBaseAttack(nextCard) + roundBonus + pendingBonus;

  // NPC stage bonus (attack)
  if (attackerSide === 'ai' && state.stageRules) {
    const r = state.stageRules;
    if (r.npcAttackBonus && r.npcAttackBonusFilter) {
      if (nextCard.category === r.npcAttackBonusFilter) addedPower += r.npcAttackBonus;
    } else if (r.npcAttackBonus) {
      addedPower += r.npcAttackBonus;
    }
  }

  // Card-specific on-reveal effect
  const myBench = (attackerSide === 'player' ? next.player : next.ai).bench;
  console.log(`[Engine] revealNextAttackCard: "${nextCard.name}" (effect=${nextCard.effect?.id ?? 'none'}) | attacker=${attackerSide} | bench=[${myBench.map(b => `${b.name}×${b.count}`).join(', ')}]`);
  if (nextCard.effect) {
    const eff = applyRevealEffect(next, nextCard, attackerSide, 'attacker');
    next = withTelop(eff.state, eff.telop);
    addedPower += eff.bonusAttack;
    console.log(`[Engine]   effect "${nextCard.effect.id}" → bonusAttack=${eff.bonusAttack}, telop="${eff.telop?.text ?? 'none'}"`);
  }

  // Bench auras from passive cards (any-reveal buffs from own/opponent bench)
  const aura = computeAttackerAura(next, attackerSide, nextCard, state.attackRevealed.length);
  addedPower += aura.bonus;
  if (aura.bonus !== 0) console.log(`[Engine]   bench aura → bonus=${aura.bonus}, details=[${aura.details.map(d => `${d.benchCardName}:atk${d.atkBonus}`).join(', ')}]`);

  const newPower = state.attackCurrentPower + addedPower;
  console.log(`[Engine]   total addedPower=${addedPower} (base=${getBaseAttack(nextCard)}) → cumulative=${newPower}`);
  return {
    ...next,
    attackCurrentPower: newPower,
    lastRevealPowerAdded: addedPower,
    benchBoostDetails: aura.details.length > 0 ? aura.details : null,
    message: `${attackerSide === 'player' ? 'あなたの' : '相手の'}攻撃パワー ${newPower}`,
  };
}

/**
 * True if the attacker has accumulated enough power to beat the current defender.
 */
export function hasAttackSucceeded(state: GameState): boolean {
  if (!state.defenseCard) return false;
  const effectiveDefense = Math.max(0, getBaseDefense(state.defenseCard) + state.defenderBonus);
  return state.attackCurrentPower >= effectiveDefense;
}

/**
 * Resolve a successful sub-battle (2026-04 quarantine rules):
 *  - Defender loses: defender card → defender's bench, AND defender's existing
 *    quarantine flows into defender's bench (cumulative flush).
 *    If the flush overflows (>BENCH_MAX_SLOTS distinct names) → game over, attacker wins.
 *  - Attacker wins: all non-last attack cards → attacker's quarantine (NOT bench).
 *    Last attack card → new defender.
 *  - flagHolder swaps to the old attacker.
 *  - phase → battle_resolve (UI shows summary then calls continueAfterResolve).
 *
 * Quarantine is a temporary holding zone: it does NOT count as bench space
 * while the player still holds the flag, but one lost defense dumps the
 * whole backlog onto the bench. High-risk / high-reward.
 */
export function resolveSubBattleWin(state: GameState): GameState {
  if (state.phase !== 'battle' || !state.defenseCard || state.attackRevealed.length === 0) return state;

  const defenderSide: Side = state.flagHolder;
  const attackerSide: Side = otherSide(defenderSide);
  const defenderCard = state.defenseCard;

  // ===== Leave-field triggers =====
  // 糸杉: ゴッホが場を離れる時、ベンチではなく隔離へ
  // 兵馬俑: 始皇帝が場を離れる時、代わりに隔離
  // ケーキ: マリー・アントワネット が場を離れる時、相手デッキ上2枚を隔離
  const defenderState0 = defenderSide === 'player' ? state.player : state.ai;
  const defSealed0 = state.sealedBenchNames[defenderSide];
  const dBenchNamesSet = new Set(
    defenderState0.bench.filter((b) => !defSealed0.includes(b.name)).map((b) => b.name),
  );
  let reroutedDefender = false;
  let defenderToDeckBottom = false; // 不老不死の薬: 始皇帝をデッキ底に戻す
  const leaveQuarantineDefender: BattleCard[] = [];
  if (defenderCard.name === 'ゴッホ' && dBenchNamesSet.has('糸杉')) {
    reroutedDefender = true;
    leaveQuarantineDefender.push(defenderCard);
  }
  // 不老不死の薬: 始皇帝をベンチではなくデッキ底に戻す（兵馬俑より優先）
  if (defenderCard.name === '始皇帝' && dBenchNamesSet.has('不老不死の薬')) {
    reroutedDefender = true;
    defenderToDeckBottom = true;
    console.log('[Engine] 不老不死の薬発動！始皇帝をデッキ底に戻す');
  } else if (defenderCard.name === '始皇帝' && dBenchNamesSet.has('兵馬俑')) {
    reroutedDefender = true;
    leaveQuarantineDefender.push(defenderCard);
  }
  let attackerDeckTrim = 0;
  const leaveQuarantineOpp: BattleCard[] = [];
  if (defenderCard.name === 'マリー・アントワネット' && dBenchNamesSet.has('ケーキ')) {
    const atkState = attackerSide === 'player' ? state.player : state.ai;
    leaveQuarantineOpp.push(...atkState.deck.slice(0, 2));
    attackerDeckTrim = leaveQuarantineOpp.length;
  }

  // Defender's bench receives: (old defender card unless rerouted) + (flushed quarantine).
  const defenderState = defenderSide === 'player' ? state.player : state.ai;
  const flushedCards = reroutedDefender
    ? [...state.quarantine[defenderSide]]
    : [defenderCard, ...state.quarantine[defenderSide]];
  let newDefenderBench = defenderState.bench;
  console.log(`[Engine] resolveSubBattleWin: ${defenderSide} bench BEFORE flush: ${newDefenderBench.length}/6 slots`, newDefenderBench.map(s => `${s.name}×${s.count}`).join(', '));
  console.log(`[Engine]   flushing ${flushedCards.length} cards:`, flushedCards.map(c => c.name).join(', '));
  const unflushed: BattleCard[] = [];
  let benchOverflow = false;
  for (let fi = 0; fi < flushedCards.length; fi++) {
    const c = flushedCards[fi];
    const alreadyOnBench = newDefenderBench.some((s) => s.name === c.name);
    const slotsUsed = newDefenderBench.length;
    const defBenchMax = getBenchMax(state, defenderSide);
    if (!canAddToBench(newDefenderBench, c, defBenchMax)) {
      unflushed.push(...flushedCards.slice(fi));
      benchOverflow = true;
      console.log(`[Engine] ベンチ満杯！ ${defenderSide} bench=${slotsUsed}/${defBenchMax} slots, card="${c.name}" alreadyOnBench=${alreadyOnBench} → game_over`);
      console.log(`[Engine]   bench slots:`, newDefenderBench.map(s => `${s.name}×${s.count}`).join(', '));
      console.log(`[Engine]   flushed ${fi}/${flushedCards.length} cards, ${unflushed.length} stuck`);
      break;
    }
    newDefenderBench = addToBench(newDefenderBench, c);
    console.log(`[Engine]   +${c.name} → bench now ${newDefenderBench.length}/6 slots`);
  }
  if (benchOverflow) {
    // Update state with the partial flush so result screen shows accurate bench
    const updatedDefender = { ...defenderState, bench: newDefenderBench };
    const overflowCard = unflushed[0]?.name ?? '?';
    return {
      ...state,
      phase: 'round_end',
      roundWinner: attackerSide,  // attacker wins when defender's bench overflows
      message: `第${state.round}回戦: ${attackerSide === 'player' ? 'あなた' : '相手'}の勝利！(ベンチ満杯「${overflowCard}」)`,
      player: defenderSide === 'player' ? updatedDefender : state.player,
      ai: defenderSide === 'ai' ? updatedDefender : state.ai,
      quarantine: {
        ...state.quarantine,
        [defenderSide]: unflushed,
      },
    };
  }

  console.log(`[Engine] resolveSubBattleWin: ${defenderSide} defended with "${defenderCard.name}", flushed ${flushedCards.length} cards to bench (bench now ${newDefenderBench.length}/6)`);
  console.log(`[Engine]   quarantine[${defenderSide}] was ${state.quarantine[defenderSide].length} → flushed to bench, clearing`);

  // Split attack cards: all except last → attacker's quarantine; last becomes new defender.
  const attackCards = state.attackRevealed;
  const lastAttackCard = attackCards[attackCards.length - 1];
  const otherAttackCards = attackCards.slice(0, -1);
  const newAttackerQuarantine = [...state.quarantine[attackerSide], ...otherAttackCards];
  console.log(`[Engine]   quarantine[${attackerSide}]: ${state.quarantine[attackerSide].length} + ${otherAttackCards.length} non-last attack cards = ${newAttackerQuarantine.length}`);

  // Apply leave-trigger quarantine additions (糸杉/兵馬俑 reroute defender, ケーキ quarantines opp deck top).
  const defenderLeaveQuarantine = [...leaveQuarantineDefender];
  const attackerLeaveQuarantine = [...leaveQuarantineOpp];
  // Update quarantine map: defender's cleared (flushed to bench), attacker's appended.
  const finalAttackerQuarantine = [...newAttackerQuarantine, ...attackerLeaveQuarantine];
  const newQuarantine = {
    ...state.quarantine,
    [defenderSide]: defenderLeaveQuarantine,
    [attackerSide]: finalAttackerQuarantine,
  };
  console.log(`[Engine]   quarantine AFTER: player=[${newQuarantine.player.map(c=>c.name).join(',')}] ai=[${newQuarantine.ai.map(c=>c.name).join(',')}]`);
  // Trim attacker deck when ケーキ triggers.
  const attackerStateForTrim = attackerSide === 'player' ? state.player : state.ai;
  const trimmedAttackerDeck = attackerDeckTrim > 0
    ? attackerStateForTrim.deck.slice(attackerDeckTrim)
    : attackerStateForTrim.deck;

  const result: SubBattleResult = {
    idx: state.history.length + 1,
    defenderSide,
    defenderCard,
    attackerSide,
    attackCards,
    attackPower: state.attackCurrentPower,
    winner: attackerSide,
  };

  // 不老不死の薬: 始皇帝をデッキ底に戻す
  const defenderDeckForSide = (s: Side): BattleCard[] => {
    const baseDeck = s === attackerSide ? trimmedAttackerDeck : (s === 'player' ? state.player.deck : state.ai.deck);
    if (defenderToDeckBottom && s === defenderSide) {
      return [...baseDeck, defenderCard];
    }
    return baseDeck;
  };

  return {
    ...state,
    phase: 'battle_resolve',
    message: `${attackerSide === 'player' ? 'あなた' : '相手'}がフラッグ奪取！`,
    // Attacker's bench is untouched; only the defender's bench grows.
    player: {
      ...state.player,
      bench: defenderSide === 'player' ? newDefenderBench : state.player.bench,
      deck: defenderDeckForSide('player'),
    },
    ai: {
      ...state.ai,
      bench: defenderSide === 'ai' ? newDefenderBench : state.ai.bench,
      deck: defenderDeckForSide('ai'),
    },
    quarantine: newQuarantine,
    // Role swap: new flag holder is the old attacker. New defense card is the last attack card.
    flagHolder: attackerSide,
    defenseCard: lastAttackCard,
    attackRevealed: [],
    attackCurrentPower: 0,
    // Reset per-sub-battle buffs
    defenderBonus: 0,
    roundAttackBonus: { player: 0, ai: 0 },
    pendingAttackBonus: { player: 0, ai: 0 },
    subBattleCount: state.subBattleCount + 1,
    lastSubBattle: result,
    history: [...state.history, result],
  };
}

/**
 * Advance to the next round after a round_end. Awards fans for the round,
 * resets bench/quarantine, and transitions to the next deck_phase or game_over.
 */
export function advanceToNextRound(state: GameState): GameState {
  if (state.phase !== 'round_end' || !state.roundWinner) return state;

  // Award fans for this round
  const trophy = state.trophyFans[state.round - 1] ?? 0;
  const newPlayerFans = state.roundWinner === 'player' ? state.playerFans + trophy : state.playerFans;
  const newAiFans = state.roundWinner === 'ai' ? state.aiFans + trophy : state.aiFans;

  const nextRound = state.round + 1;

  // After round 5 → game_over with fan totals
  if (nextRound > TOTAL_ROUNDS) {
    const fanWinner: Side = newPlayerFans >= newAiFans ? 'player' : 'ai';
    return {
      ...state,
      phase: 'game_over',
      round: state.round,
      winner: fanWinner,
      playerFans: newPlayerFans,
      aiFans: newAiFans,
      message: `最終結果: あなた ${newPlayerFans} ファン vs 相手 ${newAiFans} ファン`,
    };
  }

  // Advance to next round: collect ALL cards back to deck, reset bench/quarantine.
  // ベンチ + 隔離 + 防御カード + 攻撃中カード → 全てデッキに回収してシャッフル
  const collectCards = (ps: PlayerState, side: Side): BattleCard[] => {
    const cards: BattleCard[] = [...ps.deck];
    for (const slot of ps.bench) {
      for (let i = 0; i < slot.count; i++) cards.push(slot.card);
    }
    cards.push(...state.quarantine[side]);
    if (state.defenseCard && state.flagHolder === side) cards.push(state.defenseCard);
    if (otherSide(state.flagHolder) === side) cards.push(...state.attackRevealed);
    return cards;
  };

  const playerDeck = shuffleDeck(collectCards(state.player, 'player'));
  const aiDeck = shuffleDeck(collectCards(state.ai, 'ai'));

  console.log(`[Engine] advanceToNextRound: player deck ${state.player.deck.length} → ${playerDeck.length}, ai deck ${state.ai.deck.length} → ${aiDeck.length}`);

  return {
    ...state,
    phase: 'deck_phase',
    round: nextRound,
    subBattleCount: 0,
    playerFans: newPlayerFans,
    aiFans: newAiFans,
    roundWinner: null,
    player: { ...state.player, deck: playerDeck, bench: [] },
    ai: { ...state.ai, deck: aiDeck, bench: [] },
    quarantine: { player: [], ai: [] },
    sealedBenchNames: { player: [], ai: [] },
    flagHolder: state.roundWinner,
    defenseCard: null,
    attackRevealed: [],
    attackCurrentPower: 0,
    lastSubBattle: null,
    defenderBonus: 0,
    roundAttackBonus: { player: 0, ai: 0 },
    pendingAttackBonus: { player: 0, ai: 0 },
    effectTelop: null,
    benchGlow: null,
    benchBoostDetails: null,
    lastRevealPowerAdded: 0,
    usedGiantSnake: { player: false, ai: false },
    message: `第${nextRound}回戦 デッキフェイズ：カードを選ぼう`,
  };
}

/**
 * battle_resolve → battle_intro for the next sub-battle.
 * The new flag holder keeps the defense card (= last attack card from previous sub-battle).
 * So we skip the "draw defender" step and go straight into the attacker intro.
 */
export function continueAfterResolve(state: GameState): GameState {
  if (state.phase !== 'battle_resolve') return state;
  // Sanity check: defender must already be set (from resolveSubBattleWin)
  if (!state.defenseCard) {
    // Shouldn't happen; draw from flag holder's deck as fallback
    return startBattle({ ...state, phase: 'deck_phase' });
  }
  return {
    ...state,
    phase: 'battle_intro',
    message: state.flagHolder === 'player' ? 'あなたが防御中！' : 'あなたの攻撃！',
  };
}
