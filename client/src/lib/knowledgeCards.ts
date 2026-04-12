/**
 * Knowledge Challenger - Battle Card & Quiz Data
 *
 * ===== カード分離アーキテクチャ (変更6) =====
 * このプロジェクトのカードは 2 系統に分離されている:
 *
 *   1. CollectionCard  (client/src/lib/cardData.ts, types.ts)
 *      - 図鑑（コレクション）とガチャの排出対象
 *      - フィールド: id / name / category / rarity / description / imageUrl
 *      - 状態管理: useCollectionStore (ownedCardIds, newCardIds, acquiredOrder)
 *      - 表示: CollectionPage, GachaPage
 *
 *   2. BattleCard  (このファイル)
 *      - KnowledgeChallenger バトルでの対戦用。デッキ構築・ベンチ・パワー計算に使う
 *      - CollectionCard から toBattleCard() で派生生成される（同一 id を保持）
 *      - CollectionCard にはない battle 専用フィールドを持つ:
 *          power, attackPower, defensePower, correctBonus,
 *          effectDescription, quizzes, specialEffect, comboRequires, fromTheBench
 *      - 状態: KnowledgeChallenger の gameState (player/ai deck/bench)
 *
 * 2 系統は「同じ世界観のカードの異なる側面」を表す。id は共通なので
 * コレクションに追加された id から BattleCard を検索することは可能。
 * ただしプールの進行ゲート (ROUND_RARITY_WEIGHTS / availableRarities, 変更8) は
 * BattleCard 側（sampleCards）と CollectionCard 側（GachaPage.rollRarity）に
 * それぞれ適用されており、両プールとも levelToGachaPhase で同じラウンド軸を共有する。
 */
import { COLLECTION_CARDS } from './cardData';
import type { CollectionCard, CollectionCategory } from './types';

// Battle game categories (mapped from collection categories)
export type CardCategory = 'great_person' | 'creature' | 'heritage' | 'invention' | 'discovery';
export type CardRarity = 'N' | 'R' | 'SR' | 'SSR';

export type SpecialEffect = 'nuke_trigger' | 'nuke_ingredient_manhattan' | 'nuke_ingredient_trinity';

// ===== On-reveal card effects =====
// category: decides the color of the floating "effect telop" shown on reveal.
//   atk     = 赤 (味方攻撃アップ / 火薬二倍 など)
//   def     = 青 (味方防御アップ)
//   debuff  = 紫 (相手弱体化)
//   bench   = 緑 (ベンチ / デッキ構造操作)
//   special = 金 (その他の特殊効果)
export type CardEffectCategory = 'atk' | 'def' | 'debuff' | 'bench' | 'special';

export interface CardEffect {
  id: string;
  name: string;
  description: string;
  category: CardEffectCategory;
}

export const EFFECT_COLORS: Record<CardEffectCategory, string> = {
  atk: '#ef4444',     // 赤
  def: '#3b82f6',     // 青
  debuff: '#a855f7',  // 紫
  bench: '#22c55e',   // 緑
  special: '#ffd700', // 金
};

export const EFFECT_DEFS: Record<string, CardEffect> = {
  davinci:    { id: 'davinci',    name: '万能の天才',         description: '公開時、攻撃時は攻撃+3、防御時は防御+3。', category: 'special' },
  einstein:   { id: 'einstein',   name: '相対性理論',         description: '公開時、相手の最強カード1枚のパワーを-2する。', category: 'debuff' },
  curie:      { id: 'curie',      name: '放射能の発見',       description: '公開時、このラウンドの味方攻撃すべて+1。', category: 'atk' },
  napoleon:   { id: 'napoleon',   name: '電撃戦',             description: '攻撃時、攻撃パワー+3。', category: 'atk' },
  cleopatra:  { id: 'cleopatra',  name: '魅了',               description: '公開時、相手のデッキ一番上を隔離する。', category: 'bench' },
  nobunaga:   { id: 'nobunaga',   name: '天下布武',           description: '公開時、相手のベンチ最強カードを封印する。', category: 'bench' },
  mozart:     { id: 'mozart',     name: '天才の旋律',         description: '公開時、次に公開する味方カードの攻撃+2。', category: 'atk' },
  // Galileo: keeps the bench-swap effect AND gains +1/+1 per 地動説 on bench.
  galileo:    { id: 'galileo',    name: '地動説の支持者',     description: '公開時、自分ベンチの「地動説」1枚につき攻撃+1/防御+1。さらに味方ベンチ合計が相手未満ならベンチ入れ替え。', category: 'special' },
  piranha:    { id: 'piranha',    name: '群れの猛攻',         description: '攻撃時、自分のベンチに同名ピラニアが居るほど攻撃+1。', category: 'atk' },
  dolphin:    { id: 'dolphin',    name: 'エコーロケーション', description: '公開時、相手デッキ上2枚のうち強い方を底へ送る。', category: 'special' },
  internet:   { id: 'internet',   name: '情報革命',           description: '公開時、自分ベンチからランダム1枚を隔離。', category: 'bench' },
  phone:      { id: 'phone',      name: '通信',               description: '公開時、次デッキフェイズは5枚中3枚取得可。', category: 'special' },
  // Telescope: search own deck for 地動説 and move it to the top.
  telescope:  { id: 'telescope',  name: '天体観測',           description: '公開時、デッキ内の「地動説」をデッキの一番上に移動する。', category: 'special' },
  // Gunpowder: passive bench effect (no reveal action) — read by Dynamite at reveal.
  gunpowder:  { id: 'gunpowder',  name: '爆薬の基礎',         description: 'From the bench: ベンチにある間、「ダイナマイト」の攻撃パワー+2。', category: 'special' },
  // Heliocentric: passive bench effect — read by Galileo at reveal.
  heliocentric: { id: 'heliocentric', name: 'コペルニクスの真理', description: 'From the bench: ベンチにある間、「ガリレオ」の攻撃+1/防御+1 (重複可)。', category: 'special' },
  // Dynamite: gains +2 attack per 火薬 on own bench.
  dynamite:   { id: 'dynamite',   name: '大爆発',             description: '公開時、自分ベンチの「火薬」1枚につき攻撃+2。', category: 'atk' },
  compass:    { id: 'compass',    name: '航海術',             description: '公開時、自分デッキの上3枚をパワー順に並べ替える。', category: 'bench' },
  penicillin: { id: 'penicillin', name: '治療',               description: '公開時、自分ベンチ最強カード1枚をデッキの下へ戻す。', category: 'bench' },
  paper:      { id: 'paper',      name: '記録',               description: '公開時、このマッチの獲得ALT+5。', category: 'special' },
};

// Card name → effect id. These are the only cards that carry on-reveal effects.
// 全世界遺産はステータス特化のまま効果なし。
export const EFFECT_BY_CARD_NAME: Record<string, string> = {
  'ダ・ヴィンチ':       'davinci',
  'アインシュタイン':   'einstein',
  'キュリー夫人':       'curie',
  'ナポレオン':         'napoleon',
  'クレオパトラ':       'cleopatra',
  '織田信長':           'nobunaga',
  'モーツァルト':       'mozart',
  'ガリレオ':           'galileo',
  'ピラニア':           'piranha',
  'イルカ':             'dolphin',
  'インターネット':     'internet',
  '電話':               'phone',
  '望遠鏡':             'telescope',
  '火薬':               'gunpowder',
  'ダイナマイト':       'dynamite',
  '地動説':             'heliocentric',
  '羅針盤':             'compass',
  'ペニシリン':         'penicillin',
  '紙':                 'paper',
};

export interface BattleCard {
  id: string;
  name: string;
  category: CardCategory;
  rarity: CardRarity;
  power: number;
  attackPower?: number;   // Optional override when attacking (falls back to power)
  defensePower?: number;  // Optional override when defending (falls back to power)
  effectDescription: string;
  quizzes: Quiz[];
  correctBonus: number;
  imageUrl: string;
  description: string;
  specialEffect?: SpecialEffect;
  comboRequires?: string[];    // Names of bench cards required for combo trigger
  fromTheBench?: boolean;      // Effect active while on bench
  effect?: CardEffect;         // On-reveal auto-trigger effect (新効果システム)
}

// ===== Category × Rarity 攻防バランス表 (2026-04 rebalance) =====
// Each entry lists the stat profile pool for that (category, rarity). When a
// card has multiple profiles, toBattleCard picks deterministically via id so
// N 偉人 splits roughly 50/50 between (1/1) and (2/1), etc.
//
// ジャンル別方針:
//   偉人:      攻撃やや高 / 防御やや低
//   生き物:    攻撃高 / 防御低
//   世界遺産:  攻撃低 / 防御特化 (効果なし)
//   発明:      バランス型
//   発見:      バランス型 (発明と同じ)
type StatProfile = { attackPower: number; defensePower: number };
export const CATEGORY_RARITY_STATS: Record<CardCategory, Record<CardRarity, StatProfile[]>> = {
  great_person: {
    N:   [{ attackPower: 1, defensePower: 1 }, { attackPower: 2, defensePower: 1 }],
    R:   [{ attackPower: 3, defensePower: 2 }],
    SR:  [{ attackPower: 5, defensePower: 3 }],
    SSR: [{ attackPower: 6, defensePower: 4 }],
  },
  creature: {
    N:   [{ attackPower: 2, defensePower: 1 }, { attackPower: 1, defensePower: 1 }],
    R:   [{ attackPower: 3, defensePower: 1 }],
    SR:  [{ attackPower: 5, defensePower: 2 }],
    SSR: [{ attackPower: 7, defensePower: 2 }],
  },
  heritage: {
    N:   [{ attackPower: 1, defensePower: 3 }],
    R:   [{ attackPower: 1, defensePower: 5 }],
    SR:  [{ attackPower: 1, defensePower: 6 }],
    SSR: [{ attackPower: 1, defensePower: 8 }],
  },
  invention: {
    N:   [{ attackPower: 1, defensePower: 1 }, { attackPower: 2, defensePower: 2 }],
    R:   [{ attackPower: 2, defensePower: 2 }, { attackPower: 3, defensePower: 3 }],
    SR:  [{ attackPower: 4, defensePower: 4 }],
    SSR: [{ attackPower: 5, defensePower: 5 }],
  },
  discovery: {
    N:   [{ attackPower: 1, defensePower: 1 }, { attackPower: 2, defensePower: 2 }],
    R:   [{ attackPower: 2, defensePower: 2 }, { attackPower: 3, defensePower: 3 }],
    SR:  [{ attackPower: 4, defensePower: 4 }],
    SSR: [{ attackPower: 5, defensePower: 5 }],
  },
};

