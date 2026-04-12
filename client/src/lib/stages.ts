/**
 * Solo Stage Mode - ステージ定義 + AI デッキビルダー + NPCデッキフェイズ + スターターデッキ
 *
 * 全10ステージ。各ステージ5回戦制。プレイヤーもNPCも初期デッキ10枚から成長。
 * 各回戦開始時にデッキフェイズでカードを追加取得（NPC自動、プレイヤーはクイズ）。
 */
import { ALL_BATTLE_CARDS, DRAFTABLE_BATTLE_CARDS, INITIAL_DECK_SIZE, SYNERGY_MAP } from './knowledgeCards';
import type { BattleCard, CardRarity } from './knowledgeCards';

// ===== Stage Rules =====
export interface StageRules {
  benchLimit?: number;            // player bench max (default 6)
  deckPhaseCards?: number;        // cards offered per deck phase (default 5)
  npcEffectMultiplier?: number;   // multiply NPC effect bonuses (default 1.0)
  npcAttackBonus?: number;        // flat attack bonus for NPC cards matching condition
  npcAttackBonusFilter?: string;  // category filter for npcAttackBonus (e.g. 'creature')
  npcDefenseBonus?: number;       // flat defense bonus for NPC cards matching condition
  npcDefenseBonusFilter?: string; // category filter for npcDefenseBonus
  skipDeckPhase?: boolean;        // player skips deck phase (default false)
  npcDeckSize?: number;           // NPC initial deck size (default 10)
  npcBenchSlots?: number;         // NPC bench max (default 6)
  npcDeckPhasePickCount?: number; // cards NPC picks per deck phase (default 2)
  npcSynergyRate?: number;        // 0..1 chance NPC picks synergy card (default 0)
  npcDoubleBenchEffect?: boolean; // NPC bench effects fire twice (default false)
}

export interface StageTitle {
  id: string;
  name: string;
}

export interface SpecialCardReward {
  id: string;
  name: string;
  imageUrl: string;
}

export interface StageConfig {
  id: number;
  name: string;
  description: string;
  aiRating: number;
  altReward: number;
  cardRewardId?: string;          // existing collection card reward
  specialCard?: SpecialCardReward; // stage-specific special card
  title?: StageTitle;
  rules: StageRules;
  npcThemeIcon: string;           // emoji for stage select UI
  npcDeckSeeds: string[];         // card names to seed NPC initial deck
  isBoss?: boolean;
}

