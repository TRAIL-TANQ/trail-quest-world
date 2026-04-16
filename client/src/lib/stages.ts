/**
 * Solo Stage Mode - ステージ定義 + AI デッキビルダー + NPCデッキフェイズ + スターターデッキ
 *
 * 全10ステージ。各ステージ3回戦制。プレイヤーもNPCも初期デッキ10枚から成長。
 * 各回戦開始時にデッキフェイズでカードを追加取得（NPC自動、プレイヤーはクイズ）。
 */
import { ALL_BATTLE_CARDS, DRAFTABLE_BATTLE_CARDS, INITIAL_DECK_SIZE, SYNERGY_MAP, maxSameNameFor } from './knowledgeCards';
import type { BattleCard, CardRarity } from './knowledgeCards';

// ===== Stage Rules =====
export interface StageRules {
  benchLimit?: number;            // player bench max (default 6)
  deckPhaseCards?: number;        // cards offered per deck phase (default 9)
  npcEffectMultiplier?: number;   // multiply NPC effect bonuses (default 1.0)
  npcAttackBonus?: number;        // flat attack bonus for NPC cards matching condition
  npcAttackBonusFilter?: string;  // category filter for npcAttackBonus (e.g. 'creature')
  npcDefenseBonus?: number;       // flat defense bonus for NPC cards matching condition
  npcDefenseBonusFilter?: string; // category filter for npcDefenseBonus
  skipDeckPhase?: boolean;        // player skips deck phase (default false)
  npcDeckSize?: number;           // NPC initial deck size (default INITIAL_DECK_SIZE = 15)
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

// ===== Special Rule Descriptions =====

/** 短いタグ形式（ステージ選択カード向け） */
export function shortSpecialRuleTags(rules: StageRules): string[] {
  const tags: string[] = [];
  if (rules.benchLimit !== undefined && rules.benchLimit !== 6) {
    tags.push(`⚠️ ベンチ${rules.benchLimit}枠`);
  }
  if (rules.npcBenchSlots !== undefined && rules.npcBenchSlots !== 6) {
    tags.push(`⚠️ 相手ベンチ${rules.npcBenchSlots}枠`);
  }
  if (rules.deckPhaseCards !== undefined && rules.deckPhaseCards !== 9) {
    tags.push(`⚠️ 提示${rules.deckPhaseCards}枚`);
  }
  if (rules.skipDeckPhase) {
    tags.push('⚠️ デッキフェイズなし');
  }
  if (rules.npcDeckSize !== undefined && rules.npcDeckSize !== INITIAL_DECK_SIZE) {
    tags.push(`⚠️ 相手デッキ${rules.npcDeckSize}枚`);
  }
  if (rules.npcDoubleBenchEffect) {
    tags.push('⚠️ 相手ベンチ効果2倍');
  }
  if (rules.npcEffectMultiplier !== undefined && rules.npcEffectMultiplier !== 1.0) {
    tags.push(`⚠️ 相手効果${rules.npcEffectMultiplier}倍`);
  }
  return tags;
}

/** 長文形式（バトル開始時バナー向け） */
export function longSpecialRuleMessages(rules: StageRules): string[] {
  const msgs: string[] = [];
  if (rules.benchLimit !== undefined && rules.benchLimit !== 6) {
    msgs.push(`あなたのベンチは${rules.benchLimit}枠です（通常6枠）`);
  }
  if (rules.npcBenchSlots !== undefined && rules.npcBenchSlots !== 6) {
    msgs.push(`相手のベンチは${rules.npcBenchSlots}枠です（通常6枠）`);
  }
  if (rules.deckPhaseCards !== undefined && rules.deckPhaseCards !== 9) {
    msgs.push(`提示カードが${rules.deckPhaseCards}枚です（通常9枚）`);
  }
  if (rules.skipDeckPhase) {
    msgs.push('デッキフェイズなし');
  }
  if (rules.npcDeckSize !== undefined && rules.npcDeckSize !== INITIAL_DECK_SIZE) {
    msgs.push(`相手の初期デッキが${rules.npcDeckSize}枚です（通常${INITIAL_DECK_SIZE}枚）`);
  }
  if (rules.npcDoubleBenchEffect) {
    msgs.push('相手のベンチ効果が2回発動');
  }
  if (rules.npcEffectMultiplier !== undefined && rules.npcEffectMultiplier !== 1.0) {
    msgs.push(`相手カード効果が${rules.npcEffectMultiplier}倍`);
  }
  return msgs;
}

/** 特殊ルールがあるか */
export function hasSpecialRules(rules: StageRules): boolean {
  return longSpecialRuleMessages(rules).length > 0;
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
    themeCards: [
      '大砲', '大砲', '大砲',
      'ナポレオン法典', 'ナポレオン法典', 'ナポレオン法典',
      '火薬', '火薬',
      'ワーテルローの戦い',
      '凱旋門',
      'ダイナマイト',
      'アウステルリッツの太陽',
    ],
    noiseCards: ['紙', '紙'],
    description: '大砲とナポレオン法典で皇帝を強化。アウステルリッツの太陽で全効果を倍化',
  },
  {
    id: 'starter-amazon',
    name: 'アマゾンデッキ',
    icon: '🌿',
    trumpCard: 'アナコンダ',
    themeCards: [
      'アナコンダ', 'アナコンダ',
      'ピラニア', 'ピラニア', 'ピラニア',
      '毒矢カエル', '毒矢カエル',
      'ジャガー', 'ジャガー',
      'ピンクイルカ', 'ピンクイルカ', 'ピンクイルカ',
      'アマゾン川',
      '大蛇の巫師',
    ],
    noiseCards: ['紙'],
    description: '巫師で大蛇を召喚し、ピンクイルカで巫師を回収。アマゾン川がある限りループは止まらない',
  },
  {
    id: 'starter-heritage',
    name: '始皇帝デッキ',
    icon: '🏛️',
    trumpCard: '始皇帝',
    themeCards: [
      '万里の長城',
      '紙', '紙', '紙',
      '兵馬俑', '兵馬俑',
      '秦の兵士', '秦の兵士', '秦の兵士',
      '始皇帝の勅令', '始皇帝の勅令',
      '焚書坑儒',
      '光合成',
    ],
    noiseCards: ['車輪'],
    description: '紙と焚書坑儒で相手デッキを削り、兵馬俑と秦の兵士で圧倒せよ',
  },
  {
    id: 'starter-nobunaga',
    name: '信長デッキ',
    icon: '🔥',
    trumpCard: '織田信長',
    themeCards: [
      '鉄砲', '鉄砲', '鉄砲',
      '足軽', '足軽', '足軽',
      '馬防柵',
      '楽市楽座',
      '敦盛の舞',
      '長篠の陣',
      '南蛮貿易',
      '安土城',
      '本能寺の変',
    ],
    noiseCards: ['紙'],
    description: '鉄砲と足軽で戦場を制圧。本能寺の変で歴史を塗り替える明智ルートへ',
  },
  {
    id: 'starter-galileo',
    name: 'ガリレオデッキ',
    icon: '🔭',
    trumpCard: 'ガリレオ',
    themeCards: [
      'ガリレオ',
      '望遠鏡', '望遠鏡', '望遠鏡',
      '地動説', '地動説', '地動説',
      '天動説', '天動説',
      '万有引力', '万有引力',
      '地球は動いている',
      '電球',
    ],
    noiseCards: ['紙'],
    description: '望遠鏡で地動説をサーチ。地球は動いているで相手ベンチを封印',
  },
  {
    id: 'starter-murasaki',
    name: '紫式部・清少納言デッキ',
    icon: '🌸',
    trumpCard: '紫式部',
    themeCards: [
      '紫式部',
      '清少納言', '清少納言',
      '和歌', '和歌', '和歌',
      '筆', '筆', '筆',
      '十二単', '十二単', '十二単',
      '源氏物語',
      '枕草子',
    ],
    noiseCards: ['紙'],
    description: '十二単で二人の才女を守り、源氏物語と枕草子で戦場を支配せよ',
  },
  {
    id: 'starter-jeanne',
    name: 'ジャンヌダルクデッキ',
    icon: '🗡️',
    trumpCard: 'ジャンヌ・ダルク',
    themeCards: [
      'ジャンヌ・ダルク',
      '聖剣', '聖剣', '聖剣',
      '軍旗', '軍旗', '軍旗',
      '祈りの光', '祈りの光',
      '白百合の盾', '白百合の盾',
      '聖女の旗印',
      '火刑',
    ],
    noiseCards: ['紙'],
    description: '聖剣と白百合の盾でジャンヌを強化。軍旗でサーチ、祈りの光で聖女ジャンヌが蘇る',
  },
  {
    id: 'starter-mandela',
    name: 'マンデラデッキ',
    icon: '🌍',
    trumpCard: 'ネルソン・マンデラ',
    themeCards: [
      'アパルトヘイト', 'アパルトヘイト',
      'ロベン島', 'ロベン島',
      '自由憲章', '自由憲章', '自由憲章',
      'ノーベル平和賞', 'ノーベル平和賞', 'ノーベル平和賞',
      '虹の国',
      'サバンナ',
      'アフリカゾウ',
    ],
    noiseCards: ['紙'],
    description: 'ロベン島と自由憲章でマンデラを守り育て、虹の国で除外カードを全回収',
  },
  {
    id: 'starter-wolf',
    name: 'オオカミデッキ',
    icon: '🐺',
    trumpCard: 'オオカミ',
    themeCards: [
      'オオカミ',
      '遠吠え', '遠吠え', '遠吠え',
      '群れの掟', '群れの掟', '群れの掟',
      '縄張り', '縄張り', '縄張り',
      '一匹狼',
      '月下の遠吠え',
      'サバンナ',
    ],
    noiseCards: ['紙'],
    description: '群れの掟と縄張りでオオカミを育て、月下の遠吠えで祖先の力を呼び覚ませ',
  },
  {
    id: 'starter-davinci',
    name: 'ダ・ヴィンチデッキ',
    icon: '🎨',
    trumpCard: 'レオナルド・ダ・ヴィンチ',
    themeCards: [
      'レオナルド・ダ・ヴィンチ',
      'モナ・リザ', 'モナ・リザ',
      '最後の晩餐', '最後の晩餐',
      '設計図', '設計図', '設計図',
      '解剖学', '解剖学',
      '鏡文字', '鏡文字',
      '万有引力',
    ],
    noiseCards: ['紙'],
    description: 'モナ・リザ+最後の晩餐でダ・ヴィンチを万能の天才に進化させろ',
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
  const missedNames: string[] = [];

  // Add named cards
  for (const name of cardNames) {
    const card = findCardByName(name);
    if (card) {
      deck.push({ ...card, id: `${prefix}-${card.id}-${deck.length}-${stamp}` });
      usedNames.add(name);
    } else if (name) {
      missedNames.push(name);
      console.warn(`[デッキ構築] マッチしないカード名: '${name}' (prefix=${prefix})`);
    }
  }

  const filledFromNames = deck.length;

  // Fill remaining with random N cards (noise)
  if (deck.length < deckSize) {
    const nPool = shuffled(
      DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'N' && !usedNames.has(c.name)),
    );
    for (const c of nPool) {
      if (deck.length >= deckSize) break;
      if (deck.filter((d) => d.name === c.name).length >= maxSameNameFor(c.rarity, c.name)) continue;
      deck.push({ ...c, id: `${prefix}-${c.id}-${deck.length}-${stamp}` });
    }
  }

  console.log(`[デッキ構築] prefix=${prefix} 要求${cardNames.length}名 → 名前一致${filledFromNames}枚 + 補填${deck.length - filledFromNames}枚 = 合計${deck.length}枚 (deckSize=${deckSize})`);
  if (missedNames.length > 0) {
    console.warn(`[デッキ構築] 不一致カード: ${missedNames.join(', ')}`);
  }
  console.log(`[デッキ構築] 構築結果:`, deck.map((c) => c.name));

  return shuffled(deck);
}

/** Build a player starter deck from a StarterDeck definition */
export function buildStarterDeck(starter: StarterDeck): BattleCard[] {
  if (starter.id === 'starter-random') {
    // Random: 1 R trump + 9 random N
    const rPool = shuffled(DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'R'));
    const trump = rPool[0];
    const nPool = shuffled(DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'N' && c.name !== trump?.name));
    const names = [trump?.name ?? '紙', ...nPool.slice(0, INITIAL_DECK_SIZE - 1).map((c) => c.name)];
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
    if (sameCount >= maxSameNameFor(c.rarity, c.name)) return false;
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