// Deterministic profile pick based on card id → stable across reloads.
function pickStatProfile(id: string, profiles: StatProfile[]): StatProfile {
  if (profiles.length === 1) return profiles[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % profiles.length;
  return profiles[idx];
}

// Per-card stat overrides for combo / signature cards that need stats
// outside the category default. Keyed by card name for stability.
export const CARD_STAT_OVERRIDES: Record<string, StatProfile> = {
  'ダイナマイト': { attackPower: 3, defensePower: 2 },
};

// Combo card IDs for detection
export const COMBO_CARD_IDS = {
  MANHATTAN: 'card-101',
  TRINITY: 'card-102',
  NUKE: 'card-103',
} as const;

export interface Quiz {
  question: string;
  choices: [string, string, string, string];
  correctIndex: number;
}

// Map collection categories to battle categories
const CATEGORY_MAP: Record<CollectionCategory, CardCategory> = {
  great_people: 'great_person',
  creatures: 'creature',
  world_heritage: 'heritage',
  inventions: 'invention',
  discovery: 'discovery',
};

// Category display info
export const CATEGORY_INFO: Record<CardCategory, { label: string; emoji: string; color: string }> = {
  great_person: { label: '偉人', emoji: '👤', color: '#f59e0b' },
  creature: { label: '生き物', emoji: '🐾', color: '#22c55e' },
  heritage: { label: '世界遺産', emoji: '🏛️', color: '#8b5cf6' },
  invention: { label: '発明', emoji: '⚙️', color: '#3b82f6' },
  discovery: { label: '発見', emoji: '🔬', color: '#ef4444' },
};

export const RARITY_INFO: Record<CardRarity, { label: string; color: string; bgColor: string }> = {
  N: { label: 'N', color: '#9ca3af', bgColor: 'rgba(156,163,175,0.15)' },
  R: { label: 'R', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)' },
  SR: { label: 'SR', color: '#a855f7', bgColor: 'rgba(168,85,247,0.15)' },
  SSR: { label: 'SSR', color: '#ffd700', bgColor: 'rgba(255,215,0,0.15)' },
};

// Power by rarity
// RARITY_POWER was removed in the 2026-04 rebalance — stats now come from
// CATEGORY_RARITY_STATS. RARITY_BONUS is kept for correctBonus on quiz rewards.
const RARITY_BONUS: Record<CardRarity, number> = { N: 1, R: 1, SR: 2, SSR: 2 };

// ===== Quiz data for all 100 cards =====
const QUIZ_DATA: Record<string, Quiz[]> = {
  // ===== 偉人 (Great People) =====
  'card-001': [
    { question: 'ダ・ヴィンチが描いた有名な絵画は？', choices: ['ひまわり', 'モナ・リザ', '叫び', '真珠の耳飾りの少女'], correctIndex: 1 },
    { question: 'ダ・ヴィンチが活躍した時代は？', choices: ['古代ギリシャ', '中世', 'ルネサンス', '産業革命'], correctIndex: 2 },
    { question: 'ダ・ヴィンチの出身国は？', choices: ['フランス', 'イタリア', 'スペイン', 'ドイツ'], correctIndex: 1 },
  ],
  'card-002': [
    { question: 'アインシュタインが発表した有名な理論は？', choices: ['進化論', '相対性理論', '万有引力', '量子力学'], correctIndex: 1 },
    { question: 'アインシュタインが受賞したノーベル賞の分野は？', choices: ['化学賞', '平和賞', '物理学賞', '文学賞'], correctIndex: 2 },
    { question: 'E=mc²の「c」は何を表す？', choices: ['光の速さ', '電流', '温度', '質量'], correctIndex: 0 },
  ],
  'card-003': [
    { question: 'キュリー夫人が発見した元素は？', choices: ['ウラン', 'ラジウム', 'プルトニウム', 'ネオン'], correctIndex: 1 },
    { question: 'キュリー夫人はノーベル賞を何回受賞した？', choices: ['1回', '2回', '3回', '4回'], correctIndex: 1 },
    { question: 'キュリー夫人の出身国は？', choices: ['フランス', 'ドイツ', 'ポーランド', 'ロシア'], correctIndex: 2 },
  ],
  'card-004': [
    { question: 'ナポレオンが皇帝になった国は？', choices: ['イギリス', 'フランス', 'ドイツ', 'スペイン'], correctIndex: 1 },
    { question: 'ナポレオンが敗れた有名な戦いは？', choices: ['トラファルガーの海戦', 'ワーテルローの戦い', 'ノルマンディー上陸', 'マラトンの戦い'], correctIndex: 1 },
    { question: 'ナポレオンが流された島は？', choices: ['シチリア島', 'セントヘレナ島', 'マダガスカル島', 'コルシカ島'], correctIndex: 1 },
  ],
  'card-005': [
    { question: 'クレオパトラが女王だった国は？', choices: ['ローマ', 'ギリシャ', 'エジプト', 'ペルシャ'], correctIndex: 2 },
    { question: 'クレオパトラと関係が深いローマの将軍は？', choices: ['カエサル', 'ネロ', 'アウグストゥス', 'スパルタクス'], correctIndex: 0 },
    { question: 'クレオパトラが使ったとされる言語は？', choices: ['ラテン語', 'ギリシャ語', 'アラビア語', 'ヘブライ語'], correctIndex: 1 },
  ],
  'card-006': [
    { question: '織田信長が行った有名な戦いは？', choices: ['関ヶ原の戦い', '桶狭間の戦い', '壇ノ浦の戦い', '川中島の戦い'], correctIndex: 1 },
    { question: '信長が建てた城は？', choices: ['大阪城', '姫路城', '安土城', '名古屋城'], correctIndex: 2 },
    { question: '信長の異名は？', choices: ['太閤', '第六天魔王', '征夷大将軍', '天下人'], correctIndex: 1 },
  ],
  'card-007': [
    { question: '坂本龍馬が仲介した同盟は？', choices: ['日英同盟', '薩長同盟', '三国同盟', '日米同盟'], correctIndex: 1 },
    { question: '坂本龍馬の出身地は？', choices: ['鹿児島', '山口', '高知', '京都'], correctIndex: 2 },
    { question: '龍馬が設立した組織は？', choices: ['新選組', '海援隊', '奇兵隊', '薩摩藩'], correctIndex: 1 },
  ],
  'card-008': [
    { question: 'エジソンが実用化した発明は？', choices: ['電話', '白熱電球', 'テレビ', 'ラジオ'], correctIndex: 1 },
    { question: 'エジソンの有名な言葉「天才とは1%の○○と99%の努力」', choices: ['才能', 'ひらめき', '運', '知識'], correctIndex: 1 },
    { question: 'エジソンが設立した会社は現在の？', choices: ['アップル', 'GE', 'マイクロソフト', 'IBM'], correctIndex: 1 },
  ],
  'card-009': [
    { question: 'ニュートンが発見した法則は？', choices: ['相対性理論', '万有引力の法則', '進化論', '熱力学の法則'], correctIndex: 1 },
    { question: 'ニュートンが万有引力を思いついたきっかけは？', choices: ['月を見て', 'リンゴが落ちるのを見て', '海の波を見て', '風を感じて'], correctIndex: 1 },
    { question: 'ニュートンの出身国は？', choices: ['フランス', 'ドイツ', 'イギリス', 'イタリア'], correctIndex: 2 },
  ],
  'card-010': [
    { question: 'ガリレオが支持した学説は？', choices: ['天動説', '地動説', '進化論', '大陸移動説'], correctIndex: 1 },
    { question: 'ガリレオが天体観測に使った道具は？', choices: ['顕微鏡', '望遠鏡', '羅針盤', '日時計'], correctIndex: 1 },
    { question: 'ガリレオの出身国は？', choices: ['フランス', 'イタリア', 'ドイツ', 'スペイン'], correctIndex: 1 },
  ],
  'card-011': [
    { question: 'モーツァルトが作曲を始めた年齢は？', choices: ['3歳', '5歳', '7歳', '10歳'], correctIndex: 1 },
    { question: 'モーツァルトの出身地は？', choices: ['ウィーン', 'ザルツブルク', 'ベルリン', 'パリ'], correctIndex: 1 },
    { question: 'モーツァルトの有名な曲は？', choices: ['月光', 'トルコ行進曲', '運命', 'エリーゼのために'], correctIndex: 1 },
  ],
  'card-012': [
    { question: 'シェイクスピアの代表作は？', choices: ['ドン・キホーテ', 'ロミオとジュリエット', '戦争と平和', 'レ・ミゼラブル'], correctIndex: 1 },
    { question: 'シェイクスピアの出身国は？', choices: ['フランス', 'イタリア', 'イギリス', 'スペイン'], correctIndex: 2 },
    { question: 'シェイクスピアの職業は？', choices: ['画家', '劇作家', '音楽家', '科学者'], correctIndex: 1 },
  ],
  'card-013': [
    { question: '野口英世が研究した病気は？', choices: ['結核', '黄熱病', 'コレラ', 'ペスト'], correctIndex: 1 },
    { question: '野口英世の肖像が描かれているお札は？', choices: ['五千円札', '千円札', '一万円札', '二千円札'], correctIndex: 1 },
    { question: '野口英世の出身地は？', choices: ['東京', '大阪', '福島', '北海道'], correctIndex: 2 },
  ],
  'card-014': [
    { question: '北里柴三郎が治療法を開発した病気は？', choices: ['結核', '破傷風', 'コレラ', 'マラリア'], correctIndex: 1 },
    { question: '北里柴三郎の肖像が描かれている新紙幣は？', choices: ['千円札', '五千円札', '一万円札', '二千円札'], correctIndex: 0 },
    { question: '北里柴三郎が設立した研究所は？', choices: ['理化学研究所', '北里研究所', '東京大学', '慶應義塾'], correctIndex: 1 },
  ],
  'card-015': [
    { question: '伊能忠敬が作ったものは？', choices: ['辞書', '日本地図', '暦', '法律'], correctIndex: 1 },
    { question: '伊能忠敬が測量を始めた年齢は？', choices: ['20代', '30代', '50代', '70代'], correctIndex: 2 },
    { question: '伊能忠敬の測量方法は？', choices: ['船で海岸を回った', '日本中を歩いて測った', '山の上から見た', '星を使って計算した'], correctIndex: 1 },
  ],
  // ===== 生き物 (Creatures) =====
  'card-016': [
    { question: 'ティラノサウルスが生きていた時代は？', choices: ['ジュラ紀', '白亜紀', '三畳紀', '石炭紀'], correctIndex: 1 },
    { question: 'ティラノサウルスの体長はおよそ？', choices: ['5メートル', '8メートル', '12メートル', '20メートル'], correctIndex: 2 },
    { question: 'ティラノサウルスの食性は？', choices: ['草食', '雑食', '肉食', '虫食'], correctIndex: 2 },
  ],
  'card-017': [
    { question: 'マンモスが生きていた時代は？', choices: ['恐竜時代', '氷河期', '古代エジプト', '中世'], correctIndex: 1 },
    { question: 'マンモスの特徴は？', choices: ['短い牙', '長い牙と毛', '大きな翼', '鋭い爪'], correctIndex: 1 },
    { question: 'マンモスが絶滅した原因と考えられているのは？', choices: ['隕石', '気候変動と人間の狩り', '病気', '火山噴火'], correctIndex: 1 },
  ],
  'card-018': [
    { question: 'シロナガスクジラの体長はおよそ？', choices: ['10メートル', '20メートル', '30メートル', '50メートル'], correctIndex: 2 },
    { question: 'シロナガスクジラは何を食べる？', choices: ['大きな魚', 'オキアミ', 'イカ', '海藻'], correctIndex: 1 },
    { question: 'シロナガスクジラは何の仲間？', choices: ['魚類', '爬虫類', '哺乳類', '両生類'], correctIndex: 2 },
  ],
  'card-019': [
    { question: 'アフリカゾウの特徴は？', choices: ['小さな耳', '大きな耳', '短い鼻', '角がある'], correctIndex: 1 },
    { question: 'アフリカゾウは陸上で何番目に大きい動物？', choices: ['1番', '2番', '3番', '5番'], correctIndex: 0 },
    { question: 'アフリカゾウの牙の材質は？', choices: ['骨', '象牙（歯）', '角', '石'], correctIndex: 1 },
  ],
  'card-020': [
    { question: 'ジャイアントパンダの主食は？', choices: ['肉', '果物', '竹', '草'], correctIndex: 2 },
    { question: 'ジャイアントパンダの生息地は？', choices: ['日本', '中国', 'インド', 'ロシア'], correctIndex: 1 },
    { question: 'パンダの体の色は？', choices: ['茶色と白', '黒と白', '灰色と白', '黒と茶色'], correctIndex: 1 },
  ],
  'card-021': [
    { question: 'コモドドラゴンが住んでいる国は？', choices: ['オーストラリア', 'インドネシア', 'マダガスカル', 'ブラジル'], correctIndex: 1 },
    { question: 'コモドドラゴンは世界最大の何？', choices: ['ヘビ', 'トカゲ', 'カメ', 'ワニ'], correctIndex: 1 },
    { question: 'コモドドラゴンの体長はおよそ？', choices: ['1メートル', '2メートル', '3メートル', '5メートル'], correctIndex: 2 },
  ],
  'card-022': [
    { question: 'ミツバチの巣の形は？', choices: ['三角形', '四角形', '六角形', '円形'], correctIndex: 2 },
    { question: 'ミツバチが仲間に花の場所を教える方法は？', choices: ['鳴き声', '8の字ダンス', 'フェロモン', '色を変える'], correctIndex: 1 },
    { question: 'ミツバチが花から集めるものは？', choices: ['花粉だけ', '蜜だけ', '花粉と蜜', '種'], correctIndex: 2 },
  ],
  'card-023': [
    { question: 'ダーウィンフィンチが住んでいる島は？', choices: ['ハワイ諸島', 'ガラパゴス諸島', 'カナリア諸島', 'マルタ島'], correctIndex: 1 },
    { question: 'ダーウィンフィンチが進化論のヒントになった理由は？', choices: ['色が違う', 'くちばしの形が違う', '大きさが違う', '鳴き声が違う'], correctIndex: 1 },
    { question: 'ダーウィンフィンチを研究した科学者は？', choices: ['メンデル', 'ダーウィン', 'ラマルク', 'ワトソン'], correctIndex: 1 },
  ],
  'card-024': [
    { question: 'シーラカンスが「生きた化石」と呼ばれる理由は？', choices: ['体が石のように硬い', '何億年も姿が変わっていない', '化石の中から見つかった', '石を食べる'], correctIndex: 1 },
    { question: 'シーラカンスの特徴的な体の部分は？', choices: ['大きな目', '肉質のヒレ', '長い尾', '鋭い歯'], correctIndex: 1 },
    { question: 'シーラカンスが発見された海は？', choices: ['太平洋', '大西洋', 'インド洋', '北極海'], correctIndex: 2 },
  ],
  'card-025': [
    { question: 'ピラニアが住んでいる川は？', choices: ['ナイル川', 'アマゾン川', 'ミシシッピ川', 'ガンジス川'], correctIndex: 1 },
    { question: 'ピラニアの特徴は？', choices: ['大きな体', '鋭い歯', '長い尾', '毒を持つ'], correctIndex: 1 },
    { question: 'ピラニアの食性は？', choices: ['草食', '肉食', '雑食', '虫食'], correctIndex: 1 },
  ],
  // ===== 世界遺産 (World Heritage) =====
  'card-026': [
    { question: '万里の長城がある国は？', choices: ['日本', '中国', 'インド', 'モンゴル'], correctIndex: 1 },
    { question: '万里の長城の長さはおよそ？', choices: ['約2000km', '約6000km', '約21000km', '約500km'], correctIndex: 2 },
    { question: '万里の長城を最初に大規模に建設した皇帝は？', choices: ['始皇帝', '劉邦', '武帝', '康熙帝'], correctIndex: 0 },
  ],
  'card-027': [
    { question: 'ピラミッドがある国は？', choices: ['インド', 'エジプト', 'ギリシャ', 'トルコ'], correctIndex: 1 },
    { question: '最も大きいピラミッドは誰の墓？', choices: ['カフラー王', 'クフ王', 'メンカウラー王', 'ツタンカーメン'], correctIndex: 1 },
    { question: 'ピラミッドは何のために作られた？', choices: ['神殿', '王の墓', '天文台', '倉庫'], correctIndex: 1 },
  ],
  'card-028': [
    { question: 'コロッセオがある国は？', choices: ['ギリシャ', 'イタリア', 'トルコ', 'スペイン'], correctIndex: 1 },
    { question: 'コロッセオの収容人数はおよそ？', choices: ['1万人', '3万人', '5万人', '10万人'], correctIndex: 2 },
    { question: 'コロッセオで行われていたのは？', choices: ['演劇', '剣闘士の戦い', '宗教儀式', '市場'], correctIndex: 1 },
  ],
  'card-029': [
    { question: 'タージ・マハルがある国は？', choices: ['パキスタン', 'インド', 'イラン', 'トルコ'], correctIndex: 1 },
    { question: 'タージ・マハルは何のために建てられた？', choices: ['王宮', '寺院', '妻の墓', '要塞'], correctIndex: 2 },
    { question: 'タージ・マハルの主な材料は？', choices: ['花崗岩', '大理石', 'レンガ', '木材'], correctIndex: 1 },
  ],
  'card-030': [
    { question: 'アンコールワットがある国は？', choices: ['タイ', 'カンボジア', 'ベトナム', 'ミャンマー'], correctIndex: 1 },
    { question: 'アンコールワットは何の宗教の寺院？', choices: ['仏教', 'ヒンドゥー教', 'イスラム教', 'キリスト教'], correctIndex: 1 },
    { question: 'アンコールワットは世界最大の何？', choices: ['城', '宗教建築物', '橋', '塔'], correctIndex: 1 },
  ],
  'card-031': [
    { question: '屋久島にある有名な杉の名前は？', choices: ['大杉', '縄文杉', '神代杉', '千年杉'], correctIndex: 1 },
    { question: '屋久島がある県は？', choices: ['沖縄県', '鹿児島県', '宮崎県', '長崎県'], correctIndex: 1 },
    { question: '縄文杉の樹齢はおよそ？', choices: ['1000年', '3000年', '7000年', '10000年'], correctIndex: 2 },
  ],
  'card-032': [
    { question: '富士山の標高は？', choices: ['2776m', '3776m', '4776m', '5776m'], correctIndex: 1 },
    { question: '富士山は何県にまたがっている？', choices: ['静岡と山梨', '東京と神奈川', '長野と岐阜', '静岡と愛知'], correctIndex: 0 },
    { question: '富士山は世界遺産の何に登録されている？', choices: ['自然遺産', '文化遺産', '複合遺産', '無形遺産'], correctIndex: 1 },
  ],
  'card-033': [
    { question: 'マチュ・ピチュがある国は？', choices: ['ブラジル', 'ペルー', 'メキシコ', 'チリ'], correctIndex: 1 },
    { question: 'マチュ・ピチュの別名は？', choices: ['空中都市', '黄金都市', '水の都', '砂の城'], correctIndex: 0 },
    { question: 'マチュ・ピチュを作った文明は？', choices: ['マヤ文明', 'アステカ文明', 'インカ帝国', 'オルメカ文明'], correctIndex: 2 },
  ],
  'card-034': [
    { question: 'ストーンヘンジがある国は？', choices: ['フランス', 'イギリス', 'アイルランド', 'スコットランド'], correctIndex: 1 },
    { question: 'ストーンヘンジが作られたのはおよそ何年前？', choices: ['1000年前', '3000年前', '5000年前', '10000年前'], correctIndex: 2 },
    { question: 'ストーンヘンジは何でできている？', choices: ['木', '巨石', 'レンガ', '金属'], correctIndex: 1 },
  ],
  'card-035': [
    { question: '法隆寺を建立したのは？', choices: ['聖武天皇', '聖徳太子', '藤原道長', '源頼朝'], correctIndex: 1 },
    { question: '法隆寺がある県は？', choices: ['京都府', '奈良県', '大阪府', '滋賀県'], correctIndex: 1 },
    { question: '法隆寺は世界最古の何？', choices: ['石造建築', '木造建築', '城', '寺院'], correctIndex: 1 },
  ],
  // ===== 発明 (Inventions) =====
  'card-036': [
    { question: '電球を実用化したのは？', choices: ['ニュートン', 'エジソン', 'テスラ', 'ベル'], correctIndex: 1 },
    { question: '電球が発明される前の照明は？', choices: ['蛍光灯', 'ガス灯やろうそく', 'LED', '松明だけ'], correctIndex: 1 },
    { question: '電球の中のフィラメントの材料は？', choices: ['銅', 'タングステン', '鉄', 'アルミ'], correctIndex: 1 },
  ],
  'card-037': [
    { question: '蒸気機関を改良したのは？', choices: ['ワット', 'スティーブンソン', 'フルトン', 'ニューコメン'], correctIndex: 0 },
    { question: '蒸気機関が最初に使われた分野は？', choices: ['鉄道', '船', '炭鉱の排水', '工場'], correctIndex: 2 },
    { question: '産業革命が始まった国は？', choices: ['フランス', 'ドイツ', 'アメリカ', 'イギリス'], correctIndex: 3 },
  ],
  'card-038': [
    { question: 'ヨーロッパで活版印刷を発明したのは？', choices: ['エジソン', 'グーテンベルク', 'ガリレオ', 'ニュートン'], correctIndex: 1 },
    { question: '活版印刷で最初に印刷された有名な本は？', choices: ['聖書', 'コーラン', '論語', 'イリアス'], correctIndex: 0 },
    { question: '活版印刷が発明されたのは何世紀？', choices: ['13世紀', '15世紀', '17世紀', '19世紀'], correctIndex: 1 },
  ],
  'card-039': [
    { question: '飛行機を初めて飛ばしたのは？', choices: ['リンドバーグ', 'ライト兄弟', 'サン＝テグジュペリ', 'ツェッペリン'], correctIndex: 1 },
    { question: '初飛行が行われた年は？', choices: ['1893年', '1903年', '1913年', '1923年'], correctIndex: 1 },
    { question: '初飛行の場所は？', choices: ['パリ', 'ロンドン', 'キティホーク', '東京'], correctIndex: 2 },
  ],
  'card-040': [
    { question: 'インターネットの前身は？', choices: ['WWW', 'ARPANET', 'イントラネット', 'テレックス'], correctIndex: 1 },
    { question: 'WWWを発明したのは？', choices: ['ビル・ゲイツ', 'スティーブ・ジョブズ', 'ティム・バーナーズ＝リー', 'マーク・ザッカーバーグ'], correctIndex: 2 },
    { question: 'インターネットが一般に普及し始めたのは？', choices: ['1970年代', '1980年代', '1990年代', '2000年代'], correctIndex: 2 },
  ],
  'card-041': [
    { question: '電話を発明したのは？', choices: ['エジソン', 'ベル', 'マルコーニ', 'テスラ'], correctIndex: 1 },
    { question: '電話が発明された年はおよそ？', choices: ['1836年', '1856年', '1876年', '1896年'], correctIndex: 2 },
    { question: '電話の最初の言葉は？', choices: ['もしもし', 'ワトソン君、来てくれ', 'こんにちは', 'テスト'], correctIndex: 1 },
  ],
  'card-042': [
    { question: '望遠鏡を天体観測に初めて使った科学者は？', choices: ['コペルニクス', 'ガリレオ', 'ケプラー', 'ニュートン'], correctIndex: 1 },
    { question: 'ガリレオが望遠鏡で発見したものは？', choices: ['土星の輪', '木星の衛星', '海王星', '火星の運河'], correctIndex: 1 },
    { question: '望遠鏡が発明された国は？', choices: ['イタリア', 'オランダ', 'イギリス', 'ドイツ'], correctIndex: 1 },
  ],
  'card-043': [
    { question: 'ペニシリンを発見したのは？', choices: ['パスツール', 'フレミング', 'コッホ', 'ジェンナー'], correctIndex: 1 },
    { question: 'ペニシリンは何に効く薬？', choices: ['ウイルス', '細菌', 'がん', 'アレルギー'], correctIndex: 1 },
    { question: 'ペニシリンが発見されたきっかけは？', choices: ['実験の成功', 'カビが生えた培養皿', '植物の研究', '動物の観察'], correctIndex: 1 },
  ],
  'card-044': [
    { question: '羅針盤を発明した国は？', choices: ['日本', 'エジプト', '中国', 'インド'], correctIndex: 2 },
    { question: '羅針盤が指す方角は？', choices: ['東', '西', '南', '北'], correctIndex: 3 },
    { question: '羅針盤が活躍した時代は？', choices: ['石器時代', '大航海時代', '産業革命', '宇宙時代'], correctIndex: 1 },
  ],
  'card-045': [
    { question: '火薬を発明した国は？', choices: ['日本', 'インド', '中国', 'ギリシャ'], correctIndex: 2 },
    { question: '火薬の平和的な利用は？', choices: ['武器', '花火', '爆弾', '地雷'], correctIndex: 1 },
    { question: '火薬は中国の何大発明の一つ？', choices: ['三大', '四大', '五大', '六大'], correctIndex: 1 },
  ],
  // ===== 探究 (Discovery) =====
  'card-046': [
    { question: '宇宙の誕生はおよそ何億年前？', choices: ['46億年前', '100億年前', '138億年前', '200億年前'], correctIndex: 2 },
    { question: '宇宙の始まりを表す言葉は？', choices: ['ビッグバン', 'ビッグクランチ', 'ブラックホール', 'スーパーノヴァ'], correctIndex: 0 },
    { question: '宇宙は今どうなっている？', choices: ['縮んでいる', '膨張している', '止まっている', '回転している'], correctIndex: 1 },
  ],
  'card-047': [
    { question: 'DNAの構造を発見した科学者は？', choices: ['メンデル', 'ワトソンとクリック', 'ダーウィン', 'パスツール'], correctIndex: 1 },
    { question: 'DNAの形は？', choices: ['一本の直線', '二重らせん', '三角形', '環状'], correctIndex: 1 },
    { question: 'DNAは何の略？', choices: ['デオキシリボ核酸', 'ジアミノ核酸', 'ダイナミック核酸', 'デュアル核酸'], correctIndex: 0 },
  ],
  'card-048': [
    { question: '元素周期表を作ったのは？', choices: ['アインシュタイン', 'メンデレーエフ', 'ニュートン', 'ボーア'], correctIndex: 1 },
    { question: '元素周期表に載っている元素の数はおよそ？', choices: ['50', '80', '118', '200'], correctIndex: 2 },
    { question: '水素は元素周期表で何番？', choices: ['0番', '1番', '2番', '10番'], correctIndex: 1 },
  ],
  'card-049': [
    { question: '地動説を唱えたのは？', choices: ['ガリレオ', 'コペルニクス', 'ケプラー', 'プトレマイオス'], correctIndex: 1 },
    { question: '地動説の内容は？', choices: ['太陽が地球の周りを回る', '地球が太陽の周りを回る', '月が地球の周りを回る', '星が動かない'], correctIndex: 1 },
    { question: '地動説の前に信じられていた説は？', choices: ['進化論', '天動説', '大陸移動説', '相対性理論'], correctIndex: 1 },
  ],
  'card-050': [
    { question: '進化論を唱えたのは？', choices: ['メンデル', 'ダーウィン', 'ラマルク', 'ワトソン'], correctIndex: 1 },
    { question: 'ダーウィンが調査した有名な島は？', choices: ['ハワイ', 'ガラパゴス', 'マダガスカル', 'タスマニア'], correctIndex: 1 },
    { question: '進化論の著書の名前は？', choices: ['種の起源', '自然の哲学', '動物記', '生命の樹'], correctIndex: 0 },
  ],
  // ===== 追加カード (card-051 ~ card-100) =====
  'card-051': [
    { question: 'ゴッホの代表作は？', choices: ['モナ・リザ', 'ひまわり', '叫び', '睡蓮'], correctIndex: 1 },
    { question: 'ゴッホの出身国は？', choices: ['フランス', 'オランダ', 'ドイツ', 'ベルギー'], correctIndex: 1 },
    { question: 'ゴッホが自ら切り落としたと言われる体の部分は？', choices: ['指', '耳', '鼻', '髪'], correctIndex: 1 },
  ],
  'card-052': [
    { question: 'ピカソが創始した芸術運動は？', choices: ['印象派', 'キュビズム', 'シュルレアリスム', 'ポップアート'], correctIndex: 1 },
    { question: 'ピカソの代表作は？', choices: ['ひまわり', '叫び', 'ゲルニカ', '最後の晩餐'], correctIndex: 2 },
    { question: 'ピカソの出身国は？', choices: ['フランス', 'イタリア', 'スペイン', 'ポルトガル'], correctIndex: 2 },
  ],
  'card-053': [
    { question: 'ベートーヴェンの代表曲は？', choices: ['トルコ行進曲', '交響曲第九番', '四季', 'カノン'], correctIndex: 1 },
    { question: 'ベートーヴェンが失ったものは？', choices: ['視力', '聴力', '記憶', '声'], correctIndex: 1 },
    { question: 'ベートーヴェンの出身国は？', choices: ['オーストリア', 'ドイツ', 'イタリア', 'フランス'], correctIndex: 1 },
  ],
  'card-054': [
    { question: 'マリー・アントワネットが処刑された革命は？', choices: ['アメリカ独立革命', 'フランス革命', 'ロシア革命', '産業革命'], correctIndex: 1 },
    { question: 'マリー・アントワネットの出身国は？', choices: ['フランス', 'オーストリア', 'ドイツ', 'スペイン'], correctIndex: 1 },
    { question: 'マリー・アントワネットの夫は？', choices: ['ルイ14世', 'ルイ15世', 'ルイ16世', 'ナポレオン'], correctIndex: 2 },
  ],
  'card-055': [
    { question: '孔子が創始した思想は？', choices: ['道教', '儒教', '仏教', '法家'], correctIndex: 1 },
    { question: '孔子の言葉が記録された書物は？', choices: ['老子', '論語', '孫子', '易経'], correctIndex: 1 },
    { question: '孔子の出身国は？', choices: ['日本', '韓国', '中国', 'インド'], correctIndex: 2 },
  ],
  'card-056': [
    { question: 'マルコ・ポーロが旅した道は？', choices: ['シルクロード', 'スパイスロード', 'ゴールドロード', 'アンバーロード'], correctIndex: 0 },
    { question: 'マルコ・ポーロの出身都市は？', choices: ['ローマ', 'フィレンツェ', 'ヴェネツィア', 'ミラノ'], correctIndex: 2 },
    { question: 'マルコ・ポーロが残した書物は？', choices: ['世界の記述', '東方見聞録', '旅行記', '冒険日記'], correctIndex: 1 },
  ],
  'card-057': [
    { question: 'ジャンヌ・ダルクが活躍した戦争は？', choices: ['十字軍', '百年戦争', '三十年戦争', 'ナポレオン戦争'], correctIndex: 1 },
    { question: 'ジャンヌ・ダルクの出身国は？', choices: ['イギリス', 'フランス', 'ドイツ', 'スペイン'], correctIndex: 1 },
    { question: 'ジャンヌ・ダルクが聞いたとされるものは？', choices: ['音楽', '神の声', '予言', '歌'], correctIndex: 1 },
  ],
  'card-058': [
    { question: 'アレクサンダー大王の出身地は？', choices: ['ローマ', 'アテネ', 'マケドニア', 'スパルタ'], correctIndex: 2 },
    { question: 'アレクサンダー大王が征服した地域は？', choices: ['ヨーロッパだけ', 'アフリカだけ', 'エジプトからインドまで', '中国まで'], correctIndex: 2 },
    { question: 'アレクサンダー大王の師匠は？', choices: ['ソクラテス', 'プラトン', 'アリストテレス', 'ピタゴラス'], correctIndex: 2 },
  ],
  'card-059': [
    { question: '豊臣秀吉の出身は？', choices: ['武士', '農民', '商人', '僧侶'], correctIndex: 1 },
    { question: '秀吉が建てた城は？', choices: ['安土城', '大阪城', '姫路城', '江戸城'], correctIndex: 1 },
    { question: '秀吉の最高の官職は？', choices: ['将軍', '関白', '天皇', '大臣'], correctIndex: 1 },
  ],
  'card-060': [
    { question: 'ナイチンゲールが活躍した戦争は？', choices: ['第一次世界大戦', 'クリミア戦争', 'ナポレオン戦争', '南北戦争'], correctIndex: 1 },
    { question: 'ナイチンゲールの別名は？', choices: ['白衣の天使', 'クリミアの天使', 'ランプの貴婦人', '看護の母'], correctIndex: 2 },
    { question: 'ナイチンゲールの出身国は？', choices: ['フランス', 'ドイツ', 'イギリス', 'アメリカ'], correctIndex: 2 },
  ],
  'card-061': [
    { question: 'パスツールが開発したものは？', choices: ['ペニシリン', '狂犬病ワクチン', 'X線', '麻酔'], correctIndex: 1 },
    { question: 'パスツールが発明した殺菌法は？', choices: ['高圧殺菌', '低温殺菌', '紫外線殺菌', '煮沸殺菌'], correctIndex: 1 },
    { question: 'パスツールの出身国は？', choices: ['ドイツ', 'イギリス', 'フランス', 'イタリア'], correctIndex: 2 },
  ],
  'card-062': [
    { question: 'ヘレン・ケラーが克服した障害は？', choices: ['視覚・聴覚・言語', '視覚のみ', '聴覚のみ', '運動障害'], correctIndex: 0 },
    { question: 'ヘレン・ケラーの先生の名前は？', choices: ['サリバン先生', 'スミス先生', 'ジョンソン先生', 'ブラウン先生'], correctIndex: 0 },
    { question: 'ヘレン・ケラーが最初に理解した言葉は？', choices: ['ママ', 'ウォーター', 'ラブ', 'ハンド'], correctIndex: 1 },
  ],
  'card-063': [
    { question: 'アルキメデスが発見した原理は？', choices: ['万有引力', '浮力の原理', '相対性理論', '電磁気学'], correctIndex: 1 },
    { question: 'アルキメデスが「エウレカ！」と叫んだ場所は？', choices: ['研究室', 'お風呂', '海', '山'], correctIndex: 1 },
    { question: 'アルキメデスの出身地は？', choices: ['アテネ', 'シラクサ', 'ローマ', 'スパルタ'], correctIndex: 1 },
  ],
  'card-064': [
    { question: 'ヒポクラテスは何の父と呼ばれる？', choices: ['哲学の父', '医学の父', '科学の父', '数学の父'], correctIndex: 1 },
    { question: 'ヒポクラテスの誓いとは？', choices: ['王への忠誠', '医師の倫理', '神への祈り', '戦士の誓い'], correctIndex: 1 },
    { question: 'ヒポクラテスの出身地は？', choices: ['ローマ', 'エジプト', 'ギリシャ', 'ペルシャ'], correctIndex: 2 },
  ],
  'card-065': [
    { question: '紫式部が書いた作品は？', choices: ['枕草子', '源氏物語', '徒然草', '方丈記'], correctIndex: 1 },
    { question: '紫式部が活躍した時代は？', choices: ['奈良時代', '平安時代', '鎌倉時代', '室町時代'], correctIndex: 1 },
    { question: '源氏物語は世界最古の何？', choices: ['詩集', '長編小説', '日記', '歴史書'], correctIndex: 1 },
  ],
  'card-066': [
    { question: 'プテラノドンは何の仲間？', choices: ['恐竜', '翼竜', '鳥', '哺乳類'], correctIndex: 1 },
    { question: 'プテラノドンの翼を広げた大きさは？', choices: ['3メートル', '5メートル', '7メートル以上', '10メートル'], correctIndex: 2 },
    { question: 'プテラノドンが生きていた時代は？', choices: ['ジュラ紀', '白亜紀', '三畳紀', '石炭紀'], correctIndex: 1 },
  ],
  'card-067': [
    { question: 'サーベルタイガーの特徴は？', choices: ['大きな角', '長い犬歯', '長い尾', '厚い甲羅'], correctIndex: 1 },
    { question: 'サーベルタイガーが生きていた時代は？', choices: ['恐竜時代', '氷河期', '古代エジプト', '中世'], correctIndex: 1 },
    { question: 'サーベルタイガーは何科の動物？', choices: ['イヌ科', 'クマ科', 'ネコ科', 'ハイエナ科'], correctIndex: 2 },
  ],
  'card-068': [
    { question: 'オオカミの特徴的な行動は？', choices: ['単独で狩り', '群れで狩り', '夜だけ活動', '冬眠する'], correctIndex: 1 },
    { question: 'オオカミが月に向かってすることは？', choices: ['踊る', '遠吠え', '走る', '寝る'], correctIndex: 1 },
    { question: 'オオカミの群れのリーダーを何と呼ぶ？', choices: ['キング', 'アルファ', 'ボス', 'チーフ'], correctIndex: 1 },
  ],
  'card-069': [
    { question: 'イルカは何の仲間？', choices: ['魚類', '爬虫類', '哺乳類', '両生類'], correctIndex: 2 },
    { question: 'イルカが使うコミュニケーション方法は？', choices: ['光', '超音波', '電気', '磁力'], correctIndex: 1 },
    { question: 'イルカの睡眠方法の特徴は？', choices: ['目を開けて寝る', '脳の半分ずつ寝る', '水の上で寝る', '冬眠する'], correctIndex: 1 },
  ],
  'card-070': [
    { question: 'カメレオンの特徴は？', choices: ['毒を持つ', '体の色を変える', '飛べる', '水中で暮らす'], correctIndex: 1 },
    { question: 'カメレオンの目の特徴は？', choices: ['暗闇で光る', '360度回転する', '3つある', '色が変わる'], correctIndex: 1 },
    { question: 'カメレオンは何の仲間？', choices: ['両生類', '哺乳類', '爬虫類', '鳥類'], correctIndex: 2 },
  ],
  'card-071': [
    { question: 'ホッキョクグマが住んでいる場所は？', choices: ['南極', '北極圏', 'シベリア', 'アラスカだけ'], correctIndex: 1 },
    { question: 'ホッキョクグマの毛の色は？', choices: ['白', '実は透明', '黄色', '灰色'], correctIndex: 1 },
    { question: 'ホッキョクグマの主な食べ物は？', choices: ['魚', 'アザラシ', '植物', 'ペンギン'], correctIndex: 1 },
  ],
  'card-072': [
    { question: 'カブトムシの幼虫が食べるのは？', choices: ['葉っぱ', '腐葉土', '木の実', '花の蜜'], correctIndex: 1 },
    { question: 'カブトムシの角があるのは？', choices: ['オスだけ', 'メスだけ', '両方', 'どちらもない'], correctIndex: 0 },
    { question: 'カブトムシは何の仲間？', choices: ['バッタ', '甲虫', 'セミ', 'トンボ'], correctIndex: 1 },
  ],
  'card-073': [
    { question: 'ウミガメが産卵のために戻る場所は？', choices: ['深海', '生まれた浜', '川', '岩場'], correctIndex: 1 },
    { question: 'ウミガメは何の仲間？', choices: ['魚類', '両生類', '爬虫類', '哺乳類'], correctIndex: 2 },
    { question: 'ウミガメの甲羅の役割は？', choices: ['泳ぐため', '体を守るため', '食べ物を蓄えるため', '呼吸するため'], correctIndex: 1 },
  ],
  'card-074': [
    { question: 'フクロウが活動する時間帯は？', choices: ['朝', '昼', '夕方', '夜'], correctIndex: 3 },
    { question: 'フクロウの首はどのくらい回る？', choices: ['90度', '180度', '270度', '360度'], correctIndex: 2 },
    { question: 'フクロウが音を立てずに飛べる理由は？', choices: ['体が軽い', '羽の構造が特殊', '風を操る', '小さいから'], correctIndex: 1 },
  ],
  'card-075': [
    { question: 'クラゲに脳はある？', choices: ['ある', 'ない', '小さいのがある', '2つある'], correctIndex: 1 },
    { question: 'クラゲの体の大部分は何でできている？', choices: ['筋肉', '骨', '水', '脂肪'], correctIndex: 2 },
    { question: '光るクラゲが持っている物質は？', choices: ['蛍光タンパク質', '電気', 'リン', '水銀'], correctIndex: 0 },
  ],
  'card-076': [
    { question: '自由の女神がある都市は？', choices: ['ワシントン', 'ニューヨーク', 'ロサンゼルス', 'シカゴ'], correctIndex: 1 },
    { question: '自由の女神を贈った国は？', choices: ['イギリス', 'フランス', 'ドイツ', 'イタリア'], correctIndex: 1 },
    { question: '自由の女神が持っているものは？', choices: ['剣と盾', 'たいまつと本', '花と鳥', '鍵と旗'], correctIndex: 1 },
  ],
  'card-077': [
    { question: 'サグラダ・ファミリアを設計したのは？', choices: ['ミケランジェロ', 'ガウディ', 'ダ・ヴィンチ', 'コルビュジエ'], correctIndex: 1 },
    { question: 'サグラダ・ファミリアがある都市は？', choices: ['マドリード', 'バルセロナ', 'リスボン', 'パリ'], correctIndex: 1 },
    { question: 'サグラダ・ファミリアの着工年は？', choices: ['1782年', '1882年', '1982年', '1832年'], correctIndex: 1 },
  ],
  'card-078': [
    { question: 'モン・サン＝ミシェルがある国は？', choices: ['イギリス', 'フランス', 'ベルギー', 'スペイン'], correctIndex: 1 },
    { question: 'モン・サン＝ミシェルの特徴は？', choices: ['山の上にある', '満潮時に海に囲まれる', '地下にある', '砂漠にある'], correctIndex: 1 },
    { question: 'モン・サン＝ミシェルは何の建物？', choices: ['城', '修道院', '灯台', '教会'], correctIndex: 1 },
  ],
  'card-079': [
    { question: 'ヴェルサイユ宮殿がある国は？', choices: ['イギリス', 'フランス', 'ドイツ', 'オーストリア'], correctIndex: 1 },
    { question: 'ヴェルサイユ宮殿の有名な部屋は？', choices: ['黄金の間', '鏡の間', '玉座の間', '音楽の間'], correctIndex: 1 },
    { question: 'ヴェルサイユ宮殿を建てた王は？', choices: ['ルイ13世', 'ルイ14世', 'ルイ15世', 'ルイ16世'], correctIndex: 1 },
  ],
  'card-080': [
    { question: 'ケルン大聖堂がある国は？', choices: ['フランス', 'ドイツ', 'イタリア', 'オーストリア'], correctIndex: 1 },
    { question: 'ケルン大聖堂の建築様式は？', choices: ['バロック', 'ゴシック', 'ロマネスク', 'ルネサンス'], correctIndex: 1 },
    { question: 'ケルン大聖堂の塔の高さはおよそ？', choices: ['100m', '130m', '157m', '200m'], correctIndex: 2 },
  ],
  'card-081': [
    { question: 'ナスカの地上絵がある国は？', choices: ['メキシコ', 'ペルー', 'ブラジル', 'チリ'], correctIndex: 1 },
    { question: 'ナスカの地上絵が見える方法は？', choices: ['地上から', '上空から', '水中から', '地下から'], correctIndex: 1 },
    { question: 'ナスカの地上絵に描かれているものは？', choices: ['文字', '動物や幾何学模様', '人の顔', '地図'], correctIndex: 1 },
  ],
  'card-082': [
    { question: '兵馬俑を作らせた皇帝は？', choices: ['劉邦', '始皇帝', '武帝', '康熙帝'], correctIndex: 1 },
    { question: '兵馬俑の兵士像の数はおよそ？', choices: ['1000体', '3000体', '8000体', '20000体'], correctIndex: 2 },
    { question: '兵馬俑がある国は？', choices: ['日本', '韓国', '中国', 'モンゴル'], correctIndex: 2 },
  ],
  'card-083': [
    { question: '厳島神社がある県は？', choices: ['広島県', '山口県', '島根県', '岡山県'], correctIndex: 0 },
    { question: '厳島神社の大鳥居の特徴は？', choices: ['金色', '海に立っている', '日本一高い', '石でできている'], correctIndex: 1 },
    { question: '厳島神社の大鳥居の色は？', choices: ['白', '黒', '朱色', '金色'], correctIndex: 2 },
  ],
  'card-084': [
    { question: 'アヤソフィアがある都市は？', choices: ['アテネ', 'カイロ', 'イスタンブール', 'ローマ'], correctIndex: 2 },
    { question: 'アヤソフィアの建築様式は？', choices: ['ゴシック', 'ビザンツ', 'バロック', 'ロマネスク'], correctIndex: 1 },
    { question: 'アヤソフィアの特徴は？', choices: ['高い塔', '巨大なドーム', '長い回廊', '地下室'], correctIndex: 1 },
  ],
  'card-085': [
    { question: '知床がある都道府県は？', choices: ['青森県', '北海道', '秋田県', '岩手県'], correctIndex: 1 },
    { question: '知床で見られる自然現象は？', choices: ['オーロラ', '流氷', '砂嵐', '竜巻'], correctIndex: 1 },
    { question: '知床に生息する大型動物は？', choices: ['ツキノワグマ', 'ヒグマ', 'ニホンザル', 'カモシカ'], correctIndex: 1 },
  ],
  'card-086': [
    { question: 'ロケットが人類を初めて月に運んだ計画は？', choices: ['ジェミニ計画', 'アポロ計画', 'マーキュリー計画', 'ソユーズ計画'], correctIndex: 1 },
    { question: '世界初の人工衛星の名前は？', choices: ['アポロ', 'スプートニク', 'ボイジャー', 'ハッブル'], correctIndex: 1 },
    { question: 'ロケットの推進力の原理は？', choices: ['浮力', '作用反作用', '遠心力', '磁力'], correctIndex: 1 },
  ],
  'card-087': [
    { question: '世界初の自動車を作ったのは？', choices: ['ヘンリー・フォード', 'カール・ベンツ', 'トヨタ喜一郎', 'ゴットリープ・ダイムラー'], correctIndex: 1 },
    { question: '自動車の動力源として最初に使われたのは？', choices: ['電気', 'ガソリン', '蒸気', '水素'], correctIndex: 0 },
    { question: 'T型フォードを作った人は？', choices: ['カール・ベンツ', 'ヘンリー・フォード', 'フェルディナント・ポルシェ', 'エンツォ・フェラーリ'], correctIndex: 1 },
  ],
  'card-088': [
    { question: 'カメラの語源は？', choices: ['カメラ・オブスクラ', 'カメラ・ルシダ', 'フォトグラフ', 'ダゲレオタイプ'], correctIndex: 0 },
    { question: '写真を発明したのは？', choices: ['エジソン', 'ニエプス', 'ベル', 'テスラ'], correctIndex: 1 },
    { question: 'カメラが記録するものは？', choices: ['音', '光', '温度', '振動'], correctIndex: 1 },
  ],
  'card-089': [
    { question: '顕微鏡で初めて細胞を観察したのは？', choices: ['パスツール', 'フック', 'レーウェンフック', 'コッホ'], correctIndex: 2 },
    { question: '顕微鏡で見えるものは？', choices: ['原子', '細胞や微生物', '分子', '電子'], correctIndex: 1 },
    { question: '顕微鏡の原理は？', choices: ['音波', 'レンズで光を拡大', '電気', '磁力'], correctIndex: 1 },
  ],
  'card-090': [
    { question: '温度計の原型を発明したのは？', choices: ['ニュートン', 'ガリレオ', 'ファーレンハイト', 'セルシウス'], correctIndex: 1 },
    { question: '水が沸騰する温度は？', choices: ['90℃', '100℃', '110℃', '120℃'], correctIndex: 1 },
    { question: '摂氏温度を考案したのは？', choices: ['ファーレンハイト', 'セルシウス', 'ケルビン', 'ガリレオ'], correctIndex: 1 },
  ],
  'card-091': [
    { question: '気球を発明したのは？', choices: ['ライト兄弟', 'モンゴルフィエ兄弟', 'ツェッペリン', 'リンドバーグ'], correctIndex: 1 },
    { question: '気球が浮かぶ原理は？', choices: ['磁力', '暖かい空気は軽い', '遠心力', '電気'], correctIndex: 1 },
    { question: '気球の初飛行はいつ頃？', choices: ['1683年', '1783年', '1883年', '1983年'], correctIndex: 1 },
  ],
  'card-092': [
    { question: '機械式時計の動力は？', choices: ['電池', 'ゼンマイ', '水', '太陽光'], correctIndex: 1 },
    { question: '世界で最初の時計は？', choices: ['砂時計', '日時計', '水時計', '振り子時計'], correctIndex: 1 },
    { question: '1日は何時間？', choices: ['12時間', '20時間', '24時間', '30時間'], correctIndex: 2 },
  ],
  'card-093': [
    { question: 'ダイナマイトを発明したのは？', choices: ['エジソン', 'ノーベル', 'ニュートン', 'テスラ'], correctIndex: 1 },
    { question: 'ノーベルがダイナマイトの利益で設立したのは？', choices: ['大学', 'ノーベル賞', '病院', '図書館'], correctIndex: 1 },
    { question: 'ダイナマイトの主な用途は？', choices: ['武器', '建設・採掘', '花火', '燃料'], correctIndex: 1 },
  ],
  'card-094': [
    { question: '紙を発明した国は？', choices: ['日本', 'エジプト', '中国', 'インド'], correctIndex: 2 },
    { question: '紙が発明される前に使われていたものは？', choices: ['布', '竹簡や羊皮紙', 'プラスチック', '金属板'], correctIndex: 1 },
    { question: '紙は中国の何大発明の一つ？', choices: ['三大', '四大', '五大', '六大'], correctIndex: 1 },
  ],
  'card-095': [
    { question: '車輪が発明されたのはおよそ何年前？', choices: ['約1000年前', '約3000年前', '約5000年前', '約500年前'], correctIndex: 2 },
    { question: '車輪が最初に使われた用途は？', choices: ['戦車', '陶器作り', '水車', '馬車'], correctIndex: 1 },
    { question: '車輪の形は？', choices: ['三角', '四角', '円', '楕円'], correctIndex: 2 },
  ],
  'card-096': [
    { question: '光がプリズムで分かれると何色になる？', choices: ['5色', '7色', '3色', '10色'], correctIndex: 1 },
    { question: '光の速さはおよそ？', choices: ['秒速3万km', '秒速30万km', '秒速300万km', '秒速3000km'], correctIndex: 1 },
    { question: '光の二重性とは？', choices: ['波と粒子の性質を持つ', '明るいと暗い', '赤と青', '速いと遅い'], correctIndex: 0 },
  ],
  'card-097': [
    { question: '量子力学が扱うのは？', choices: ['宇宙全体', '原子や電子などミクロの世界', '地球の内部', '天気'], correctIndex: 1 },
    { question: '量子力学の有名な思考実験は？', choices: ['ニュートンのリンゴ', 'シュレーディンガーの猫', 'ガリレオの塔', 'アインシュタインの電車'], correctIndex: 1 },
    { question: '量子力学の基礎を築いた科学者は？', choices: ['ニュートン', 'プランク', 'ダーウィン', 'パスツール'], correctIndex: 1 },
  ],
  'card-098': [
    { question: '万有引力を発見したのは？', choices: ['アインシュタイン', 'ニュートン', 'ガリレオ', 'ケプラー'], correctIndex: 1 },
    { question: 'ニュートンが万有引力を思いついたきっかけは？', choices: ['月を見て', 'リンゴが落ちるのを見て', '海の波を見て', '風を感じて'], correctIndex: 1 },
    { question: '万有引力は何と何の間に働く力？', choices: ['磁石同士', '全ての物体', '電気を帯びたもの', '生き物同士'], correctIndex: 1 },
  ],
  'card-099': [
    { question: '原子核を構成するのは？', choices: ['電子と陽子', '陽子と中性子', '電子と中性子', '光子と電子'], correctIndex: 1 },
    { question: '原子核を発見したのは？', choices: ['ボーア', 'ラザフォード', 'トムソン', 'チャドウィック'], correctIndex: 1 },
    { question: '原子核の大きさは原子の何分の1？', choices: ['10分の1', '1000分の1', '10万分の1', '100万分の1'], correctIndex: 2 },
  ],
  'card-100': [
    { question: '光合成で植物が作るものは？', choices: ['タンパク質と水', '酸素と糖', '二酸化炭素と水', '窒素と酸素'], correctIndex: 1 },
    { question: '光合成に必要なものは？', choices: ['水と酸素', '光と二酸化炭素と水', '土と肥料', '風と雨'], correctIndex: 1 },
    { question: '光合成が行われる場所は？', choices: ['根', '茎', '葉緑体', '花'], correctIndex: 2 },
  ],
  // ===== コンボカード =====
  'card-101': [
    { question: 'マンハッタン計画を主導した国は？', choices: ['アメリカ', 'ドイツ', 'ソ連', 'イギリス'], correctIndex: 0 },
    { question: 'マンハッタン計画の科学責任者は誰？', choices: ['アインシュタイン', 'オッペンハイマー', 'フェルミ', 'ボーア'], correctIndex: 1 },
    { question: 'マンハッタン計画が実施された時期は？', choices: ['第一次世界大戦', '第二次世界大戦', '冷戦初期', 'ベトナム戦争'], correctIndex: 1 },
  ],
  'card-102': [
    { question: '世界初の核実験「トリニティ実験」が行われた年は？', choices: ['1945年', '1939年', '1950年', '1942年'], correctIndex: 0 },
    { question: 'トリニティ実験が行われた場所は？', choices: ['ネバダ砂漠', 'ニューメキシコ州の砂漠', 'アラスカ', 'ハワイ'], correctIndex: 1 },
    { question: 'トリニティ実験で作られた爆弾の名前は？', choices: ['リトルボーイ', 'ファットマン', 'ガジェット', 'ツァーリ'], correctIndex: 2 },
  ],
  'card-103': [
    { question: '原子爆弾が実戦で使用された都市は？', choices: ['広島と長崎', '東京と大阪', 'ベルリンとミュンヘン', 'ロンドンとパリ'], correctIndex: 0 },
    { question: '広島に原爆が投下された日は？', choices: ['1945年8月6日', '1945年8月9日', '1945年8月15日', '1945年7月16日'], correctIndex: 0 },
    { question: '原子爆弾のエネルギー源は？', choices: ['化学反応', '核分裂', '核融合', '電磁波'], correctIndex: 1 },
  ],
  // ===== 追加カード =====
  'card-104': [
    { question: '黄熱病を媒介する生き物は？', choices: ['ハエ', '蛊', 'ノミ', 'ダニ'], correctIndex: 1 },
    { question: '黄熱病の研究に生涯を捧げた日本人科学者は？', choices: ['北里柴三郎', '野口英世', '志賀潔', '山中伸弥'], correctIndex: 1 },
    { question: '黄熱病の「黄」は何を指す？', choices: ['黄色い蛊', '黄疸（肌が黄色くなる）', '黄色い薬', '黄色い花'], correctIndex: 1 },
  ],
  'card-105': [
    { question: '天動説を体系化した古代の学者は？', choices: ['コペルニクス', 'プトレマイオス', 'アリストテレス', 'ガリレオ'], correctIndex: 1 },
    { question: '天動説では何が宇宙の中心？', choices: ['太陽', '地球', '月', '北極星'], correctIndex: 1 },
    { question: '天動説を否定した地動説を唱えたのは？', choices: ['ニュートン', 'コペルニクス', 'アインシュタイン', 'ダーウィン'], correctIndex: 1 },
  ],
};

// Effect descriptions by category
const CATEGORY_EFFECTS: Record<CardCategory, Record<CardRarity, string>> = {
  great_person: {
    N: '特殊効果なし',
    R: 'ベンチの同カテゴリ1枚につきパワー+1',
    SR: 'ベンチの同カテゴリ1枚につきパワー+2',
    SSR: '全ベンチカード1枚につきパワー+1',
  },
  creature: {
    N: '特殊効果なし',
    R: 'ベンチに送られず山札の一番下に戻る',
    SR: 'ベンチ空き枠が2つ以下ならパワー+4',
    SSR: 'ベンチのカード1枚を山札に戻す',
  },
  heritage: {
    N: '特殊効果なし',
    R: '防衛時パワー+2',
    SR: '防衛時パワー+3',
    SSR: '防衛時パワー+5、攻撃側は2枚以上必要',
  },
  invention: {
    N: '特殊効果なし',
    R: '防衛時パワー+1',
    SR: '攻撃時、追加で1枚めくりパワーを合算',
    SSR: '山札の上から3枚を見て好きな順番で戻す',
  },
  discovery: {
    N: '特殊効果なし',
    R: '攻撃時パワー+2',
    SR: '攻撃時パワー+3',
    SSR: '相手の防衛カードを強制的にベンチに送る',
  },
};

// Convert CollectionCard to BattleCard
function toBattleCard(cc: CollectionCard): BattleCard {
  const category = CATEGORY_MAP[cc.category];
  const rarity = cc.rarity as CardRarity;
  const correctBonus = RARITY_BONUS[rarity];
  let effectDescription = CATEGORY_EFFECTS[category][rarity];
  let specialEffect: SpecialEffect | undefined;
  let comboRequires: string[] | undefined;
  let fromTheBench = false;

  // 2026-04 rebalance: stats come from CATEGORY_RARITY_STATS per (category, rarity).
  // `power` is kept as a legacy fallback (= attackPower) for the few call sites
  // that still read it before attackPower/defensePower were always populated.
  // Per-card overrides take precedence (combo / signature cards).
  const baseProfile = CARD_STAT_OVERRIDES[cc.name]
    ?? pickStatProfile(cc.id, CATEGORY_RARITY_STATS[category][rarity]);
  let attackPower: number = baseProfile.attackPower;
  let defensePower: number = baseProfile.defensePower;
  let power = attackPower;

  // Combo card overrides (keep original combo identity; ignore category stats)
  if (cc.id === COMBO_CARD_IDS.MANHATTAN) {
    attackPower = 2;
    defensePower = 2;
    power = attackPower;
    specialEffect = 'nuke_ingredient_manhattan';
    fromTheBench = true;
    effectDescription = 'From the bench: 「原子爆弾」の発動条件。ベンチにある限り効果継続。';
  } else if (cc.id === COMBO_CARD_IDS.TRINITY) {
    attackPower = 2;
    defensePower = 2;
    power = attackPower;
    specialEffect = 'nuke_ingredient_trinity';
    fromTheBench = true;
    effectDescription = 'From the bench: 「原子爆弾」の発動条件。ベンチにある限り効果継続。';
  } else if (cc.id === COMBO_CARD_IDS.NUKE) {
    attackPower = 2;
    defensePower = 2;
    power = attackPower;
    specialEffect = 'nuke_trigger';
    comboRequires = ['マンハッタン計画', 'トリニティ実験'];
    effectDescription = '公開時発動：ベンチに「マンハッタン計画」と「トリニティ実験」がある場合、相手の場を破壊し、相手デッキ上から5枚を隔離。条件不足時は不発（基本パワー2）。';
  }

  const quizzes = QUIZ_DATA[cc.id] || [
    { question: `${cc.name}について正しいのは？`, choices: [cc.description, '宇宙で発見された', '1000年前に消えた', '南極にある'], correctIndex: 0 },
    { question: `${cc.name}のカテゴリは？`, choices: [CATEGORY_INFO[category].label, '未知', '伝説', '架空'], correctIndex: 0 },
    { question: `${cc.name}は有名？`, choices: ['はい', 'いいえ', 'わからない', '聞いたことがない'], correctIndex: 0 },
  ];

  // Attach on-reveal effect if this card name is mapped
  const effectId = EFFECT_BY_CARD_NAME[cc.name];
  const effect = effectId ? EFFECT_DEFS[effectId] : undefined;
  const finalEffectDescription = effect ? `${effect.name}：${effect.description}` : effectDescription;

  return {
    id: cc.id,
    name: cc.name,
    category,
    rarity,
    power,
    attackPower,
    defensePower,
    effectDescription: finalEffectDescription,
    quizzes,
    correctBonus,
    imageUrl: cc.imageUrl,
    description: cc.description,
    specialEffect,
    comboRequires,
    fromTheBench,
    effect,
  };
}

// All battle cards from collection
export const ALL_BATTLE_CARDS: BattleCard[] = COLLECTION_CARDS.map(toBattleCard);

// ===== Initial Deck Cards (generic N rarity) =====
const INITIAL_CARDS: BattleCard[] = [
  {
    id: 'init-great-person', name: '名もなき偉人', category: 'great_person', rarity: 'N',
    power: 1, effectDescription: '特殊効果なし', correctBonus: 1, imageUrl: '', description: '歴史に名を残した偉人',
    quizzes: [
      { question: '世界で最初に月面を歩いた人は？', choices: ['ニール・アームストロング', 'バズ・オルドリン', 'ユーリ・ガガーリン', 'ジョン・グレン'], correctIndex: 0 },
      { question: '「我思う、ゆえに我あり」と言った哲学者は？', choices: ['ソクラテス', 'プラトン', 'デカルト', 'アリストテレス'], correctIndex: 2 },
      { question: '日本で最初の女性小説家と言われるのは？', choices: ['清少納言', '紫式部', '与謝野晶子', '樋口一葉'], correctIndex: 1 },
    ],
  },
  {
    id: 'init-creature', name: '身近な生き物', category: 'creature', rarity: 'N',
    power: 2, effectDescription: '特殊効果なし', correctBonus: 1, imageUrl: '', description: '身の回りにいる生き物',
    quizzes: [
      { question: 'カブトムシの幼虫が食べるのは？', choices: ['葉っぱ', '腐葉土', '木の実', '花の蜜'], correctIndex: 1 },
      { question: 'メダカの体の特徴として正しいのは？', choices: ['ヒゲがある', '背びれが大きい', '口が上向き', '体に縞模様がある'], correctIndex: 2 },
      { question: 'アゲハチョウの幼虫が好む植物は？', choices: ['サクラ', 'ミカン', 'ヒマワリ', 'チューリップ'], correctIndex: 1 },
    ],
  },
  {
    id: 'init-discovery', name: '小さな発見', category: 'discovery', rarity: 'N',
    power: 3, effectDescription: '特殊効果なし', correctBonus: 1, imageUrl: '', description: '身近な科学の発見',
    quizzes: [
      { question: 'リンゴが木から落ちるのを見て万有引力を発見したのは？', choices: ['ガリレオ', 'ニュートン', 'アインシュタイン', 'ケプラー'], correctIndex: 1 },
      { question: '虹は何色に分かれる？', choices: ['5色', '6色', '7色', '8色'], correctIndex: 2 },
      { question: '水が氷になる温度は？', choices: ['−10℃', '0℃', '10℃', '100℃'], correctIndex: 1 },
    ],
  },
  {
    id: 'init-invention', name: '古い発明', category: 'invention', rarity: 'N',
    power: 4, effectDescription: '特殊効果なし', correctBonus: 1, imageUrl: '', description: '古くからある発明品',
    quizzes: [
      { question: '世界で最初に印刷に使われた技術は？', choices: ['活版印刷', '石版印刷', '木版印刷', 'スクリーン印刷'], correctIndex: 2 },
      { question: '車輪が発明されたのはおよそ何年前？', choices: ['約1000年前', '約3000年前', '約5000年前', '約500年前'], correctIndex: 2 },
      { question: '紙を発明した国は？', choices: ['日本', 'エジプト', '中国', 'インド'], correctIndex: 2 },
    ],
  },
];

// ===== Deck Building Rules =====
// Initial deck = 10 cards. Max deck = 15. Minimum during trim = 6 (MIN_DECK_SIZE).
export const INITIAL_DECK_SIZE = 10;
export const MAX_DECK_SIZE = 15;
export const MIN_DECK_SIZE = 6;  // デッキフェイズで削除できる下限

// 同名カード制限（rarity 別）
//   N, R : 5 枚まで
//   SR   : 3 枚まで
//   SSR  : 1 枚まで
export const MAX_SAME_NAME_BY_RARITY: Record<CardRarity, number> = {
  N: 5,
  R: 5,
  SR: 3,
  SSR: 1,
};
export function maxSameNameFor(rarity: CardRarity): number {
  return MAX_SAME_NAME_BY_RARITY[rarity];
}

// 合計 per-rarity 上限 (デッキ全体でのレア度別枚数)
// SR 上限を同名上限と整合させて 3 に設定（旧 2 からの変更）
export const MAX_SSR = 1;
export const MAX_SR = 3;

// Legacy: 旧固定値 3。残存する古い参照がある場合の後方互換。
// 新規コードは maxSameNameFor(rarity) を使うこと。
export const MAX_SAME_NAME = 5;

// Back-compat: some call sites still reference DECK_SIZE.
export const DECK_SIZE = INITIAL_DECK_SIZE;

export interface DeckValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalCount: number;
  ssrCount: number;
  srCount: number;
  nameOverflow: string[];
}