// ===== 10 Stages =====
export const STAGES: StageConfig[] = [
  {
    id: 1, name: 'はじめての対戦', description: '初心者NPCとの練習バトル',
    aiRating: 950, altReward: 50,
    specialCard: { id: 'special-stage-1', name: '冒険の始まり', imageUrl: '/images/cards/special-stage1.png' },
    rules: { npcSynergyRate: 0 },
    npcThemeIcon: '🎮', npcDeckSeeds: [], // pure noise
  },
  {
    id: 2, name: 'アマゾンの脅威', description: 'NPCの生き物カード攻撃+1',
    aiRating: 1050, altReward: 80,
    specialCard: { id: 'special-stage-2', name: 'ジャングルの覇者', imageUrl: '/images/cards/special-stage2.png' },
    rules: { npcSynergyRate: 0, npcAttackBonus: 1, npcAttackBonusFilter: 'creature' },
    npcThemeIcon: '🐟', npcDeckSeeds: ['ピラニア', 'ピラニア', 'アマゾン川'],
  },
  {
    id: 3, name: '鉄壁の古代帝国', description: 'NPCの世界遺産カード防御+3',
    aiRating: 1150, altReward: 100,
    specialCard: { id: 'special-stage-3', name: '古代の守護者', imageUrl: '/images/cards/special-stage3.png' },
    rules: { npcSynergyRate: 0, npcDefenseBonus: 3, npcDefenseBonusFilter: 'heritage' },
    npcThemeIcon: '🏛️', npcDeckSeeds: ['兵馬俑', '万里の長城', 'ピラミッド'],
  },
  {
    id: 4, name: '発明家の挑戦', description: 'デッキフェイズの提示が4枚に制限',
    aiRating: 1250, altReward: 120,
    specialCard: { id: 'special-stage-4', name: '発明の鍵', imageUrl: '/images/cards/special-stage4.png' },
    rules: { npcSynergyRate: 0.5, deckPhaseCards: 4 },
    npcThemeIcon: '⚙️', npcDeckSeeds: ['電球', '蓄音機', '火薬'],
  },
  {
    id: 5, name: '医学の闇', description: 'プレイヤーのベンチ5スロット制限',
    aiRating: 1350, altReward: 200, isBoss: true,
    specialCard: { id: 'special-stage-5', name: '中級者の証', imageUrl: '/images/cards/special-stage5.png' },
    title: { id: 'title-intermediate', name: '中級者' },
    rules: { npcSynergyRate: 0.5, benchLimit: 5 },
    npcThemeIcon: '🔬', npcDeckSeeds: ['顕微鏡', '黄熱病', 'ペスト菌'],
  },
  {
    id: 6, name: '大航海時代', description: 'NPCがデッキフェイズで3枚獲得',
    aiRating: 1450, altReward: 150,
    specialCard: { id: 'special-stage-6', name: '大海原の勲章', imageUrl: '/images/cards/special-stage6.png' },
    rules: { npcSynergyRate: 0.5, npcDeckPhasePickCount: 3 },
    npcThemeIcon: '⛵', npcDeckSeeds: ['羅針盤', 'キャラベル船', '香辛料'],
  },
  {
    id: 7, name: '科学革命', description: 'NPCの全カード効果1.5倍',
    aiRating: 1600, altReward: 200,
    specialCard: { id: 'special-stage-7', name: '真理の探究者', imageUrl: '/images/cards/special-stage7.png' },
    rules: { npcSynergyRate: 0.8, npcEffectMultiplier: 1.5 },
    npcThemeIcon: '🌌', npcDeckSeeds: ['望遠鏡', '地動説', '天動説'],
  },
  {
    id: 8, name: '皇帝の進軍', description: 'プレイヤーのデッキフェイズなし',
    aiRating: 1750, altReward: 250,
    specialCard: { id: 'special-stage-8', name: '征服者の紋章', imageUrl: '/images/cards/special-stage8.png' },
    rules: { npcSynergyRate: 0.8, skipDeckPhase: true },
    npcThemeIcon: '⚔️', npcDeckSeeds: ['鉄砲', '大砲', '楽市楽座'],
  },
  {
    id: 9, name: '芸術と自由', description: 'NPCのベンチ効果が2回発動',
    aiRating: 1900, altReward: 300,
    specialCard: { id: 'special-stage-9', name: '芸術の魂', imageUrl: '/images/cards/special-stage9.png' },
    rules: { npcSynergyRate: 0.8, npcDoubleBenchEffect: true },
    npcThemeIcon: '🎨', npcDeckSeeds: ['ひまわり', '星月夜', '聖剣'],
  },
  {
    id: 10, name: '核の脅威', description: 'NPC初期デッキ15枚+ベンチ7スロット',
    aiRating: 2100, altReward: 500, isBoss: true,
    specialCard: { id: 'special-stage-10', name: 'マスターの証', imageUrl: '/images/cards/special-stage10.png' },
    title: { id: 'title-master', name: 'マスター' },
    rules: { npcSynergyRate: 1.0, npcDeckSize: 15, npcBenchSlots: 7 },
    npcThemeIcon: '☢️', npcDeckSeeds: ['マンハッタン計画', 'トリニティ実験', '相対性理論の論文'],
  },
];

export function getStage(id: number): StageConfig | null {
  return STAGES.find((s) => s.id === id) ?? null;
}

// ===== Special Card Data =====
export const SPECIAL_CARDS: SpecialCardReward[] = STAGES
  .filter((s) => s.specialCard)
  .map((s) => s.specialCard!);

