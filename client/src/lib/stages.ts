/**
 * Solo Stage Mode - ステージ定義 + AI デッキビルダー (変更9)
 *
 * ステージ1〜10。各ステージでNPC難易度が上昇し、特定ステージは
 * 特殊なテーマデッキを持つ:
 *   ステージ3: 世界遺産多め (防御型)
 *   ステージ7: SSRカード持ち
 *   ステージ10: 原子爆弾コンボ (MANHATTAN+TRINITY+NUKE)
 *
 * クリア報酬: ALT + 時々レアカード
 * ステージ5クリア時に「中級者」、ステージ10クリア時に「マスター」称号付与
 */
import { ALL_BATTLE_CARDS, INITIAL_DECK_SIZE, MAX_SSR, MAX_SR, MAX_SAME_NAME, COMBO_CARD_IDS } from './knowledgeCards';
import type { BattleCard, CardRarity } from './knowledgeCards';

export type StageTheme = 'balanced' | 'heritage_heavy' | 'ssr_powered' | 'nuke_combo';

export interface StageTitle {
  id: string;
  name: string;
}

export interface StageConfig {
  id: number;             // 1..10
  name: string;
  description: string;
  theme: StageTheme;
  aiRating: number;       // 仮想Eloレーティング (変更10で使用)
  altReward: number;      // クリア時の ALT 報酬
  cardRewardId?: string;  // クリア時に追加獲得できる COLLECTION_CARDS id
  title?: StageTitle;     // クリア時に付与される称号
}

export const STAGES: StageConfig[] = [
  { id: 1,  name: 'ステージ 1',  description: '見習い冒険者の挑戦',      theme: 'balanced',       aiRating: 950,  altReward: 30 },
  { id: 2,  name: 'ステージ 2',  description: '森の賢者との対決',        theme: 'balanced',       aiRating: 1050, altReward: 40 },
  { id: 3,  name: 'ステージ 3',  description: '世界遺産の守護者',        theme: 'heritage_heavy', aiRating: 1150, altReward: 50,  cardRewardId: 'card-011' },
  { id: 4,  name: 'ステージ 4',  description: '古代の戦士',              theme: 'balanced',       aiRating: 1250, altReward: 60 },
  { id: 5,  name: 'ステージ 5',  description: '熟練者への第一歩',        theme: 'balanced',       aiRating: 1350, altReward: 80,  cardRewardId: 'card-016',
    title: { id: 'title-intermediate', name: '中級者' } },
  { id: 6,  name: 'ステージ 6',  description: '歴史の英雄',              theme: 'balanced',       aiRating: 1450, altReward: 100 },
  { id: 7,  name: 'ステージ 7',  description: '伝説の使い手',            theme: 'ssr_powered',    aiRating: 1600, altReward: 130, cardRewardId: 'card-001' },
  { id: 8,  name: 'ステージ 8',  description: '創造の天才',              theme: 'balanced',       aiRating: 1750, altReward: 170 },
  { id: 9,  name: 'ステージ 9',  description: '次元を超えた戦い',        theme: 'ssr_powered',    aiRating: 1900, altReward: 220 },
  { id: 10, name: 'ステージ 10', description: '原子の破壊者',            theme: 'nuke_combo',     aiRating: 2100, altReward: 300, cardRewardId: 'card-103',
    title: { id: 'title-master', name: 'マスター' } },
];

export function getStage(id: number): StageConfig | null {
  return STAGES.find((s) => s.id === id) ?? null;
}

// ===== AI Deck Builder =====

/** rarity で分割したプール。SSR/SR/R/N 各レア度の BattleCard 配列。 */
function poolByRarity(): Record<CardRarity, BattleCard[]> {
  return {
    N:   ALL_BATTLE_CARDS.filter((c) => c.rarity === 'N'),
    R:   ALL_BATTLE_CARDS.filter((c) => c.rarity === 'R'),
    SR:  ALL_BATTLE_CARDS.filter((c) => c.rarity === 'SR'),
    SSR: ALL_BATTLE_CARDS.filter((c) => c.rarity === 'SSR'),
  };
}

/** 配列を Fisher-Yates でシャッフル（純粋関数） */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface DeckRule {
  ssrMax: number;
  srMax: number;
}

/**
 * 共通のデッキビルド処理。seedCards を先に詰め、残りをレア度制約を守りつつ埋める。
 * rarityBias により各レア度の選好度を変えられる（heritage_heavy で heritage カテゴリを
 * 優先するため、レア度抽選後のカード選択は caller がフィルタできる）。
 */