// Validate a starter deck: must be exactly INITIAL_DECK_SIZE, respect rarity/name caps.
export function validateDeck(deck: BattleCard[]): DeckValidation {
  const nameCount = new Map<string, number>();
  let ssrCount = 0;
  let srCount = 0;
  for (const c of deck) {
    nameCount.set(c.name, (nameCount.get(c.name) ?? 0) + 1);
    if (c.rarity === 'SSR') ssrCount++;
    if (c.rarity === 'SR') srCount++;
  }
  const nameOverflow: string[] = [];
  const nameRarity = new Map<string, CardRarity>();
  for (const c of deck) nameRarity.set(c.name, c.rarity);
  nameCount.forEach((count, name) => {
    const rarity = nameRarity.get(name)!;
    if (count > maxSameNameFor(rarity)) nameOverflow.push(name);
  });
  const errors: string[] = [];
  const warnings: string[] = [];
  if (deck.length < INITIAL_DECK_SIZE) {
    errors.push(`デッキが${INITIAL_DECK_SIZE}枚未満です（${deck.length}/${INITIAL_DECK_SIZE}枚、あと${INITIAL_DECK_SIZE - deck.length}枚必要）`);
  } else if (deck.length > MAX_DECK_SIZE) {
    errors.push(`デッキが${MAX_DECK_SIZE}枚を超えています（${deck.length}/${MAX_DECK_SIZE}枚）`);
  }
  if (ssrCount > MAX_SSR) errors.push(`SSRは${MAX_SSR}枚までです（現在${ssrCount}枚）`);
  if (srCount > MAX_SR) errors.push(`SRは${MAX_SR}枚までです（現在${srCount}枚）`);
  for (const name of nameOverflow) {
    const rarity = nameRarity.get(name)!;
    errors.push(`「${name}」は${maxSameNameFor(rarity)}枚までです（現在${nameCount.get(name)}枚）`);
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalCount: deck.length,
    ssrCount,
    srCount,
    nameOverflow,
  };
}