// ===== Starter Decks (Player) =====
export interface StarterDeck {
  id: string;
  name: string;
  icon: string;
  trumpCard: string;   // card name (big display)
  themeCards: string[]; // card names (theme seeds)
  noiseCards: string[]; // card names (noise filler)
  description: string;
}

export const STARTER_DECKS: StarterDeck[] = [
  {
    id: 'starter-napoleon',
    name: 'ナポレオンデッキ',
    icon: '⚔️',
    trumpCard: 'ナポレオン',
    themeCards: ['火薬', '大砲'],
    noiseCards: ['紙', '電話', '光合成', '車輪', '知床', '厳島神社', 'ハチドリ'],
    description: '大砲とナポレオン法典を集めてナポレオンを覚醒させろ。ジャンヌやマリーを仲間にすればフランス最強デッキに',
  },
  {
    id: 'starter-amazon',
    name: 'アマゾンデッキ',
    icon: '🌿',
    trumpCard: 'アナコンダ',
    themeCards: ['ピラニア', 'アマゾン川'],
    noiseCards: ['紙', '電話', '光合成', '車輪', 'コロッセオ', '地動説', '火薬'],
    description: 'アマゾン川とピラニアで群れを育て、アナコンダを大蛇に進化させろ',
  },
  {
    id: 'starter-heritage',
    name: '始皇帝デッキ',
    icon: '🏛️',
    trumpCard: '始皇帝',
    themeCards: ['万里の長城', '焚書坑儒'],
    noiseCards: ['紙', '電話', 'ハチドリ', '車輪', 'ピラニア', '光合成', '火薬'],
    description: '焚書坑儒で相手を削り、不老不死の薬で始皇帝を蘇らせろ',
  },
  {
    id: 'starter-galileo',
    name: 'ガリレオデッキ',
    icon: '🔭',
    trumpCard: 'ガリレオ',
    themeCards: ['望遠鏡', '地動説'],
    noiseCards: ['紙', 'ハチドリ', '車輪', 'ピラニア', 'コロッセオ', 'モアイ像', '光合成'],
    description: '望遠鏡で地動説や天動説をサーチ。ベンチを育ててガリレオを覚醒させろ',
  },
  {
    id: 'starter-random',
    name: 'ランダムデッキ',
    icon: '🎲',
    trumpCard: '',   // random R card
    themeCards: [],
    noiseCards: [],   // all random
    description: '運命に身を任せろ。何が来るかはお楽しみ',
  },
];

// ===== Deck Builders =====

/** Fisher-Yates shuffle */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function findCardByName(name: string): BattleCard | undefined {
  return ALL_BATTLE_CARDS.find((c) => c.name === name);
}

/** Build a deck from named cards, filling noise with random N cards */
function buildNamedDeck(
  prefix: string,
  cardNames: string[],
  deckSize: number = INITIAL_DECK_SIZE,
): BattleCard[] {
  const stamp = Date.now();
  const deck: BattleCard[] = [];
  const usedNames = new Set<string>();

  // Add named cards
  for (const name of cardNames) {
    const card = findCardByName(name);
    if (card) {
      deck.push({ ...card, id: `${prefix}-${card.id}-${deck.length}-${stamp}` });
      usedNames.add(name);
    }
  }

  // Fill remaining with random N cards (noise)
  if (deck.length < deckSize) {
    const nPool = shuffled(
      DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'N' && !usedNames.has(c.name)),
    );
    for (const c of nPool) {
      if (deck.length >= deckSize) break;
      if (deck.filter((d) => d.name === c.name).length >= 2) continue; // max 2 same name for N
      deck.push({ ...c, id: `${prefix}-${c.id}-${deck.length}-${stamp}` });
    }
  }

  return shuffled(deck);
}

