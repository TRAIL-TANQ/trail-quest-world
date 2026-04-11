/**
 * Knowledge Challenger - Game Engine
 * フラッグ奪い合い方式のカードバトルロジック
 */
import type { BattleCard, CardCategory } from './knowledgeCards';
import { COMBO_CARD_IDS } from './knowledgeCards';

// Bench slot is keyed by CARD NAME (not category). Same-named cards stack.
// Different names occupy different slots. Max 5 distinct names.
export const BENCH_MAX_SLOTS = 5;

export interface BenchSlot {
  name: string;
  card: BattleCard;  // representative card for display
  count: number;     // number of cards of this name on the bench
}

export interface PlayerState {
  deck: BattleCard[];
  bench: BenchSlot[];
  attackStack: BattleCard[];
  isAI: boolean;
}

export type GamePhase = 'waiting' | 'player_draw' | 'quiz' | 'effect' | 'ai_turn' | 'round_end' | 'game_over';
export type FlagHolder = 'player' | 'ai';

export interface GameState {
  phase: GamePhase;
  player: PlayerState;
  ai: PlayerState;
  flagHolder: FlagHolder;
  playerCard: BattleCard | null;  // プレイヤーの防衛カード
  aiCard: BattleCard | null;      // AIの防衛カード
  playerPowerTotal: number;
  aiPowerTotal: number;
  round: number;
  message: string;
  winner: 'player' | 'ai' | null;
  quizAnswered: boolean;
  quizCorrect: boolean | null;
  effectApplied: boolean;
  log: string[];
  // Attack visualization
  aiAttackCards: BattleCard[];
  aiAttackTotal: number;
  playerAttackCards: BattleCard[];  // プレイヤー攻撃スタック可視化
  lastAddedPower: number;           // 最後に加算されたパワー（演出用）
  winningCard: BattleCard | null;   // 勝ち残りカード（演出用）
  winningCardSide: 'player' | 'ai' | null; // どちら側の勝利か
  // Nuke combo state
  nukeAnimation: 'triggered' | 'failed' | null;
  isolationZone: BattleCard[];       // 隔離されたAIカード
  ssrRevealSide: 'player' | 'ai' | null; // SSR公開演出トリガー
}