// Check if adding a card to a live deck would violate the growth cap.
export function canAddCardToDeck(deck: BattleCard[], card: BattleCard): { ok: boolean; reason?: string } {
  if (deck.length >= MAX_DECK_SIZE) return { ok: false, reason: `デッキは${MAX_DECK_SIZE}枚までです` };
  const sameNameCount = deck.filter(c => c.name === card.name).length;
  const sameNameCap = maxSameNameFor(card.rarity);
  if (sameNameCount >= sameNameCap) return { ok: false, reason: `「${card.name}」は${sameNameCap}枚までです` };
  return { ok: true };
}

// Build a starter deck respecting the 2026-04 balance spec:
//   7 N (5 of atk1/def1 + 2 of atk2/def2-ish "heavier" N) including 1 N 世界遺産 (atk1/def3)
//   2 R (1 atk2/def2 + 1 atk3/def3)
//   1 SR (atk4/def4)
//   0 SSR
// The spec is easier to hit by filtering the pool via stat signature rather
// than trying to satisfy arbitrary rarity caps.
function buildValidDeck(pool: BattleCard[], prefix: string, targetSize: number): BattleCard[] {
  const rng = () => Math.random() - 0.5;
  const shuffled = [...pool].sort(rng);
  const deck: BattleCard[] = [];
  const seenNames = new Map<string, number>();

  const sig = (c: BattleCard) => `${c.attackPower ?? c.power}/${c.defensePower ?? c.power}`;

  const tryAdd = (card: BattleCard): boolean => {
    const nameCount = seenNames.get(card.name) ?? 0;
    if (nameCount >= maxSameNameFor(card.rarity)) return false;
    deck.push({ ...card, id: `${prefix}-${card.id}-${deck.length}` });
    seenNames.set(card.name, nameCount + 1);
    return true;
  };

  // Pick up to `count` cards matching the predicate; stops early if pool dry.
  const drawFrom = (predicate: (c: BattleCard) => boolean, count: number) => {
    let remaining = count;
    for (const c of shuffled) {
      if (remaining <= 0) return;
      if (!predicate(c)) continue;
      if (tryAdd(c)) remaining--;
    }
  };

  // ---------- N cards (7 total) ----------
  // 1 世界遺産 N (atk1/def3) — defensive slot
  drawFrom((c) => c.rarity === 'N' && c.category === 'heritage', 1);
  // 4 N with 1/1 (non-heritage)
  drawFrom(
    (c) => c.rarity === 'N' && c.category !== 'heritage' && sig(c) === '1/1',
    4,
  );
  // 2 N with 2/2 (from 発明/発見) as the "heavier" N
  drawFrom((c) => c.rarity === 'N' && sig(c) === '2/2', 2);
  // Fill any remaining N slots with any N
  drawFrom((c) => c.rarity === 'N', 7 - deck.filter((c) => c.rarity === 'N').length);

  // ---------- R cards (2 total) ----------
  drawFrom((c) => c.rarity === 'R' && sig(c) === '2/2', 1);
  drawFrom((c) => c.rarity === 'R' && sig(c) === '3/3', 1);
  drawFrom((c) => c.rarity === 'R', 2 - deck.filter((c) => c.rarity === 'R').length);

  // ---------- SR (1 total) ----------
  drawFrom((c) => c.rarity === 'SR', 1);

  // ---------- Safety top-up with any N ----------
  drawFrom((c) => c.rarity === 'N', targetSize - deck.length);

  return deck;
}