/** Build a player starter deck from a StarterDeck definition */
export function buildStarterDeck(starter: StarterDeck): BattleCard[] {
  if (starter.id === 'starter-random') {
    // Random: 1 R trump + 9 random N
    const rPool = shuffled(DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'R'));
    const trump = rPool[0];
    const nPool = shuffled(DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'N' && c.name !== trump?.name));
    const names = [trump?.name ?? '紙', ...nPool.slice(0, 9).map((c) => c.name)];
    return buildNamedDeck('player', names);
  }

  const allNames = [starter.trumpCard, ...starter.themeCards, ...starter.noiseCards];
  return buildNamedDeck('player', allNames);
}

/** Create NPC initial deck from stage config */
export function createStageAIDeck(stageId: number): BattleCard[] {
  const stage = getStage(stageId);
  if (!stage) return buildNamedDeck('ai', [], INITIAL_DECK_SIZE);

  const deckSize = stage.rules.npcDeckSize ?? INITIAL_DECK_SIZE;
  const seedNames = [...stage.npcDeckSeeds];

  return buildNamedDeck(`ai-stage${stageId}`, seedNames, deckSize);
}

// ===== NPC Deck Phase AI =====

/**
 * NPC auto-picks cards during deck phase.
 * Returns the cards to add to the NPC deck.
 */
export function npcDeckPhasePick(
  npcDeck: BattleCard[],
  round: number,
  stageRules: StageRules,
): BattleCard[] {
  const pickCount = stageRules.npcDeckPhasePickCount ?? 2;
  const synergyRate = stageRules.npcSynergyRate ?? 0;

  // Determine allowed rarities by round (same as player)
  const allowedRarities: Set<CardRarity> = new Set();
  if (round <= 1) { allowedRarities.add('N'); }
  else if (round <= 2) { allowedRarities.add('N'); allowedRarities.add('R'); }
  else if (round <= 3) { allowedRarities.add('R'); allowedRarities.add('SR'); }
  else if (round <= 4) { allowedRarities.add('SR'); }
  else { allowedRarities.add('SR'); allowedRarities.add('SSR'); }

  // Build candidate pool
  const deckNames = new Set(npcDeck.map((c) => c.name));
  const pool = DRAFTABLE_BATTLE_CARDS.filter((c) => {
    if (!allowedRarities.has(c.rarity)) return false;
    // Respect same-name limits
    const sameCount = npcDeck.filter((d) => d.name === c.name).length;
    if (c.rarity === 'N' && sameCount >= 2) return false;
    if (c.rarity !== 'N' && sameCount >= 1) return false;
    return true;
  });

  // Score cards by synergy with existing deck
  const scoredPool = pool.map((card) => {
    let synergyScore = 0;
    const synergies = SYNERGY_MAP[card.name];
    if (synergies) {
      for (const s of synergies) {
        if (deckNames.has(s)) synergyScore++;
      }
    }
    return { card, synergyScore };
  });

  // Sort: synergy cards first, then shuffle within tiers
  scoredPool.sort((a, b) => b.synergyScore - a.synergyScore);

  const picked: BattleCard[] = [];
  const stamp = Date.now();
  const usedNames = new Set<string>();

  for (let i = 0; i < pickCount && scoredPool.length > 0; i++) {
    const useSynergy = Math.random() < synergyRate;
    let choice: BattleCard | null = null;

    if (useSynergy) {
      // Pick best synergy card
      const synergyCards = scoredPool.filter((s) => s.synergyScore > 0 && !usedNames.has(s.card.name));
      if (synergyCards.length > 0) {
        const idx = Math.floor(Math.random() * Math.min(3, synergyCards.length));
        choice = synergyCards[idx].card;
      }
    }

    if (!choice) {
      // Random pick
      const available = scoredPool.filter((s) => !usedNames.has(s.card.name));
      if (available.length > 0) {
        const idx = Math.floor(Math.random() * available.length);
        choice = available[idx].card;
      }
    }

    if (choice) {
      picked.push({ ...choice, id: `ai-pick-${choice.id}-r${round}-${i}-${stamp}` });
      usedNames.add(choice.name);
    }
  }

  return picked;
}