function buildDeck(
  prefix: string,
  seedCards: BattleCard[],
  rule: DeckRule,
  rarityOrder: CardRarity[],
  filter?: (c: BattleCard) => boolean,
): BattleCard[] {
  const deck: BattleCard[] = [];
  const stamp = Date.now();
  const tryAdd = (card: BattleCard): boolean => {
    if (deck.length >= INITIAL_DECK_SIZE) return false;
    const sameName = deck.filter((c) => c.name === card.name).length;
    if (sameName >= MAX_SAME_NAME) return false;
    if (card.rarity === 'SSR' && deck.filter((c) => c.rarity === 'SSR').length >= rule.ssrMax) return false;
    if (card.rarity === 'SR' && deck.filter((c) => c.rarity === 'SR').length >= rule.srMax) return false;
    deck.push({ ...card, id: `${prefix}-${card.id}-${deck.length}-${stamp}` });
    return true;
  };

  for (const s of seedCards) tryAdd(s);

  const pools = poolByRarity();
  for (const rarity of rarityOrder) {
    const pool = shuffled(filter ? pools[rarity].filter(filter) : pools[rarity]);
    for (const c of pool) {
      if (deck.length >= INITIAL_DECK_SIZE) break;
      tryAdd(c);
    }
  }
  // フォールバック: 何かしら足りなければ全プールから埋める
  if (deck.length < INITIAL_DECK_SIZE) {
    const all = shuffled(ALL_BATTLE_CARDS);
    for (const c of all) {
      if (deck.length >= INITIAL_DECK_SIZE) break;
      tryAdd(c);
    }
  }
  return deck;
}

/** ステージ構成に応じた AI デッキを生成。INITIAL_DECK_SIZE (10) 枚。 */
export function createStageAIDeck(stageId: number): BattleCard[] {
  const stage = getStage(stageId);
  if (!stage) return buildDeck('ai', [], { ssrMax: MAX_SSR, srMax: MAX_SR }, ['SSR', 'SR', 'R', 'N']);

  // stage レーティングに応じて全体的にレア度上限を変える
  const rule: DeckRule = { ssrMax: MAX_SSR, srMax: MAX_SR };

  switch (stage.theme) {
    case 'heritage_heavy': {
      // 世界遺産多めの防御特化デッキ
      const heritagePool = ALL_BATTLE_CARDS.filter((c) => c.category === 'heritage');
      const seeds = shuffled(heritagePool).slice(0, 5);
      return buildDeck('ai-stage' + stageId, seeds, rule, ['SR', 'R', 'N'], (c) => c.category !== 'heritage' || true);
    }
    case 'ssr_powered': {
      // 最低 1 SSR + 複数 SR
      const ssrPool = ALL_BATTLE_CARDS.filter((c) => c.rarity === 'SSR');
      const srPool  = ALL_BATTLE_CARDS.filter((c) => c.rarity === 'SR');
      const seeds = [
        ...shuffled(ssrPool).slice(0, 1),
        ...shuffled(srPool).slice(0, 2),
      ];
      return buildDeck('ai-stage' + stageId, seeds, rule, ['SR', 'R', 'N']);
    }
    case 'nuke_combo': {
      // MANHATTAN + TRINITY + NUKE + SSR + SR 追加
      const comboIds: string[] = [COMBO_CARD_IDS.MANHATTAN, COMBO_CARD_IDS.TRINITY, COMBO_CARD_IDS.NUKE];
      const comboCards = ALL_BATTLE_CARDS.filter((c) => comboIds.includes(c.id));
      const ssrPool = ALL_BATTLE_CARDS.filter((c) => c.rarity === 'SSR' && !comboIds.includes(c.id));
      // NUKE が SSR の場合は SSR 上限を一時的に解除するため rule を手動調整
      const nukeRule: DeckRule = { ssrMax: 3, srMax: MAX_SR + 1 };
      const seeds = [
        ...comboCards,
        ...shuffled(ssrPool).slice(0, 1),
      ];
      return buildDeck('ai-stage' + stageId, seeds, nukeRule, ['SR', 'R']);
    }
    case 'balanced':
    default: {
      // 難易度に応じてレア度のブーストを変える
      const srBoost = Math.min(3, Math.floor(stage.id / 3));  // 後半ステージで SR を多めに
      const srPool  = ALL_BATTLE_CARDS.filter((c) => c.rarity === 'SR');
      const seeds = shuffled(srPool).slice(0, srBoost);
      return buildDeck('ai-stage' + stageId, seeds, rule, ['R', 'SR', 'N']);
    }
  }
}