// Build a 10-card starter deck.
export function createInitialDeck(): BattleCard[] {
  return buildValidDeck(ALL_BATTLE_CARDS, 'player', INITIAL_DECK_SIZE);
}

// AI starter deck: 10 cards (grows alongside the player between rounds).
export function createAIDeck(): BattleCard[] {
  return buildValidDeck(ALL_BATTLE_CARDS, 'ai', INITIAL_DECK_SIZE);
}

// ===== Round-gated rarity availability (変更8) =====
// ラウンドが進むほど高レアが出現する。5ラウンド全体の進行曲線:
//   R1: N / R のみ                (チュートリアル～序盤)
//   R2: N / R / SR(低確率)        (SR 初出現)
//   R3: R / SR                    (N を卒業、中レア中心)
//   R4: R / SR / SSR(低確率)      (SSR 初出現)
//   R5: SR / SSR                  (終盤のピーク)
// 各ラウンドの [rarity, weight] タプル配列。weight は相対値。
export type RarityWeight = [CardRarity, number];

export const ROUND_RARITY_WEIGHTS: Record<number, RarityWeight[]> = {
  1: [['N', 100]],
  2: [['N', 50], ['R', 50]],
  3: [['R', 50], ['SR', 50]],
  4: [['SR', 100]],
  5: [['SR', 50], ['SSR', 50]],
};