function shuffleDeck(deck: BattleCard[]): BattleCard[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function initGameState(playerDeck: BattleCard[], aiDeck: BattleCard[]): GameState {
  const shuffledPlayer = shuffleDeck(playerDeck);
  const shuffledAI = shuffleDeck(aiDeck);
  const aiInitialCard = shuffledAI.shift()!;

  return {
    phase: 'player_draw',
    player: { deck: shuffledPlayer, bench: [], attackStack: [], isAI: false },
    ai: { deck: shuffledAI, bench: [], attackStack: [], isAI: true },
    flagHolder: 'ai',
    playerCard: null,
    aiCard: aiInitialCard,
    playerPowerTotal: 0,
    aiPowerTotal: 0,
    round: 1,
    message: 'あなたの攻撃ターン！山札からカードをめくろう！',
    winner: null,
    quizAnswered: false,
    quizCorrect: null,
    effectApplied: false,
    log: [`ラウンド1開始！AIの防衛カード: ${aiInitialCard.name}（パワー${aiInitialCard.power}）`],
    aiAttackCards: [],
    aiAttackTotal: 0,
    playerAttackCards: [],
    lastAddedPower: 0,
    winningCard: null,
    winningCardSide: null,
    nukeAnimation: null,
    isolationZone: [],
    ssrRevealSide: null,
  };
}

// Check if a bench contains cards matching given names
function benchHasCardNames(bench: BenchSlot[], names: string[]): boolean {
  const benchNames = new Set(bench.map(s => s.name));
  return names.every(n => benchNames.has(n));
}

function canAddToBench(bench: BenchSlot[], card: BattleCard): boolean {
  // 同名カードは既存スロットに重ねられるので常にOK
  if (bench.some(s => s.name === card.name)) return true;
  // 新しい名前は空きスロットが必要
  return bench.length < BENCH_MAX_SLOTS;
}

function addToBench(bench: BenchSlot[], card: BattleCard): BenchSlot[] {
  const existing = bench.find(s => s.name === card.name);
  if (existing) {
    return bench.map(s => s.name === card.name ? { ...s, count: s.count + 1 } : s);
  }
  return [...bench, { name: card.name, card, count: 1 }];
}

function cloneBench(bench: BenchSlot[]): BenchSlot[] {
  return bench.map(s => ({ ...s }));
}

// Calculate effective power with category-based effects
function calculatePower(card: BattleCard, quizCorrect: boolean, bench: BenchSlot[], isDefending: boolean): number {
  let power = card.power;

  if (quizCorrect) {
    power += card.correctBonus;

    // Category + rarity based effects
    const { category, rarity } = card;

    if (category === 'great_person') {
      if (rarity === 'R') {
        const sameCount = bench.filter(s => s.card.category === 'great_person').reduce((sum, s) => sum + s.count, 0);
        power += sameCount * 1;
      } else if (rarity === 'SR') {
        const sameCount = bench.filter(s => s.card.category === 'great_person').reduce((sum, s) => sum + s.count, 0);
        power += sameCount * 2;
      } else if (rarity === 'SSR') {
        const totalBench = bench.reduce((sum, s) => sum + s.count, 0);
        power += totalBench * 1;
      }
    } else if (category === 'creature') {
      if (rarity === 'SR') {
        const emptySlots = BENCH_MAX_SLOTS - bench.length;
        if (emptySlots <= 2) power += 4;
      }
    } else if (category === 'heritage') {
      if (rarity === 'R' && isDefending) power += 2;
      else if (rarity === 'SR' && isDefending) power += 3;
      else if (rarity === 'SSR' && isDefending) power += 5;
    } else if (category === 'invention') {
      if (rarity === 'R' && isDefending) power += 1;
    } else if (category === 'discovery') {
      if (rarity === 'R' && !isDefending) power += 2;
      else if (rarity === 'SR' && !isDefending) power += 3;
    }
  }

  return power;
}

export function playerDrawCard(state: GameState): GameState {
  if (state.player.deck.length === 0) {
    return {
      ...state,
      phase: 'game_over',
      winner: 'ai',
      message: 'デッキ切れ！あなたの負けです...',
      log: [...state.log, 'プレイヤーのデッキが尽きた！'],
    };
  }

  const newDeck = [...state.player.deck];
  const drawnCard = newDeck.shift()!;
  const isSSRReveal = drawnCard.rarity === 'SSR';

  // ===== Nuke Combo Check =====
  // 原子爆弾を公開したとき、ベンチに「マンハッタン計画」「トリニティ実験」があれば発動
  if (drawnCard.specialEffect === 'nuke_trigger' && drawnCard.comboRequires) {
    const comboReady = benchHasCardNames(state.player.bench, drawnCard.comboRequires);
    if (comboReady) {
      // 発動成功：相手の場を破壊 + 相手デッキ上から5枚を隔離
      const aiDeck = [...state.ai.deck];
      const isolated = aiDeck.splice(0, 5);
      const newIsolation = [...state.isolationZone, ...isolated];
      const destroyedDefender = state.aiCard;
      // AIの新防衛カードを引く（デッキがあれば）
      const newAIDefender = aiDeck.length > 0 ? aiDeck.shift()! : null;

      const nukeLog = [
        ...state.log,
        `☢️ 原子爆弾 発動！コンボ成立：マンハッタン計画 + トリニティ実験`,
        destroyedDefender ? `💥 ${destroyedDefender.name}を破壊！` : '💥 相手の場を破壊！',
        `🗑️ 相手デッキ上から${isolated.length}枚を隔離スペースに送った`,
      ];

      // AIベンチがオーバーしないかチェックしてから戻す
      // プレイヤーはフラッグをまだ奪っていない（defender破壊のみ）—次のAIターンへ
      return {
        ...state,
        phase: newAIDefender ? 'ai_turn' : 'game_over',
        player: { ...state.player, deck: newDeck },
        ai: { ...state.ai, deck: aiDeck },
        playerCard: drawnCard, // 原子爆弾がプレイヤーの防衛に
        aiCard: newAIDefender,
        flagHolder: newAIDefender ? 'player' : 'player', // プレイヤーがフラッグを奪取
        playerPowerTotal: 0,
        aiPowerTotal: 0,
        isolationZone: newIsolation,
        nukeAnimation: 'triggered',
        ssrRevealSide: 'player',
        message: newAIDefender
          ? `☢️ 原子爆弾発動！相手の場を破壊し、デッキ上から5枚を隔離！`
          : `☢️ 原子爆弾で相手を壊滅！勝利！`,
        log: nukeLog,
        winningCard: drawnCard,
        winningCardSide: 'player',
        winner: newAIDefender ? null : 'player',
        quizAnswered: true,
        quizCorrect: true,
        lastAddedPower: drawnCard.power,
        playerAttackCards: [...state.playerAttackCards, drawnCard],
      };
    } else {
      // 不発
      return {
        ...state,
        phase: 'quiz',
        player: { ...state.player, deck: newDeck },
        playerCard: drawnCard,
        quizAnswered: false,
        quizCorrect: null,
        effectApplied: false,
        nukeAnimation: 'failed',
        ssrRevealSide: isSSRReveal ? 'player' : null,
        message: `不発...条件カードが揃っていない。基本パワー${drawnCard.power}として扱う。`,
        log: [...state.log, `☢️ 原子爆弾を公開したが不発...（条件カード不足）`],
        winningCard: null,
        winningCardSide: null,
      };
    }
  }

  return {
    ...state,
    phase: 'quiz',
    player: { ...state.player, deck: newDeck },
    playerCard: drawnCard,
    quizAnswered: false,
    quizCorrect: null,
    effectApplied: false,
    nukeAnimation: null,
    ssrRevealSide: isSSRReveal ? 'player' : null,
    message: `${drawnCard.name}をめくった！クイズに答えよう！`,
    log: [...state.log, `プレイヤーが${drawnCard.name}（パワー${drawnCard.power}）をめくった`],
    winningCard: null,
    winningCardSide: null,
  };
}

export function processQuizAnswer(state: GameState, correct: boolean): GameState {
  if (!state.playerCard || !state.aiCard) return state;

  const playerCard = state.playerCard;
  const aiCard = state.aiCard;
  const isPlayerAttacking = state.flagHolder === 'ai';

  // プレイヤーのカード効果を計算
  const playerEffectivePower = calculatePower(playerCard, correct, state.player.bench, !isPlayerAttacking);
  const newPlayerPowerTotal = state.playerPowerTotal + playerEffectivePower;

  const logEntry = correct
    ? `クイズ正解！${playerCard.name}のパワー: ${playerEffectivePower}（ボーナス+${playerCard.correctBonus}）`
    : `不正解...${playerCard.name}のパワー: ${playerEffectivePower}`;

  const newLog = [...state.log, logEntry];

  if (isPlayerAttacking) {
    // プレイヤーが攻撃中
    const aiPower = aiCard.power;

    // 攻撃側 >= 防御側 で攻撃側の勝ち（同値は攻撃側勝利）
    if (newPlayerPowerTotal >= aiPower) {
      // プレイヤー勝利 - AIのカードをベンチに送る
      let newAIBench = cloneBench(state.ai.bench);

      if (!canAddToBench(newAIBench, aiCard)) {
        return {
          ...state, phase: 'game_over', winner: 'player',
          message: 'AIのベンチが満杯！あなたの勝ちです！',
          log: [...newLog, `AIのベンチが${BENCH_MAX_SLOTS}種類で埋まった！`],
        };
      }
      newAIBench = addToBench(newAIBench, aiCard);

      // プレイヤーの使用済みカードをベンチに送る
      let newPlayerBench = cloneBench(state.player.bench);
      for (const c of state.player.attackStack) {
        if (!canAddToBench(newPlayerBench, c)) {
          return {
            ...state, phase: 'game_over', winner: 'ai',
            message: 'あなたのベンチが満杯！負けです...',
            log: [...newLog, `プレイヤーのベンチが${BENCH_MAX_SLOTS}種類で埋まった！`],
          };
        }
        newPlayerBench = addToBench(newPlayerBench, c);
      }

      // プレイヤーのカードが新しい防衛カードに
      return {
        ...state,
        phase: 'ai_turn',
        player: { ...state.player, bench: newPlayerBench, attackStack: [] },
        ai: { ...state.ai, bench: newAIBench, attackStack: [] },
        flagHolder: 'player',
        playerCard: playerCard,
        aiCard: null,
        playerPowerTotal: 0,
        aiPowerTotal: 0,
        quizAnswered: true,
        quizCorrect: correct,
        message: `フラッグ奪取！${playerCard.name}が防衛カードに！AIのターン！`,
        log: [...newLog, `プレイヤーがフラッグを奪った！防衛カード: ${playerCard.name}`],
        aiAttackCards: [],
        aiAttackTotal: 0,
        playerAttackCards: [...state.playerAttackCards, playerCard],
        lastAddedPower: playerEffectivePower,
        winningCard: playerCard,
        winningCardSide: 'player',
      };
    } else {
      // プレイヤーはまだ負けていない - 次のカードを重ねる
      return {
        ...state,
        phase: 'player_draw',
        player: { ...state.player, attackStack: [...state.player.attackStack, playerCard] },
        playerCard: null,
        playerPowerTotal: newPlayerPowerTotal,
        quizAnswered: true,
        quizCorrect: correct,
        message: `パワー合計: ${newPlayerPowerTotal} / 防衛: ${aiPower} — もっとカードが必要！`,
        log: [...newLog, `攻撃パワー合計: ${newPlayerPowerTotal} vs 防衛: ${aiPower}`],
        playerAttackCards: [...state.playerAttackCards, playerCard],
        lastAddedPower: playerEffectivePower,
        winningCard: null,
        winningCardSide: null,
      };
    }
  }

  return state;
}

export function aiTurn(state: GameState): GameState {
  if (state.ai.deck.length === 0) {
    return {
      ...state, phase: 'game_over', winner: 'player',
      message: 'AIのデッキ切れ！あなたの勝ちです！',
      log: [...state.log, 'AIのデッキが尽きた！'],
    };
  }

  const playerCardPower = state.playerCard ? state.playerCard.power : 0;
  let aiDeck = [...state.ai.deck];
  let aiAttackCards: BattleCard[] = [];
  let aiAttackTotal = 0;
  let newLog = [...state.log];
  let newAIBench = cloneBench(state.ai.bench);
  let newPlayerBench = cloneBench(state.player.bench);

  // AIが攻撃 - プレイヤーのカードを倒すまでカードを重ねる（攻撃側 >= 防御側で勝利）
  while (aiAttackTotal < playerCardPower && aiDeck.length > 0) {
    const drawnCard = aiDeck.shift()!;
    aiAttackCards.push(drawnCard);

    const aiCorrect = Math.random() < 0.4;
    const effectivePower = calculatePower(drawnCard, aiCorrect, newAIBench, false);
    aiAttackTotal += effectivePower;

    newLog.push(`AIが${drawnCard.name}（パワー${effectivePower}${aiCorrect ? '、クイズ正解！' : ''}）をめくった`);

    if (aiAttackTotal >= playerCardPower) {
      // AI勝利 - プレイヤーのカードをベンチに送る
      if (state.playerCard) {
        if (!canAddToBench(newPlayerBench, state.playerCard)) {
          return {
            ...state, phase: 'game_over', winner: 'ai',
            ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
            player: { ...state.player, bench: newPlayerBench },
            message: 'あなたのベンチが満杯！負けです...',
            log: [...newLog, `プレイヤーのベンチが${BENCH_MAX_SLOTS}種類で埋まった！`],
            aiAttackCards,
            aiAttackTotal,
          };
        }
        newPlayerBench = addToBench(newPlayerBench, state.playerCard);
      }

      // AIの使用済みカードをベンチに送る
      for (const c of aiAttackCards.slice(0, -1)) {
        if (!canAddToBench(newAIBench, c)) {
          return {
            ...state, phase: 'game_over', winner: 'player',
            ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
            player: { ...state.player, bench: newPlayerBench },
            message: 'AIのベンチが満杯！あなたの勝ちです！',
            log: [...newLog, `AIのベンチが${BENCH_MAX_SLOTS}種類で埋まった！`],
            aiAttackCards,
            aiAttackTotal,
          };
        }
        newAIBench = addToBench(newAIBench, c);
      }

      // AIのカードが新しい防衛カードに
      const winningCard = aiAttackCards[aiAttackCards.length - 1];
      newLog.push(`AIがフラッグを奪った！防衛カード: ${winningCard.name}`);

      return {
        ...state,
        phase: 'player_draw',
        ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
        player: { ...state.player, bench: newPlayerBench, attackStack: [] },
        flagHolder: 'ai',
        playerCard: null,
        aiCard: winningCard,
        playerPowerTotal: 0,
        aiPowerTotal: 0,
        round: state.round + 1,
        message: `AIがフラッグを奪った！${winningCard.name}が防衛カードに。あなたの攻撃ターン！`,
        log: newLog,
        aiAttackCards,
        aiAttackTotal,
        playerAttackCards: [],
        lastAddedPower: 0,
        winningCard: winningCard,
        winningCardSide: 'ai',
      };
    }
  }

  if (aiDeck.length === 0 && aiAttackTotal < playerCardPower) {
    return {
      ...state, phase: 'game_over', winner: 'player',
      ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
      message: 'AIのデッキ切れ！あなたの勝ちです！',
      log: [...newLog, 'AIのデッキが尽きた！'],
      aiAttackCards,
      aiAttackTotal,
    };
  }

  return state;
}
