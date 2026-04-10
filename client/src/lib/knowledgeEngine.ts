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
  defenseCard: BattleCard | null;
  currentCard: BattleCard | null;
  attackPowerTotal: number;
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
  const aiDefenseCard = shuffledAI.shift()!;

  return {
    phase: 'player_draw',
    player: { deck: shuffledPlayer, bench: [], attackStack: [], isAI: false },
    ai: { deck: shuffledAI, bench: [], attackStack: [], isAI: true },
    flagHolder: 'ai',
    defenseCard: aiDefenseCard,
    currentCard: null,
    attackPowerTotal: 0,
    round: 1,
    message: 'あなたの攻撃ターン！山札からカードをめくろう！',
    winner: null,
    quizAnswered: false,
    quizCorrect: null,
    effectApplied: false,
    log: [`ラウンド1開始！AIの防衛カード: ${aiDefenseCard.name}（パワー${aiDefenseCard.power}）`],
    aiAttackCards: [],
    aiAttackTotal: 0,
  };
}

function canAddToBench(bench: BenchSlot[], card: BattleCard): boolean {
  const existingSlot = bench.find(s => s.category === card.category);
  if (existingSlot) return true;
  return bench.length < 6;
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
        const emptySlots = 6 - bench.length;
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
    currentCard: drawnCard,
    quizAnswered: false,
    quizCorrect: null,
    effectApplied: false,
    message: `${drawnCard.name}をめくった！クイズに答えよう！`,
    log: [...state.log, `プレイヤーが${drawnCard.name}（パワー${drawnCard.power}）をめくった`],
  };
}