/** round に対応するレア度分布を取得。範囲外は R5 相当にクランプ。 */
export function availableRarities(round: number): RarityWeight[] {
  if (round <= 1) return ROUND_RARITY_WEIGHTS[1];
  if (round >= 5) return ROUND_RARITY_WEIGHTS[5];
  return ROUND_RARITY_WEIGHTS[round];
}

/**
 * ガチャでのプレイヤーレベル → 進行フェーズ (1..5) マッピング（変更8）。
 * バトルのラウンド進行をガチャにも適用するためのブリッジ。
 */
export function levelToGachaPhase(level: number): 1 | 2 | 3 | 4 | 5 {
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  if (level <= 6) return 3;
  if (level <= 9) return 4;
  return 5;
}

/** weighted に1つのレア度を抽選 */
function rollRarityByRound(round: number): CardRarity {
  const weights = availableRarities(round);
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [rarity, w] of weights) {
    r -= w;
    if (r <= 0) return rarity;
  }
  return weights[weights.length - 1][0];
}

/**
 * Pick `n` random cards from the pool, returned with freshly-prefixed ids.
 * Used by the deck phase to offer the player 2 cards per round, and for AI growth.
 *
 * round を渡すと、そのラウンドのレア度分布に従って抽選する（変更8）。
 * round を省略するとフラット抽選（後方互換、ガチャ等の用途向け）。
 */
