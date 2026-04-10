/**
 * Knowledge Challenger - Game Engine
 * フラッグ奪い合い方式のカードバトルロジック
 */
import type { BattleCard, CardCategory } from './knowledgeCards';

export interface BenchSlot {
  category: CardCategory;
  cards: BattleCard[];
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
  // AI attack visualization
  aiAttackCards: BattleCard[];
  aiAttackTotal: number;
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
  };
}

function canAddToBench(bench: BenchSlot[]): boolean {
  // ベンチに5種類以上あると満杯
  return bench.length < 5;
}

function addToBench(bench: BenchSlot[], card: BattleCard): BenchSlot[] {
  const newBench = bench.map(s => ({ ...s, cards: [...s.cards] }));
  const existingSlot = newBench.find(s => s.category === card.category);
  if (existingSlot) {
    existingSlot.cards.push(card);
  } else {
    newBench.push({ category: card.category, cards: [card] });
  }
  return newBench;
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
        const sameCount = bench.filter(s => s.category === 'great_person').reduce((sum, s) => sum + s.cards.length, 0);
        power += sameCount * 1;
      } else if (rarity === 'SR') {
        const sameCount = bench.filter(s => s.category === 'great_person').reduce((sum, s) => sum + s.cards.length, 0);
        power += sameCount * 2;
      } else if (rarity === 'SSR') {
        const totalBench = bench.reduce((sum, s) => sum + s.cards.length, 0);
        power += totalBench * 1;
      }
    } else if (category === 'creature') {
      if (rarity === 'SR') {
        const emptySlots = 5 - bench.length;
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

  return {
    ...state,
    phase: 'quiz',
    player: { ...state.player, deck: newDeck },
    playerCard: drawnCard,
    quizAnswered: false,
    quizCorrect: null,
    effectApplied: false,
    message: `${drawnCard.name}をめくった！クイズに答えよう！`,
    log: [...state.log, `プレイヤーが${drawnCard.name}（パワー${drawnCard.power}）をめくった`],
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

    if (newPlayerPowerTotal > aiPower) {
      // プレイヤー勝利 - AIのカードをベンチに送る
      let newAIBench = [...state.ai.bench.map(s => ({ ...s, cards: [...s.cards] }))];
      
      if (!canAddToBench(newAIBench)) {
        return {
          ...state, phase: 'game_over', winner: 'player',
          message: 'AIのベンチが満杯！あなたの勝ちです！',
          log: [...newLog, 'AIのベンチが5種類になった！'],
        };
      }
      newAIBench = addToBench(newAIBench, aiCard);

      // プレイヤーの使用済みカードをベンチに送る
      let newPlayerBench = [...state.player.bench.map(s => ({ ...s, cards: [...s.cards] }))];
      for (const c of state.player.attackStack) {
        if (!canAddToBench(newPlayerBench)) {
          return {
            ...state, phase: 'game_over', winner: 'ai',
            message: 'あなたのベンチが満杯！負けです...',
            log: [...newLog, 'プレイヤーのベンチが5種類になった！'],
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
  let newAIBench = [...state.ai.bench.map(s => ({ ...s, cards: [...s.cards] }))];
  let newPlayerBench = [...state.player.bench.map(s => ({ ...s, cards: [...s.cards] }))];

  // AIが攻撃 - プレイヤーのカードを倒すまでカードを重ねる
  while (aiAttackTotal <= playerCardPower && aiDeck.length > 0) {
    const drawnCard = aiDeck.shift()!;
    aiAttackCards.push(drawnCard);

    const aiCorrect = Math.random() < 0.4;
    const effectivePower = calculatePower(drawnCard, aiCorrect, newAIBench, false);
    aiAttackTotal += effectivePower;

    newLog.push(`AIが${drawnCard.name}（パワー${effectivePower}${aiCorrect ? '、クイズ正解！' : ''}）をめくった`);

    if (aiAttackTotal > playerCardPower) {
      // AI勝利 - プレイヤーのカードをベンチに送る
      if (state.playerCard) {
        if (!canAddToBench(newPlayerBench)) {
          return {
            ...state, phase: 'game_over', winner: 'ai',
            ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
            player: { ...state.player, bench: newPlayerBench },
            message: 'あなたのベンチが満杯！負けです...',
            log: [...newLog, 'プレイヤーのベンチが5種類になった！'],
            aiAttackCards,
            aiAttackTotal,
          };
        }
        newPlayerBench = addToBench(newPlayerBench, state.playerCard);
      }

      // AIの使用済みカードをベンチに送る
      for (const c of aiAttackCards.slice(0, -1)) {
        if (!canAddToBench(newAIBench)) {
          return {
            ...state, phase: 'game_over', winner: 'player',
            ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
            player: { ...state.player, bench: newPlayerBench },
            message: 'AIのベンチが満杯！あなたの勝ちです！',
            log: [...newLog, 'AIのベンチが5種類になった！'],
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
      };
    }
  }

  if (aiDeck.length === 0 && aiAttackTotal <= playerCardPower) {
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