export function processQuizAnswer(state: GameState, correct: boolean): GameState {
  if (!state.currentCard) return state;

  const card = state.currentCard;
  const isAttacking = state.flagHolder !== 'player';
  const effectivePower = calculatePower(card, correct, state.player.bench, !isAttacking);

  const newAttackStack = [...state.player.attackStack, card];
  const newAttackTotal = state.attackPowerTotal + effectivePower;

  const logEntry = correct
    ? `クイズ正解！${card.name}のパワー: ${effectivePower}（ボーナス+${card.correctBonus}）`
    : `不正解...${card.name}のパワー: ${effectivePower}`;

  const newLog = [...state.log, logEntry];

  if (isAttacking) {
    const defPower = state.defenseCard ? state.defenseCard.power : 0;

    if (newAttackTotal > defPower) {
      const cardsToAIBench = state.defenseCard ? [state.defenseCard] : [];
      let newAIBench = [...state.ai.bench.map(s => ({ ...s, cards: [...s.cards] }))];

      for (const c of cardsToAIBench) {
        if (!canAddToBench(newAIBench, c)) {
          return {
            ...state, phase: 'game_over', winner: 'player',
            message: 'AIのベンチが満杯！あなたの勝ちです！',
            log: [...newLog, 'AIのベンチがいっぱいになった！'],
          };
        }
        newAIBench = addToBench(newAIBench, c);
      }

      const attackCardsForBench = newAttackStack.slice(0, -1);
      let newPlayerBench = [...state.player.bench.map(s => ({ ...s, cards: [...s.cards] }))];

      for (const c of attackCardsForBench) {
        if (!canAddToBench(newPlayerBench, c)) {
          return {
            ...state, phase: 'game_over', winner: 'ai',
            message: 'あなたのベンチが満杯！負けです...',
            log: [...newLog, 'プレイヤーのベンチがいっぱいになった！'],
          };
        }
        newPlayerBench = addToBench(newPlayerBench, c);
      }

      const winningCard = newAttackStack[newAttackStack.length - 1];

      return {
        ...state,
        phase: 'ai_turn',
        player: { ...state.player, bench: newPlayerBench, attackStack: [] },
        ai: { ...state.ai, bench: newAIBench, attackStack: [] },
        flagHolder: 'player',
        defenseCard: winningCard,
        currentCard: null,
        attackPowerTotal: 0,
        quizAnswered: true,
        quizCorrect: correct,
        message: `フラッグ奪取！${winningCard.name}が防衛カードに！AIのターン！`,
        log: [...newLog, `プレイヤーがフラッグを奪った！防衛カード: ${winningCard.name}`],
        aiAttackCards: [],
        aiAttackTotal: 0,
      };
    } else {
      return {
        ...state,
        phase: 'player_draw',
        player: { ...state.player, attackStack: newAttackStack },
        currentCard: null,
        attackPowerTotal: newAttackTotal,
        quizAnswered: true,
        quizCorrect: correct,
        message: `パワー合計: ${newAttackTotal} / 防衛: ${defPower} — もっとカードが必要！`,
        log: [...newLog, `攻撃パワー合計: ${newAttackTotal} vs 防衛: ${defPower}`],
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

  const defPower = state.defenseCard ? state.defenseCard.power : 0;
  let aiDeck = [...state.ai.deck];
  let aiAttackStack: BattleCard[] = [];
  let aiAttackTotal = 0;
  let newLog = [...state.log];
  let newAIBench = [...state.ai.bench.map(s => ({ ...s, cards: [...s.cards] }))];
  let newPlayerBench = [...state.player.bench.map(s => ({ ...s, cards: [...s.cards] }))];

  while (aiAttackTotal <= defPower && aiDeck.length > 0) {
    const drawnCard = aiDeck.shift()!;
    aiAttackStack.push(drawnCard);

    const aiCorrect = Math.random() < 0.4;
    const effectivePower = calculatePower(drawnCard, aiCorrect, newAIBench, false);
    aiAttackTotal += effectivePower;

    newLog.push(`AIが${drawnCard.name}（パワー${effectivePower}${aiCorrect ? '、クイズ正解！' : ''}）をめくった`);

    if (aiAttackTotal > defPower) {
      if (state.defenseCard) {
        if (!canAddToBench(newPlayerBench, state.defenseCard)) {
          return {
            ...state, phase: 'game_over', winner: 'ai',
            ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
            player: { ...state.player, bench: newPlayerBench },
            message: 'あなたのベンチが満杯！負けです...',
            log: [...newLog, 'プレイヤーのベンチがいっぱいになった！'],
            aiAttackCards: aiAttackStack,
            aiAttackTotal,
          };
        }
        newPlayerBench = addToBench(newPlayerBench, state.defenseCard);
      }

      const attackCardsForBench = aiAttackStack.slice(0, -1);
      for (const c of attackCardsForBench) {
        if (!canAddToBench(newAIBench, c)) {
          return {
            ...state, phase: 'game_over', winner: 'player',
            ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
            player: { ...state.player, bench: newPlayerBench },
            message: 'AIのベンチが満杯！あなたの勝ちです！',
            log: [...newLog, 'AIのベンチがいっぱいになった！'],
            aiAttackCards: aiAttackStack,
            aiAttackTotal,
          };
        }
        newAIBench = addToBench(newAIBench, c);
      }

      const winningCard = aiAttackStack[aiAttackStack.length - 1];
      newLog.push(`AIがフラッグを奪った！防衛カード: ${winningCard.name}`);

      return {
        ...state,
        phase: 'player_draw',
        ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
        player: { ...state.player, bench: newPlayerBench, attackStack: [] },
        flagHolder: 'ai',
        defenseCard: winningCard,
        currentCard: null,
        attackPowerTotal: 0,
        round: state.round + 1,
        message: `AIがフラッグを奪った！${winningCard.name}が防衛カードに。あなたの攻撃ターン！`,
        log: newLog,
        aiAttackCards: aiAttackStack,
        aiAttackTotal,
      };
    }
  }

  if (aiDeck.length === 0 && aiAttackTotal <= defPower) {
    return {
      ...state, phase: 'game_over', winner: 'player',
      ai: { ...state.ai, deck: aiDeck, bench: newAIBench, attackStack: [] },
      message: 'AIのデッキ切れ！あなたの勝ちです！',
      log: [...newLog, 'AIのデッキが尽きた！'],
      aiAttackCards: aiAttackStack,
      aiAttackTotal,
    };
  }

  return state;
}