export function sampleCards(n: number, prefix: string, round?: number): BattleCard[] {
  const result: BattleCard[] = [];
  const timestamp = Date.now();

  if (round === undefined) {
    const shuffled = [...ALL_BATTLE_CARDS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n).map((c, i) => ({ ...c, id: `${prefix}-${c.id}-${timestamp}-${i}` }));
  }

  // レア度別にプールを事前分割
  const byRarity: Record<CardRarity, BattleCard[]> = {
    N:   ALL_BATTLE_CARDS.filter((c) => c.rarity === 'N'),
    R:   ALL_BATTLE_CARDS.filter((c) => c.rarity === 'R'),
    SR:  ALL_BATTLE_CARDS.filter((c) => c.rarity === 'SR'),
    SSR: ALL_BATTLE_CARDS.filter((c) => c.rarity === 'SSR'),
  };

  for (let i = 0; i < n; i++) {
    let rarity = rollRarityByRound(round);
    // プールが空ならフォールバック: N→R→SR→SSR の順で存在する最初のものへ
    if (byRarity[rarity].length === 0) {
      const order: CardRarity[] = ['N', 'R', 'SR', 'SSR'];
      const fallback = order.find((r) => byRarity[r].length > 0);
      if (!fallback) break;
      rarity = fallback;
    }
    const pool = byRarity[rarity];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    result.push({ ...pick, id: `${prefix}-${pick.id}-${timestamp}-${i}` });
  }
  return result;
}

// Legacy exports for compatibility
export const ALL_CARDS = [...INITIAL_CARDS, ...ALL_BATTLE_CARDS];
