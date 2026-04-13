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
  einstein:   { id: 'einstein',   name: '天才の頭脳',         description: 'ベンチに「相対性理論の論文」で攻撃+4。「光速」で防御+3。両方あれば相手全攻撃カードパワー-1。', category: 'special' },
  curie:      { id: 'curie',      name: '二度のノーベル賞',   description: 'ベンチに「ラジウム」で攻撃+3。「研究ノート」で防御+3。両方あれば全味方カード効果2回発動。', category: 'special' },
  napoleon:   { id: 'napoleon',   name: '皇帝の号令',         description: 'ベンチに「大砲」で攻撃+4。「ナポレオン法典」で防御+3。両方あれば味方全カード攻撃+1。', category: 'special' },
  cleopatra:  { id: 'cleopatra',  name: '魅了',               description: '公開時、相手のデッキ一番上を隔離する。', category: 'bench' },
  nobunaga:   { id: 'nobunaga',   name: '天下布武',           description: 'ベンチに「鉄砲」で攻撃+3。「楽市楽座」で防御+2。両方あれば相手ベンチ1枚封印。', category: 'special' },
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
  gunpowder:  { id: 'gunpowder',  name: '爆薬の基礎',         description: 'From the bench: ベンチにある間、「ダイナマイト」と「大砲」の攻撃+2。', category: 'special' },
  // Heliocentric: passive bench effect — read by Galileo at reveal.
  heliocentric: { id: 'heliocentric', name: 'コペルニクスの真理', description: 'From the bench: ベンチにある間、「ガリレオ」の攻撃+1/防御+1 (重複可)。', category: 'special' },
  // Dynamite: gains +2 attack per 火薬 on own bench.
  dynamite:   { id: 'dynamite',   name: '大爆発',             description: '公開時、自分ベンチの「火薬」1枚につき攻撃+2。', category: 'atk' },
  compass:    { id: 'compass',    name: '航海術',             description: '公開時、デッキ内の「コロンブス」or「マゼラン」を上3枚以内に移動。', category: 'bench' },
  penicillin: { id: 'penicillin', name: '治療',               description: '公開時、自分ベンチ最強カード1枚をデッキの下へ戻す。', category: 'bench' },
  paper:      { id: 'paper',      name: '記録',               description: '公開時、このマッチの獲得ALT+5。', category: 'special' },
  // ===== コンボ系（2026-04 追加） =====
  edison:          { id: 'edison',          name: '発明王',           description: 'ベンチの電球・蓄音機1枚につき攻撃+1、両方揃えばさらに+3。', category: 'atk' },
  phonograph:      { id: 'phonograph',      name: '音の記録',         description: 'From the bench: エジソンが防御時+2。', category: 'def' },
  darwin:          { id: 'darwin',          name: '自然選択',         description: 'ベンチの生き物1種につき攻防+1。ゾウガメで防御+2、フィンチで攻撃+2。', category: 'special' },
  tortoise:        { id: 'tortoise',        name: '長寿のゾウガメ',   description: 'From the bench: ダーウィンの防御+2。', category: 'def' },
  finch:           { id: 'finch',           name: '進化のくちばし',   description: 'From the bench: ダーウィンの攻撃+2。', category: 'atk' },
  glider:          { id: 'glider',          name: '滑空試験',         description: '公開時、デッキ内のライト兄弟を上から3枚以内に移動。', category: 'bench' },
  wind_tunnel:     { id: 'wind_tunnel',     name: '風洞実験',         description: 'From the bench: ライト兄弟の攻撃+2。さらに公開時、相手デッキ上2枚を隔離。', category: 'atk' },
  wright_bros:     { id: 'wright_bros',     name: '初飛行',           description: 'ベンチにグライダーか風洞があれば攻撃+3。', category: 'atk' },
  plague:          { id: 'plague',          name: 'ペストの脅威',     description: '公開時、相手ベンチ全カードの効果を封印する。', category: 'debuff' },
  serum:           { id: 'serum',           name: '血清療法',         description: 'From the bench: 味方全カードの防御+1。', category: 'def' },
  kitasato:        { id: 'kitasato',        name: '近代医学の父',     description: 'ベンチにペスト菌＋血清がいれば防御+5、封印全解除。', category: 'def' },
  terracotta:      { id: 'terracotta',      name: '不滅の軍勢',       description: 'From the bench: 始皇帝がベンチに送られる時、代わりに隔離する。', category: 'special' },
  qinshi:          { id: 'qinshi',          name: '天下統一',         description: 'ベンチの世界遺産1枚につき攻撃+2、防御+1。', category: 'special' },
  amazon_river:    { id: 'amazon_river',    name: '密林の大河',       description: 'From the bench: 味方の生き物カードの攻撃+1。', category: 'atk' },
  anaconda:        { id: 'anaconda',        name: '締めつけ',         description: '公開時、相手防御-2。ベンチにアマゾン川+毒矢カエル+ピラニアの3枚で大蛇に進化。', category: 'debuff' },
  poison_frog:     { id: 'poison_frog',     name: '猛毒',             description: '公開時、相手デッキ上1枚を隔離。アマゾン川があれば2枚。', category: 'bench' },
  apple:           { id: 'apple',           name: '落ちるリンゴ',     description: '公開時、デッキ内のニュートンをデッキ一番上に移動。', category: 'bench' },
  prism:           { id: 'prism',           name: '光の分解',         description: 'From the bench: ニュートンの攻撃+2、公開時相手防御効果無効。', category: 'atk' },
  gravity:         { id: 'gravity',         name: '万有引力',         description: 'From the bench: ニュートンの防御+2。相手の2枚目以降の攻撃-1。', category: 'def' },
  newton:          { id: 'newton',          name: 'プリンキピア',     description: 'ベンチのリンゴ・プリズム・万有引力の種類数で段階強化。3種類で相手ベンチ効果を無効化。', category: 'special' },
  printing_press:  { id: 'printing_press',  name: '活版印刷',         description: '公開時、デッキ上3枚を並べ替え。聖書もあれば4枚。', category: 'bench' },
  bible:           { id: 'bible',           name: '聖なる書',         description: 'From the bench: 味方全カード防御+1。活版印刷機もあれば+2。', category: 'def' },
  indulgence:      { id: 'indulgence',      name: '免罪符',           description: '公開時、自分ベンチ最強1枚をデッキへ戻す。ベンチにルターがいると無効。', category: 'bench' },
  luther:          { id: 'luther',          name: '95ヶ条の論題',     description: 'ベンチの聖書・活版印刷機で段階強化。両方で強化＋相手ベンチ1枚隔離。', category: 'special' },
  sunflower:       { id: 'sunflower',       name: 'ひまわりの情熱',   description: 'From the bench: ゴッホの攻撃+2。2枚以上で味方全攻+1。', category: 'atk' },
  starry_night:    { id: 'starry_night',    name: '星月夜の光',       description: 'From the bench: ゴッホの防御+2。', category: 'def' },
  cypress:         { id: 'cypress',         name: '天へ伸びる糸杉',   description: 'From the bench: ゴッホが場を離れる時、ベンチではなく隔離へ。', category: 'special' },
  gogh:            { id: 'gogh',            name: '炎の画家',         description: 'ベンチのひまわり・星月夜・糸杉の種類数で段階強化。3種で相手ベンチ効果無効。', category: 'special' },
  holy_sword:      { id: 'holy_sword',      name: '聖剣',             description: 'From the bench: ジャンヌ・ダルクの攻撃+3。', category: 'atk' },
  banner:          { id: 'banner',          name: '軍旗',             description: 'From the bench: ジャンヌ・ダルクの防御+3。味方全攻撃+1。', category: 'def' },
  jeanne:          { id: 'jeanne',          name: 'オルレアンの乙女', description: 'ベンチの聖剣・軍旗で段階強化。両方で相手ベンチ1枚を封印。', category: 'special' },
  versailles:      { id: 'versailles',      name: '豪奢なる宮殿',     description: 'From the bench: マリー・アントワネットの防御+4。', category: 'def' },
  cake:            { id: 'cake',            name: '王妃のお菓子',     description: 'From the bench: マリーの攻撃+3。マリーが場を離れる時、相手デッキ上2枚を隔離。', category: 'atk' },
  marie:           { id: 'marie',           name: '最後の女王',       description: 'ベルサイユで防御+4、ケーキで攻撃+3、両方＋デッキ少ないでさらに攻防+2。', category: 'special' },
  // ===== コンボ系（2026-04 追加 第2弾） =====
  columbus:        { id: 'columbus',        name: '新大陸発見',       description: 'ベンチに「羅針盤」で攻撃+3。相手デッキ上3枚確認し1枚隔離。', category: 'atk' },
  magellan:        { id: 'magellan',        name: '世界一周',         description: 'ベンチに「羅針盤」で防御+4。ベンチ全カード効果2倍(このラウンド)。', category: 'def' },
  caravel:         { id: 'caravel',         name: '大航海の翼',       description: 'From the bench: コロンブスとマゼランの攻防+1。', category: 'special' },
  spice:           { id: 'spice',           name: '香辛料貿易',       description: 'From the bench: 毎ラウンド終了時ALT+5。羅針盤もあればALT+10。', category: 'special' },
  gun:             { id: 'gun',             name: '三段撃ち',         description: 'From the bench: 信長の攻撃+3。攻撃時相手防御-2。', category: 'atk' },
  rakuichi:        { id: 'rakuichi',        name: '自由商業',         description: 'From the bench: 信長の防御+2。', category: 'def' },
  hideyoshi:       { id: 'hideyoshi',       name: '天下統一',         description: 'ベンチに「織田信長」で攻防+3。「千利休」で防御+2。', category: 'special' },
  rikyu:           { id: 'rikyu',           name: '侘び茶の極意',     description: 'From the bench: 味方全カード防御+1。デッキ残り3枚以下で攻防+3。', category: 'def' },
  relativity:      { id: 'relativity',      name: '時空の歪み',       description: 'From the bench: アインシュタインの攻撃+4。', category: 'atk' },
  lightspeed:      { id: 'lightspeed',      name: '光の壁',           description: 'From the bench: アインシュタインの防御+3。', category: 'def' },
  emc2:            { id: 'emc2',            name: '質量エネルギー',   description: '公開時、ベンチにアインシュタインがいれば攻撃2倍。', category: 'atk' },
  radium:          { id: 'radium',          name: '放射能の力',       description: 'From the bench: キュリー夫人の攻撃+3。', category: 'atk' },
  research_notes:  { id: 'research_notes',  name: '献身の記録',       description: 'From the bench: キュリー夫人の防御+3。', category: 'def' },
  nobel_medal:     { id: 'nobel_medal',     name: '栄光の証',         description: 'From the bench: キュリー夫人/アインシュタイン/ダーウィンの攻防+2。', category: 'special' },
  cannon:          { id: 'cannon',          name: '砲撃',             description: 'From the bench: ナポレオンの攻撃+4。公開時、ベンチに火薬があれば攻撃2倍。', category: 'atk' },
  napoleon_code:   { id: 'napoleon_code',   name: '法の支配',         description: 'From the bench: ナポレオンの防御+3。', category: 'def' },
  waterloo:        { id: 'waterloo',        name: '最後の戦い',       description: 'From the bench: デッキ残り3枚以下でナポレオン攻防+5。', category: 'special' },
  // ===== 宝石カード + アフリカデッキ =====
  diamond:          { id: 'diamond',          name: '不滅の輝き',       description: 'From the bench: 味方全カード防御+1。隔離・封印対象にならない。', category: 'def' },
  ruby:             { id: 'ruby',             name: '情熱の炎',         description: 'From the bench: 攻撃側味方全攻撃+1。2枚以上で+2。', category: 'atk' },
  sapphire:         { id: 'sapphire',         name: '叡智の守り',       description: 'From the bench: 防御側味方全防御+1。2枚以上で+2。', category: 'def' },
  emerald:          { id: 'emerald',          name: '再生の力',         description: '公開時、ベンチ1枚をデッキ下へ戻し、デッキ上カード攻防+1。', category: 'bench' },
  amethyst:         { id: 'amethyst',         name: '精神の盾',         description: 'From the bench: 相手の弱体化を1回無効化後、自身は隔離。', category: 'special' },
  mandela:          { id: 'mandela',          name: '不屈の精神',       description: 'ベンチに「アパルトヘイト」で防御+4。4種以上で攻撃+3。封印全解除。', category: 'special' },
  apartheid:        { id: 'apartheid',        name: '差別との闘い',     description: 'From the bench: マンデラの防御+4。', category: 'def' },
  african_elephant: { id: 'african_elephant', name: '突進',             description: '攻撃時+2。サバンナベンチでさらに+2。', category: 'atk' },
  savanna:          { id: 'savanna',          name: '広大な大地',       description: 'From the bench: 生き物カード攻防+1。アマゾン川もあれば攻撃さらに+1。', category: 'special' },
  // ===== 産業革命デッキ =====
  steam_engine:     { id: 'steam_engine',     name: '動力革命',         description: 'From the bench: 全科学発明カード攻撃+1。石炭もあれば+2。', category: 'atk' },
  coal:             { id: 'coal',             name: '黒いダイヤ',       description: 'From the bench: 蒸気機関の攻防+2。2枚以上で全科学発明防御+1。', category: 'special' },
  spinning_machine: { id: 'spinning_machine', name: '繊維革命',         description: 'From the bench: 毎ラウンド終了時ALT+5。蒸気機関もあればALT+10。', category: 'special' },
  steam_locomotive: { id: 'steam_locomotive', name: '鉄道の時代',       description: '蒸気機関+石炭ベンチで攻撃+4/防御+2。隔離2枚回収。', category: 'atk' },
  watt:             { id: 'watt',             name: '改良の天才',       description: 'ベンチ科学発明の枚数で段階強化。4枚以上で攻+5/防+3/味方全攻+1。', category: 'special' },
  wheel:            { id: 'wheel',            name: '回転の力',         description: 'From the bench: 蒸気機関車の攻撃+2/防御+2（重複可）。蒸気機関車攻撃成功時、相手デッキ上1枚追加隔離。', category: 'special' },
  // ===== ステージモード用追加カード =====
  lion:             { id: 'lion',             name: '百獣の王',         description: '攻撃時、自分ベンチの生き物カード1枚につき攻撃+1。', category: 'atk' },
  book_burning:     { id: 'book_burning',     name: '思想統制',         description: '公開時、相手デッキ上3枚を隔離。ベンチに始皇帝がいればさらに+2枚（計5枚）。', category: 'debuff' },
  elixir:           { id: 'elixir',           name: '永遠の命',         description: 'From the bench: 始皇帝がベンチに送られる時、代わりにデッキの一番下に戻す。', category: 'special' },
  giant_snake:      { id: 'giant_snake',      name: '呑み込む者',       description: 'ベンチにある攻撃力2のカード1枚につき攻撃+1/防御+1。', category: 'special' },
  photosynthesis:   { id: 'photosynthesis',   name: '密林の再生',       description: '公開時、ベンチのアマゾン種族（ピラニア・アナコンダ・毒矢カエル・大蛇）を1枚デッキの一番上に戻す。', category: 'bench' },
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
  // ===== コンボ系 =====
  'エジソン':           'edison',
  '蓄音機':             'phonograph',
  'ダーウィン':         'darwin',
  'ゾウガメ':           'tortoise',
  'ダーウィンフィンチ': 'finch',
  'グライダー':         'glider',
  '風洞':               'wind_tunnel',
  'ライト兄弟':         'wright_bros',
  'ペスト菌':           'plague',
  '血清':               'serum',
  '北里柴三郎':         'kitasato',
  '兵馬俑':             'terracotta',
  '始皇帝':             'qinshi',
  'アマゾン川':         'amazon_river',
  'アナコンダ':         'anaconda',
  '毒矢カエル':         'poison_frog',
  'リンゴ':             'apple',
  'プリズム':           'prism',
  '万有引力':           'gravity',
  'ニュートン':         'newton',
  '活版印刷機':         'printing_press',
  '聖書':               'bible',
  '免罪符':             'indulgence',
  'ルター':             'luther',
  'ひまわり':           'sunflower',
  '星月夜':             'starry_night',
  '糸杉':               'cypress',
  'ゴッホ':             'gogh',
  '聖剣':               'holy_sword',
  '軍旗':               'banner',
  'ジャンヌ・ダルク':   'jeanne',
  'ヴェルサイユ宮殿':   'versailles',
  'ケーキ':             'cake',
  'マリー・アントワネット': 'marie',
  // ===== コンボ系 第2弾 =====
  'コロンブス':           'columbus',
  'マゼラン':             'magellan',
  'キャラベル船':         'caravel',
  '香辛料':               'spice',
  '鉄砲':                 'gun',
  '楽市楽座':             'rakuichi',
  '豊臣秀吉':             'hideyoshi',
  '千利休':               'rikyu',
  '相対性理論の論文':     'relativity',
  '光速':                 'lightspeed',
  'E=mc²':                'emc2',
  'ラジウム':             'radium',
  '研究ノート':           'research_notes',
  'ノーベル賞メダル':     'nobel_medal',
  '大砲':                 'cannon',
  'ナポレオン法典':       'napoleon_code',
  'ワーテルローの戦い':   'waterloo',
  // ===== 宝石カード + アフリカデッキ =====
  'ダイヤモンド':         'diamond',
  'ルビー':               'ruby',
  'サファイア':           'sapphire',
  'エメラルド':           'emerald',
  'アメジスト':           'amethyst',
  'ネルソン・マンデラ':   'mandela',
  'アパルトヘイト':       'apartheid',
  'アフリカゾウ':         'african_elephant',
  'サバンナ':             'savanna',
  // ===== 産業革命デッキ =====
  '蒸気機関':             'steam_engine',
  '石炭':                 'coal',
  '紡績機':               'spinning_machine',
  '蒸気機関車':           'steam_locomotive',
  'ジェームズ・ワット':   'watt',
  '車輪':                 'wheel',
  // ===== ステージモード用追加カード =====
  'ライオン':             'lion',
  '焚書坑儒':             'book_burning',
  '不老不死の薬':         'elixir',
  '大蛇':                 'giant_snake',
  '光合成':               'photosynthesis',
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
  // ===== コンボ系 (2026-04) =====
  '蓄音機':           { attackPower: 1, defensePower: 1 },
  'ゾウガメ':         { attackPower: 1, defensePower: 1 },
  'グライダー':       { attackPower: 1, defensePower: 1 },
  '風洞':             { attackPower: 1, defensePower: 1 },
  'ペスト菌':         { attackPower: 1, defensePower: 1 },
  '血清':             { attackPower: 1, defensePower: 1 },
  '始皇帝':           { attackPower: 4, defensePower: 4 },
  'アマゾン川':       { attackPower: 1, defensePower: 4 },
  'アナコンダ':       { attackPower: 2, defensePower: 2 },
  '毒矢カエル':       { attackPower: 1, defensePower: 1 },
  'リンゴ':           { attackPower: 1, defensePower: 1 },
  'プリズム':         { attackPower: 1, defensePower: 1 },
  '活版印刷機':       { attackPower: 1, defensePower: 1 },
  '聖書':             { attackPower: 1, defensePower: 2 },
  '免罪符':           { attackPower: 1, defensePower: 1 },
  'ひまわり':         { attackPower: 1, defensePower: 1 },
  '星月夜':           { attackPower: 1, defensePower: 2 },
  '糸杉':             { attackPower: 1, defensePower: 1 },
  '聖剣':             { attackPower: 2, defensePower: 1 },
  '軍旗':             { attackPower: 1, defensePower: 2 },
  'ケーキ':           { attackPower: 1, defensePower: 1 },
  '兵馬俑':           { attackPower: 1, defensePower: 4 },
  // ===== コンボ系 第2弾 =====
  'コロンブス':       { attackPower: 3, defensePower: 2 },
  'マゼラン':         { attackPower: 2, defensePower: 3 },
  'キャラベル船':     { attackPower: 1, defensePower: 2 },
  '香辛料':           { attackPower: 1, defensePower: 1 },
  '鉄砲':             { attackPower: 2, defensePower: 1 },
  '楽市楽座':         { attackPower: 1, defensePower: 1 },
  '千利休':           { attackPower: 1, defensePower: 3 },
  '相対性理論の論文': { attackPower: 1, defensePower: 1 },
  '光速':             { attackPower: 1, defensePower: 2 },
  'E=mc²':            { attackPower: 2, defensePower: 1 },
  'ラジウム':         { attackPower: 1, defensePower: 1 },
  '研究ノート':       { attackPower: 1, defensePower: 2 },
  'ノーベル賞メダル': { attackPower: 1, defensePower: 1 },
  '大砲':             { attackPower: 2, defensePower: 1 },
  'ナポレオン法典':   { attackPower: 1, defensePower: 2 },
  'ワーテルローの戦い': { attackPower: 1, defensePower: 1 },
  // ===== ヒーロー ステータス更新 =====
  'アインシュタイン': { attackPower: 4, defensePower: 3 },
  'キュリー夫人':     { attackPower: 4, defensePower: 3 },
  'ナポレオン':       { attackPower: 3, defensePower: 2 },
  '織田信長':         { attackPower: 3, defensePower: 2 },
  '豊臣秀吉':        { attackPower: 2, defensePower: 3 },
  // ===== 宝石カード + アフリカデッキ =====
  'ダイヤモンド':         { attackPower: 3, defensePower: 3 },
  'ルビー':               { attackPower: 2, defensePower: 1 },
  'サファイア':           { attackPower: 1, defensePower: 2 },
  'エメラルド':           { attackPower: 1, defensePower: 1 },
  'アメジスト':           { attackPower: 1, defensePower: 1 },
  'ネルソン・マンデラ':   { attackPower: 2, defensePower: 4 },
  'アパルトヘイト':       { attackPower: 1, defensePower: 1 },
  'アフリカゾウ':         { attackPower: 4, defensePower: 3 },
  'サバンナ':             { attackPower: 1, defensePower: 1 },
  // ===== 産業革命デッキ =====
  '蒸気機関':             { attackPower: 1, defensePower: 2 },
  '石炭':                 { attackPower: 1, defensePower: 1 },
  '紡績機':               { attackPower: 1, defensePower: 1 },
  '蒸気機関車':           { attackPower: 3, defensePower: 3 },
  'ジェームズ・ワット':   { attackPower: 3, defensePower: 2 },
  // ===== ステージモード用追加カード =====
  'ライオン':             { attackPower: 3, defensePower: 2 },
  'ハチドリ':             { attackPower: 1, defensePower: 1 },
  'モアイ像':             { attackPower: 1, defensePower: 2 },
  '焚書坑儒':             { attackPower: 1, defensePower: 1 },
  '不老不死の薬':         { attackPower: 1, defensePower: 1 },
  '大蛇':                 { attackPower: 5, defensePower: 4 },
  '光合成':               { attackPower: 1, defensePower: 1 },
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
    { question: '蒸気機関を改良して産業革命の原動力にした人物は？', choices: ['ワット', 'ニューコメン', 'スティーブンソン', 'フルトン'], correctIndex: 0 },
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
    { question: '豊臣秀吉の出世前の名前は？', choices: ['木下藤吉郎', '松平元康', '毛利元就', '上杉謙信'], correctIndex: 0 },
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
  // ===== 追加コンボカード =====
  'card-106': [
    { question: '蓄音機を発明したのは？', choices: ['ベル', 'エジソン', 'テスラ', 'マルコーニ'], correctIndex: 1 },
    { question: '蓄音機が世界で初めて録音した言葉は？', choices: ['メリーさんの羊', 'こんにちは', 'ワトソン君', 'テスト'], correctIndex: 0 },
    { question: '蓄音機は何を記録する装置？', choices: ['映像', '音', '文字', '光'], correctIndex: 1 },
  ],
  'card-107': [
    { question: 'ゾウガメが住む有名な諸島は？', choices: ['ハワイ諸島', 'ガラパゴス諸島', 'カナリア諸島', 'マルタ島'], correctIndex: 1 },
    { question: 'ゾウガメの寿命はどのくらい？', choices: ['20年', '50年', '100年以上', '500年'], correctIndex: 2 },
    { question: 'ゾウガメの食性は？', choices: ['肉食', '草食', '雑食', '虫食'], correctIndex: 1 },
  ],
  'card-108': [
    { question: 'ダーウィンが唱えた理論は？', choices: ['万有引力', '相対性理論', '進化論', '量子力学'], correctIndex: 2 },
    { question: 'ダーウィンが乗った観測船は？', choices: ['ノーチラス号', 'ビーグル号', 'カティサーク号', 'タイタニック号'], correctIndex: 1 },
    { question: 'ダーウィンの代表的な著作は？', choices: ['種の起源', 'プリンキピア', '天体の回転について', '自然哲学'], correctIndex: 0 },
  ],
  'card-109': [
    { question: 'グライダーには何がない？', choices: ['翼', '動力エンジン', '尾翼', '操縦桿'], correctIndex: 1 },
    { question: 'ライト兄弟がグライダーで研究したのは？', choices: ['飛行の原理', '船の航海', '車の走行', '地図作成'], correctIndex: 0 },
    { question: 'グライダーは何の力で飛ぶ？', choices: ['ジェットエンジン', '上昇気流', '電気', '蒸気'], correctIndex: 1 },
  ],
  'card-110': [
    { question: '風洞とは何を調べる装置？', choices: ['水の流れ', '空気の流れ', '磁場', '電気'], correctIndex: 1 },
    { question: '風洞を最初に作った人物は？', choices: ['エジソン', 'ライト兄弟', 'ベル', 'テスラ'], correctIndex: 1 },
    { question: '風洞は何を研究するのに役立つ？', choices: ['翼の形', '歯車', '船体', '建物'], correctIndex: 0 },
  ],
  'card-111': [
    { question: 'ライト兄弟が初飛行に成功した年は？', choices: ['1893年', '1903年', '1913年', '1923年'], correctIndex: 1 },
    { question: '初飛行が行われた場所は？', choices: ['パリ', 'ロンドン', 'キティホーク', '東京'], correctIndex: 2 },
    { question: 'ライト兄弟は何兄弟？', choices: ['2人', '3人', '4人', '5人'], correctIndex: 0 },
  ],
  'card-112': [
    { question: 'ペスト菌を発見したのは？', choices: ['北里柴三郎とイェルサン', 'フレミング', 'パスツール', 'コッホ'], correctIndex: 0 },
    { question: 'ペストはかつて何と呼ばれた？', choices: ['黒死病', '白い病', '赤い疫病', '青い呪い'], correctIndex: 0 },
    { question: 'ペストを媒介する動物は？', choices: ['ハエ', 'ネズミとノミ', '蛊', 'ダニ'], correctIndex: 1 },
  ],
  'card-113': [
    { question: '血清療法を確立した日本人科学者は？', choices: ['野口英世', '北里柴三郎', '志賀潔', '山中伸弥'], correctIndex: 1 },
    { question: '血清には何が含まれている？', choices: ['抗体', 'ウイルス', '細菌', '酸素'], correctIndex: 0 },
    { question: '血清療法はどんな病気の治療に使われた？', choices: ['風邪', '破傷風', '骨折', '頭痛'], correctIndex: 1 },
  ],
  'card-114': [
    { question: '始皇帝が統一した国は？', choices: ['日本', '中国', 'モンゴル', 'ローマ'], correctIndex: 1 },
    { question: '始皇帝の陵墓の近くにある世界遺産は？', choices: ['兵馬俑', 'ピラミッド', 'タージ・マハル', 'コロッセオ'], correctIndex: 0 },
    { question: '始皇帝が治めた王朝は？', choices: ['漢', '秦', '唐', '宋'], correctIndex: 1 },
  ],
  'card-115': [
    { question: 'アマゾン川が流れる大陸は？', choices: ['北米', '南米', 'アフリカ', 'アジア'], correctIndex: 1 },
    { question: 'アマゾン川は世界で何番目に長い？', choices: ['1番', '2番', '3番', '5番'], correctIndex: 1 },
    { question: 'アマゾン川の周りに広がる森は？', choices: ['サバンナ', '熱帯雨林', 'タイガ', '砂漠'], correctIndex: 1 },
  ],
  'card-116': [
    { question: 'アナコンダはどこに住む？', choices: ['アフリカ', '南米', 'オーストラリア', 'アジア'], correctIndex: 1 },
    { question: 'アナコンダの狩りの方法は？', choices: ['毒', '締めつけ', '走って追いかける', '飛びかかる'], correctIndex: 1 },
    { question: 'アナコンダは何の仲間？', choices: ['トカゲ', 'ヘビ', 'ワニ', 'カメ'], correctIndex: 1 },
  ],
  'card-117': [
    { question: '毒矢カエルの毒はどう使われた？', choices: ['薬', '矢の毒', '染料', '食用'], correctIndex: 1 },
    { question: '毒矢カエルの特徴は？', choices: ['地味な色', '鮮やかな色', '透明', '大きい'], correctIndex: 1 },
    { question: '毒矢カエルの住む場所は？', choices: ['北極', 'アマゾン', '砂漠', '深海'], correctIndex: 1 },
  ],
  'card-118': [
    { question: 'リンゴが落ちるのを見て万有引力を発見したのは？', choices: ['ガリレオ', 'ニュートン', 'ケプラー', 'アインシュタイン'], correctIndex: 1 },
    { question: 'リンゴは何の仲間？', choices: ['バラ科', 'ミカン科', 'ブドウ科', 'モモ科'], correctIndex: 0 },
    { question: 'リンゴが赤くなる理由は？', choices: ['日光', '気温', 'アントシアニン', 'すべて'], correctIndex: 3 },
  ],
  'card-119': [
    { question: 'プリズムで光を分けると何色になる？', choices: ['5色', '7色', '3色', '10色'], correctIndex: 1 },
    { question: 'プリズムで光を分解した科学者は？', choices: ['ガリレオ', 'ニュートン', 'テスラ', 'アインシュタイン'], correctIndex: 1 },
    { question: 'プリズムの形は？', choices: ['球', '三角柱', '円盤', '立方体'], correctIndex: 1 },
  ],
  'card-120': [
    { question: '活版印刷機を発明したのは？', choices: ['エジソン', 'グーテンベルク', 'ガリレオ', 'ニュートン'], correctIndex: 1 },
    { question: '活版印刷機が最初に印刷した本は？', choices: ['聖書', 'コーラン', '論語', 'イリアス'], correctIndex: 0 },
    { question: '活版印刷が社会に与えた影響は？', choices: ['知識の普及', '産業革命', '宇宙開発', '医学の進歩'], correctIndex: 0 },
  ],
  'card-121': [
    { question: '聖書はどの宗教の聖典？', choices: ['イスラム教', 'キリスト教', '仏教', 'ヒンドゥー教'], correctIndex: 1 },
    { question: '聖書は大きく何と何に分かれる？', choices: ['旧約と新約', '前編と後編', '内編と外編', '東と西'], correctIndex: 0 },
    { question: '聖書を民衆に広めたのは？', choices: ['活版印刷機', 'インターネット', 'テレビ', '新聞'], correctIndex: 0 },
  ],
  'card-122': [
    { question: '免罪符を激しく批判したのは？', choices: ['ルター', 'カルヴァン', 'ガリレオ', 'ダーウィン'], correctIndex: 0 },
    { question: '免罪符は何を赦すと売られた？', choices: ['罪', '税', '借金', '罰金'], correctIndex: 0 },
    { question: '免罪符批判から始まった運動は？', choices: ['産業革命', '宗教改革', '啓蒙思想', '大航海時代'], correctIndex: 1 },
  ],
  'card-123': [
    { question: 'ルターが掲げた有名な文書は？', choices: ['95ヶ条の論題', 'マグナ・カルタ', '権利章典', '独立宣言'], correctIndex: 0 },
    { question: 'ルターが始めた運動は？', choices: ['宗教改革', '啓蒙運動', '産業革命', 'ルネサンス'], correctIndex: 0 },
    { question: 'ルターの出身国は？', choices: ['フランス', 'イタリア', 'ドイツ', 'スペイン'], correctIndex: 2 },
  ],
  'card-124': [
    { question: 'ひまわりを描いた画家は？', choices: ['モネ', 'ゴッホ', 'ピカソ', 'ダ・ヴィンチ'], correctIndex: 1 },
    { question: 'ゴッホのひまわりは何色が主？', choices: ['青', '黄色', '赤', '緑'], correctIndex: 1 },
    { question: 'ゴッホが晩年を過ごした国は？', choices: ['オランダ', 'フランス', 'ベルギー', 'スペイン'], correctIndex: 1 },
  ],
  'card-125': [
    { question: '星月夜を描いた画家は？', choices: ['ゴッホ', 'モネ', 'セザンヌ', 'ルノワール'], correctIndex: 0 },
    { question: '星月夜に描かれているのは？', choices: ['渦巻く夜空', '昼の街', '海', '森'], correctIndex: 0 },
    { question: 'ゴッホが星月夜を描いた時の場所は？', choices: ['自宅', '精神病院', '山', '海辺'], correctIndex: 1 },
  ],
  'card-126': [
    { question: '糸杉はどんな樹木？', choices: ['横に広がる', '天に向かって伸びる', '地を這う', '水の上に育つ'], correctIndex: 1 },
    { question: 'ゴッホの糸杉の筆致の特徴は？', choices: ['直線的', '炎のようにうねる', '点描', '平坦'], correctIndex: 1 },
    { question: '糸杉はどこの木として有名？', choices: ['地中海', '熱帯', '極地', '砂漠'], correctIndex: 0 },
  ],
  'card-127': [
    { question: 'ジャンヌ・ダルクの聖剣の伝説的な由来は？', choices: ['神の啓示', '国王から贈られた', '父の形見', '戦利品'], correctIndex: 0 },
    { question: 'ジャンヌ・ダルクが戦ったのは何戦争？', choices: ['百年戦争', '三十年戦争', '第一次世界大戦', '十字軍'], correctIndex: 0 },
    { question: 'ジャンヌ・ダルクの出身国は？', choices: ['フランス', 'イギリス', 'スペイン', 'ドイツ'], correctIndex: 0 },
  ],
  'card-128': [
    { question: '軍旗の役割は？', choices: ['装飾', '兵士の士気を高める', '道しるべ', '食料保存'], correctIndex: 1 },
    { question: 'ジャンヌ・ダルクが掲げた旗の色は？', choices: ['赤', '黒', '白', '青'], correctIndex: 2 },
    { question: '軍旗は戦場で何を示す？', choices: ['位置と所属', '時間', '天気', '食事'], correctIndex: 0 },
  ],
  'card-129': [
    { question: '「パンがなければお菓子を食べればいい」と言ったとされる王妃は？', choices: ['クレオパトラ', 'マリー・アントワネット', '卑弥呼', 'エリザベス1世'], correctIndex: 1 },
    { question: 'マリー・アントワネットの国は？', choices: ['イギリス', 'フランス', 'ドイツ', 'スペイン'], correctIndex: 1 },
    { question: 'ケーキの発祥地として有名な国は？', choices: ['日本', 'フランス', 'アメリカ', 'インド'], correctIndex: 1 },
  ],
  // ===== コンボカード: ナポレオン =====
  'card-130': [
    { question: 'ナポレオンが最初に頭角を現した戦いの武器は？', choices: ['大砲', '剣', '銃', '槍'], correctIndex: 0 },
    { question: 'ナポレオンは元々何の兵科の出身？', choices: ['歩兵', '騎兵', '砲兵', '海軍'], correctIndex: 2 },
    { question: '大砲の弾を飛ばす力は？', choices: ['バネ', '火薬の爆発', '蒸気', '電気'], correctIndex: 1 },
  ],
  'card-131': [
    { question: 'ナポレオン法典が後の世界に与えた影響は？', choices: ['近代法の基礎', '軍事戦略', '経済理論', '宗教改革'], correctIndex: 0 },
    { question: 'ナポレオン法典が制定された年は？', choices: ['1789年', '1804年', '1815年', '1848年'], correctIndex: 1 },
    { question: 'ナポレオン法典が影響を与えた国は？', choices: ['日本だけ', 'フランスだけ', '世界中の多くの国', 'イギリスだけ'], correctIndex: 2 },
  ],
  'card-132': [
    { question: 'ナポレオンが最後に敗れた戦いは？', choices: ['ワーテルロー', 'トラファルガー', 'アウステルリッツ', 'ライプツィヒ'], correctIndex: 0 },
    { question: 'ワーテルローの戦いでナポレオンを破ったのは？', choices: ['ネルソン', 'ウェリントン', 'ビスマルク', 'チャーチル'], correctIndex: 1 },
    { question: 'ワーテルローはどの国にある？', choices: ['フランス', 'ドイツ', 'ベルギー', 'オランダ'], correctIndex: 2 },
  ],
  // ===== コンボカード: アインシュタイン =====
  'card-133': [
    { question: 'E=mc²のEは何を表す？', choices: ['エネルギー', '電気', '弾性', '効率'], correctIndex: 0 },
    { question: 'E=mc²の「m」は何を表す？', choices: ['速度', '質量', '磁力', 'モル'], correctIndex: 1 },
    { question: 'E=mc²はどの理論に関係する？', choices: ['進化論', '相対性理論', '量子力学', '万有引力'], correctIndex: 1 },
  ],
  'card-134': [
    { question: '相対性理論を発表した年は？', choices: ['1905年', '1900年', '1915年', '1920年'], correctIndex: 0 },
    { question: '相対性理論は何の関係を説明する？', choices: ['力と運動', '時間と空間', '生物と環境', '音と光'], correctIndex: 1 },
    { question: '一般相対性理論が予言したのは？', choices: ['進化', 'ブラックホール', '地震', '台風'], correctIndex: 1 },
  ],
  'card-135': [
    { question: '光の速さは秒速約何km？', choices: ['30万km', '3万km', '300万km', '3000km'], correctIndex: 0 },
    { question: '光が地球から月まで届く時間は約？', choices: ['1秒', '1.3秒', '10秒', '1分'], correctIndex: 1 },
    { question: '光より速いものは存在する？', choices: ['音', '電波', '何もない', 'ロケット'], correctIndex: 2 },
  ],
  // ===== コンボカード: キュリー夫人 =====
  'card-136': [
    { question: 'キュリー夫人が発見した元素は？', choices: ['ラジウム', 'ウラン', 'プルトニウム', 'セシウム'], correctIndex: 0 },
    { question: 'ラジウムの特徴は？', choices: ['磁力を持つ', '暗闇で光る', '水に沈む', '非常に軽い'], correctIndex: 1 },
    { question: 'ラジウムは何という性質を持つ元素？', choices: ['放射性', '伝導性', '弾力性', '透明性'], correctIndex: 0 },
  ],
  'card-137': [
    { question: 'キュリー夫人の研究ノートが今も放射線を帯びている理由は？', choices: ['ラジウムに触れていたから', '古いから', '特殊な紙だから', 'インクのため'], correctIndex: 0 },
    { question: 'キュリー夫人の研究ノートはどこに保管されている？', choices: ['鉛の箱', 'ガラスケース', '金庫', '図書館'], correctIndex: 0 },
    { question: 'キュリー夫人が研究していた分野は？', choices: ['天文学', '放射線', '生物学', '地質学'], correctIndex: 1 },
  ],
  'card-138': [
    { question: 'ノーベル賞を2回受賞した最初の人物は？', choices: ['キュリー夫人', 'アインシュタイン', 'ポーリング', 'バーディーン'], correctIndex: 0 },
    { question: 'キュリー夫人がノーベル賞を受賞した回数は？', choices: ['1回', '2回', '3回', '4回'], correctIndex: 1 },
    { question: 'ノーベル賞メダルは何で作られている？', choices: ['銀', '金', 'プラチナ', '銅'], correctIndex: 1 },
  ],
  // ===== コンボカード: 織田信長 =====
  'card-139': [
    { question: '鉄砲が日本に伝来した島は？', choices: ['種子島', '淡路島', '対馬', '佐渡島'], correctIndex: 0 },
    { question: '鉄砲が伝来した場所は？', choices: ['長崎', '種子島', '堺', '京都'], correctIndex: 1 },
    { question: '信長が大量の鉄砲を使った有名な戦いは？', choices: ['桶狭間の戦い', '長篠の戦い', '関ヶ原の戦い', '大坂の陣'], correctIndex: 1 },
  ],
  'card-140': [
    { question: '楽市楽座を推進した武将は？', choices: ['織田信長', '豊臣秀吉', '徳川家康', '武田信玄'], correctIndex: 0 },
    { question: '楽市楽座で廃止されたのは？', choices: ['武士の特権', '座の特権', '寺の特権', '天皇の特権'], correctIndex: 1 },
    { question: '楽市楽座を推進した武将は？', choices: ['豊臣秀吉', '徳川家康', '織田信長', '武田信玄'], correctIndex: 2 },
  ],
  'card-141': [
    { question: '千利休が大成した文化は？', choices: ['茶道', '華道', '書道', '剣道'], correctIndex: 0 },
    { question: '千利休が仕えた武将は？', choices: ['信長と秀吉', '家康と秀忠', '信玄と謙信', '義経と頼朝'], correctIndex: 0 },
    { question: '千利休の茶の流派は？', choices: ['表千家', '裏千家', 'わび茶', '抹茶道'], correctIndex: 2 },
  ],
  // ===== コンボカード: 大航海時代 =====
  'card-142': [
    { question: 'コロンブスが到達した大陸は？', choices: ['アメリカ', 'アフリカ', 'オーストラリア', 'アジア'], correctIndex: 0 },
    { question: 'コロンブスの航海を支援した国は？', choices: ['ポルトガル', 'スペイン', 'イタリア', 'フランス'], correctIndex: 1 },
    { question: 'コロンブスがアメリカに到達した年は？', choices: ['1453年', '1492年', '1519年', '1543年'], correctIndex: 1 },
  ],
  'card-143': [
    { question: 'マゼランの船団が達成したことは？', choices: ['世界一周', '北極到達', '新大陸発見', 'インド航路開拓'], correctIndex: 0 },
    { question: 'マゼランの出身国は？', choices: ['スペイン', 'ポルトガル', 'イタリア', 'フランス'], correctIndex: 1 },
    { question: 'マゼランが命名した海峡は？', choices: ['ジブラルタル海峡', 'マゼラン海峡', 'マラッカ海峡', 'ドーバー海峡'], correctIndex: 1 },
  ],
  'card-144': [
    { question: '大航海時代に使われた帆船の名前は？', choices: ['キャラベル', 'ガレオン', '戦艦', '空母'], correctIndex: 0 },
    { question: 'キャラベル船の特徴は？', choices: ['蒸気で動く', '小型で外洋航海に優れる', '巨大な戦艦', '潜水できる'], correctIndex: 1 },
    { question: 'キャラベル船を多く使った国は？', choices: ['日本', 'ポルトガル・スペイン', 'イギリス', 'ロシア'], correctIndex: 1 },
  ],
  'card-145': [
    { question: '大航海時代にヨーロッパが求めた最も重要な交易品は？', choices: ['香辛料', '金', '絹', '茶'], correctIndex: 0 },
    { question: '香辛料の産地として有名な地域は？', choices: ['北欧', '東南アジア・インド', '北米', '南極'], correctIndex: 1 },
    { question: '香辛料が高価だった理由は？', choices: ['味が悪い', '遠い産地から運ぶ必要があった', '作るのが簡単だった', '誰でも手に入った'], correctIndex: 1 },
  ],
  // ===== 宝石カード =====
  'card-146': [
    { question: 'ダイヤモンドの硬さは鉱物硬度計で何度？', choices: ['10', '8', '7', '5'], correctIndex: 0 },
    { question: 'ダイヤモンドの主成分は？', choices: ['炭素', '鉄', '金', 'ケイ素'], correctIndex: 0 },
    { question: 'ダイヤモンドが最も多く産出される大陸は？', choices: ['アフリカ', 'アジア', 'ヨーロッパ', '南アメリカ'], correctIndex: 0 },
  ],
  'card-147': [
    { question: 'ルビーの赤色の原因となる元素は？', choices: ['クロム', '鉄', '銅', '金'], correctIndex: 0 },
    { question: 'ルビーと同じ鉱物（コランダム）でできている宝石は？', choices: ['サファイア', 'エメラルド', 'ダイヤモンド', 'トパーズ'], correctIndex: 0 },
    { question: 'ルビーの和名は？', choices: ['紅玉', '青玉', '翡翠', '琥珀'], correctIndex: 0 },
  ],
  'card-148': [
    { question: 'サファイアと同じ鉱物でできている宝石は？', choices: ['ルビー', 'エメラルド', 'ダイヤモンド', 'トパーズ'], correctIndex: 0 },
    { question: 'サファイアの代表的な色は？', choices: ['青', '赤', '緑', '黄'], correctIndex: 0 },
    { question: 'サファイアの和名は？', choices: ['青玉', '紅玉', '翡翠', '紫水晶'], correctIndex: 0 },
  ],
  'card-149': [
    { question: 'エメラルドの産地として最も有名な国は？', choices: ['コロンビア', 'ブラジル', 'インド', '南アフリカ'], correctIndex: 0 },
    { question: 'エメラルドを愛したとされる古代の女王は？', choices: ['クレオパトラ', '卑弥呼', 'ビクトリア女王', 'マリー・アントワネット'], correctIndex: 0 },
    { question: 'エメラルドの色は？', choices: ['緑', '青', '赤', '紫'], correctIndex: 0 },
  ],
  'card-150': [
    { question: 'アメジストの和名は？', choices: ['紫水晶', '青玉', '翡翠', '琥珀'], correctIndex: 0 },
    { question: 'アメジストの主な色は？', choices: ['紫', '青', '赤', '緑'], correctIndex: 0 },
    { question: 'アメジストは何という鉱物の一種？', choices: ['水晶', 'コランダム', 'ベリル', 'トルマリン'], correctIndex: 0 },
  ],
  // ===== アフリカデッキ =====
  'card-151': [
    { question: 'ネルソン・マンデラが投獄されていた年数は？', choices: ['27年', '10年', '15年', '20年'], correctIndex: 0 },
    { question: 'マンデラが闘った制度は？', choices: ['アパルトヘイト', '植民地主義', '奴隷制度', '共産主義'], correctIndex: 0 },
    { question: 'マンデラが大統領になった国は？', choices: ['南アフリカ', 'ケニア', 'ナイジェリア', 'エジプト'], correctIndex: 0 },
  ],
  'card-152': [
    { question: 'アパルトヘイトが行われた国は？', choices: ['南アフリカ', 'ケニア', 'エジプト', 'ナイジェリア'], correctIndex: 0 },
    { question: 'アパルトヘイトが廃止された年は？', choices: ['1994年', '1980年', '2000年', '1970年'], correctIndex: 0 },
    { question: 'アパルトヘイトとは何語で「分離」を意味する？', choices: ['アフリカーンス語', '英語', 'フランス語', 'スワヒリ語'], correctIndex: 0 },
  ],
  'card-153': [
    { question: 'キリマンジャロがある国は？', choices: ['タンザニア', 'ケニア', 'エチオピア', 'ウガンダ'], correctIndex: 0 },
    { question: 'キリマンジャロの標高は約何メートル？', choices: ['5895m', '4500m', '7000m', '8848m'], correctIndex: 0 },
    { question: 'キリマンジャロはどの大陸の最高峰？', choices: ['アフリカ', 'アジア', '南アメリカ', 'ヨーロッパ'], correctIndex: 0 },
  ],
  'card-154': [
    { question: 'アフリカゾウの特徴は？', choices: ['耳が大きい', '耳が小さい', '牙がない', '鼻が短い'], correctIndex: 0 },
    { question: 'アフリカゾウが主に生息する環境は？', choices: ['サバンナ', '砂漠', '北極', '海'], correctIndex: 0 },
    { question: 'アフリカゾウは陸上動物で何番目に大きい？', choices: ['1番', '2番', '3番', '4番'], correctIndex: 0 },
  ],
  'card-155': [
    { question: 'サバンナに最も多く生息する大型草食動物は？', choices: ['ヌー', 'キリン', 'カバ', 'サイ'], correctIndex: 0 },
    { question: 'サバンナはどの大陸に最も広く分布している？', choices: ['アフリカ', 'アジア', '南アメリカ', 'ヨーロッパ'], correctIndex: 0 },
    { question: 'サバンナの特徴的な植生は？', choices: ['草原と散在する木', '密林', '針葉樹林', '砂漠'], correctIndex: 0 },
  ],
  // ===== 産業革命デッキ =====
  'card-156': [
    { question: '産業革命で最も重要なエネルギー源は？', choices: ['石炭', '石油', '天然ガス', '水力'], correctIndex: 0 },
    { question: '石炭が大量に採掘された国は？', choices: ['イギリス', 'フランス', 'スペイン', 'イタリア'], correctIndex: 0 },
    { question: '石炭の別名は？', choices: ['黒いダイヤ', '白い金', '赤い石', '青い宝石'], correctIndex: 0 },
  ],
  'card-157': [
    { question: '産業革命で最初に機械化された産業は？', choices: ['繊維', '鉄鋼', '造船', '農業'], correctIndex: 0 },
    { question: '紡績機が発明された国は？', choices: ['イギリス', 'フランス', 'ドイツ', 'アメリカ'], correctIndex: 0 },
    { question: '紡績機は何を作る機械？', choices: ['糸', '布', '鉄', '紙'], correctIndex: 0 },
  ],
  'card-158': [
    { question: '世界初の公共鉄道が開通した国は？', choices: ['イギリス', 'アメリカ', 'フランス', 'ドイツ'], correctIndex: 0 },
    { question: '蒸気機関車を実用化した人物は？', choices: ['スティーブンソン', 'ワット', 'エジソン', 'ベル'], correctIndex: 0 },
    { question: '世界初の公共鉄道の名前は？', choices: ['リバプール・マンチェスター鉄道', 'ロンドン・ブリストル鉄道', 'パリ・リヨン鉄道', 'ニューヨーク・ボストン鉄道'], correctIndex: 0 },
  ],
  'card-159': [
    { question: 'ジェームズ・ワットの名前が由来になった単位は？', choices: ['ワット', 'ジュール', 'アンペア', 'ボルト'], correctIndex: 0 },
    { question: 'ワットが改良した機械は？', choices: ['蒸気機関', '印刷機', '望遠鏡', '時計'], correctIndex: 0 },
    { question: 'ワットの出身国は？', choices: ['スコットランド', 'イングランド', 'フランス', 'ドイツ'], correctIndex: 0 },
  ],
  // ===== ステージモード用追加カード =====
  'card-160': [
    { question: 'ライオンのオスの特徴は？', choices: ['たてがみ', '角', '縞模様', '長い首'], correctIndex: 0 },
    { question: 'ライオンが主に住んでいるのは？', choices: ['北極', 'アフリカのサバンナ', '南米の森', 'オーストラリア'], correctIndex: 1 },
    { question: 'ライオンの群れの名前は？', choices: ['プライド', 'パック', 'ハード', 'フロック'], correctIndex: 0 },
  ],
  'card-161': [
    { question: 'ハチドリの特技は？', choices: ['空中に静止できる', '水中を泳ぐ', '地面を掘る', '夜に光る'], correctIndex: 0 },
    { question: 'ハチドリの主な食べ物は？', choices: ['虫だけ', '花の蜜', '魚', '果物'], correctIndex: 1 },
    { question: 'ハチドリが主に住んでいるのは？', choices: ['アフリカ', 'アジア', '南北アメリカ', 'ヨーロッパ'], correctIndex: 2 },
  ],
  'card-162': [
    { question: 'モアイ像がある島は？', choices: ['ハワイ島', 'イースター島', 'マダガスカル島', 'バリ島'], correctIndex: 1 },
    { question: 'モアイ像は何でできている？', choices: ['木材', '金属', '火山岩', 'レンガ'], correctIndex: 2 },
    { question: 'モアイ像はおよそ何体ある？', choices: ['約100体', '約900体', '約5000体', '約50体'], correctIndex: 1 },
  ],
  'card-163': [
    { question: '焚書坑儒を行った皇帝は？', choices: ['始皇帝', '漢の武帝', '唐の太宗', '明の永楽帝'], correctIndex: 0 },
    { question: '焚書坑儒の「焚書」とは？', choices: ['書物を焼くこと', '書物を集めること', '書物を写すこと', '書物を贈ること'], correctIndex: 0 },
    { question: '焚書坑儒の目的は？', choices: ['教育の普及', '思想の統制', '文化の保護', '学問の奨励'], correctIndex: 1 },
  ],
  'card-164': [
    { question: '始皇帝が不老不死の薬を探しに行かせた人物は？', choices: ['徐福', '張良', '韓信', '蒙恬'], correctIndex: 0 },
    { question: '徐福が不老不死の薬を求めて向かった方角は？', choices: ['西方', '北方', '東方', '南方'], correctIndex: 2 },
    { question: '始皇帝が不老不死を求めた理由は？', choices: ['永遠に国を治めるため', '病気を治すため', '若返るため', '神になるため'], correctIndex: 0 },
  ],
  'card-165': [
    { question: '世界最大のヘビは？', choices: ['アナコンダ', 'キングコブラ', 'ニシキヘビ', 'ブラックマンバ'], correctIndex: 0 },
    { question: 'アナコンダが主に住んでいるのは？', choices: ['アフリカ', '南米', 'アジア', 'オーストラリア'], correctIndex: 1 },
    { question: 'アナコンダの狩りの方法は？', choices: ['毒で麻痺させる', '体で締めつける', '噛みつく', '追いかける'], correctIndex: 1 },
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

// Cards that only appear via in-battle evolution (excluded from deck phase, gacha, AI decks)
export const EVOLUTION_ONLY_CARDS = new Set(['大蛇']);

// Draftable pool: excludes evolution-only cards
export const DRAFTABLE_BATTLE_CARDS: BattleCard[] = ALL_BATTLE_CARDS.filter((c) => !EVOLUTION_ONLY_CARDS.has(c.name));

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

// 同名カード制限: 全レアリティ共通3枚。個別例外あり。
export const MAX_SAME_NAME_DEFAULT = 3;
export const MAX_SAME_NAME_BY_RARITY: Record<CardRarity, number> = {
  N: 3,
  R: 3,
  SR: 3,
  SSR: 3,
};
// 個別カード名の上限オーバーライド
const MAX_SAME_NAME_OVERRIDE: Record<string, number> = {
  '始皇帝': 1,
};
export function maxSameNameFor(rarity: CardRarity, cardName?: string): number {
  if (cardName && MAX_SAME_NAME_OVERRIDE[cardName] !== undefined) return MAX_SAME_NAME_OVERRIDE[cardName];
  return MAX_SAME_NAME_BY_RARITY[rarity];
}

// 合計 per-rarity 上限 (デッキ全体でのレア度別枚数)
export const MAX_SSR = 3;
export const MAX_SR = 3;

// Legacy compat
export const MAX_SAME_NAME = 3;

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
    if (count > maxSameNameFor(rarity, name)) nameOverflow.push(name);
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
    errors.push(`「${name}」は${maxSameNameFor(rarity, name)}枚までです（現在${nameCount.get(name)}枚）`);
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
  const sameNameCap = maxSameNameFor(card.rarity, card.name);
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
    if (nameCount >= maxSameNameFor(card.rarity, card.name)) return false;
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
  return buildValidDeck(DRAFTABLE_BATTLE_CARDS, 'player', INITIAL_DECK_SIZE);
}

// AI starter deck: 10 cards (grows alongside the player between rounds).
export function createAIDeck(): BattleCard[] {
  return buildValidDeck(DRAFTABLE_BATTLE_CARDS, 'ai', INITIAL_DECK_SIZE);
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
    const shuffled = [...DRAFTABLE_BATTLE_CARDS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n).map((c, i) => ({ ...c, id: `${prefix}-${c.id}-${timestamp}-${i}` }));
  }

  // レア度別にプールを事前分割（進化専用カードを除外）
  const byRarity: Record<CardRarity, BattleCard[]> = {
    N:   DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'N'),
    R:   DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'R'),
    SR:  DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'SR'),
    SSR: DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'SSR'),
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

// ===== Synergy Map (コンボ シナジー) =====
export const SYNERGY_MAP: Record<string, string[]> = {
  // 大航海コンボ
  '羅針盤': ['コロンブス', 'マゼラン', 'キャラベル船', '香辛料'],
  'コロンブス': ['羅針盤', 'マゼラン', 'キャラベル船', '香辛料'],
  'マゼラン': ['羅針盤', 'コロンブス', 'キャラベル船', '香辛料'],
  'キャラベル船': ['コロンブス', 'マゼラン', '羅針盤', '香辛料'],
  '香辛料': ['コロンブス', 'マゼラン', '羅針盤', 'キャラベル船'],
  // 安土桃山コンボ
  '織田信長': ['鉄砲', '楽市楽座', '千利休', '豊臣秀吉'],
  '鉄砲': ['織田信長', '楽市楽座', '千利休', '豊臣秀吉'],
  '楽市楽座': ['織田信長', '鉄砲', '千利休', '豊臣秀吉'],
  '千利休': ['織田信長', '鉄砲', '楽市楽座', '豊臣秀吉'],
  '豊臣秀吉': ['織田信長', '鉄砲', '楽市楽座', '千利休'],
  // アインシュタインコンボ
  'アインシュタイン': ['相対性理論の論文', '光速', 'E=mc²'],
  '相対性理論の論文': ['アインシュタイン', '光速', 'E=mc²'],
  '光速': ['アインシュタイン', '相対性理論の論文', 'E=mc²'],
  'E=mc²': ['アインシュタイン', '相対性理論の論文', '光速'],
  // ナポレオンコンボ
  'ナポレオン': ['大砲', 'ナポレオン法典', 'ワーテルローの戦い'],
  '大砲': ['ナポレオン', 'ナポレオン法典', 'ワーテルローの戦い', '火薬'],
  'ナポレオン法典': ['ナポレオン', '大砲', 'ワーテルローの戦い'],
  'ワーテルローの戦い': ['ナポレオン', '大砲', 'ナポレオン法典'],
  // キュリー夫人コンボ
  'キュリー夫人': ['ラジウム', '研究ノート', 'ノーベル賞メダル'],
  'ラジウム': ['キュリー夫人', '研究ノート', 'ノーベル賞メダル'],
  '研究ノート': ['キュリー夫人', 'ラジウム', 'ノーベル賞メダル'],
  'ノーベル賞メダル': ['キュリー夫人', 'ラジウム', '研究ノート', 'アインシュタイン', 'ダーウィン'],
  // 既存コンボのシナジー
  'エジソン': ['電球', '蓄音機'],
  '電球': ['エジソン', '蓄音機'],
  '蓄音機': ['エジソン', '電球'],
  'ダーウィン': ['ゾウガメ', 'ダーウィンフィンチ', 'ノーベル賞メダル'],
  'ゾウガメ': ['ダーウィン', 'ダーウィンフィンチ'],
  'ダーウィンフィンチ': ['ダーウィン', 'ゾウガメ'],
  'ライト兄弟': ['グライダー', '風洞'],
  'グライダー': ['ライト兄弟', '風洞'],
  '風洞': ['ライト兄弟', 'グライダー'],
  '北里柴三郎': ['ペスト菌', '血清'],
  'ペスト菌': ['北里柴三郎', '血清'],
  '血清': ['北里柴三郎', 'ペスト菌'],
  '始皇帝': ['兵馬俑', '万里の長城', '焚書坑儒', '不老不死の薬'],
  '兵馬俑': ['始皇帝', '万里の長城', '焚書坑儒', '不老不死の薬'],
  '焚書坑儒': ['始皇帝', '兵馬俑', '万里の長城'],
  '不老不死の薬': ['始皇帝', '兵馬俑', '万里の長城'],
  'アマゾン川': ['アナコンダ', '毒矢カエル', 'ピラニア', '光合成'],
  'ピラニア': ['アマゾン川', 'アナコンダ', '毒矢カエル', '光合成', 'ダーウィン'],
  'アナコンダ': ['アマゾン川', '毒矢カエル', 'ピラニア', 'ダーウィン', '大蛇'],
  '大蛇': ['アマゾン川', 'アナコンダ', '毒矢カエル'],
  '毒矢カエル': ['アマゾン川', 'アナコンダ', 'ピラニア', '光合成'],
  'ニュートン': ['リンゴ', 'プリズム', '万有引力'],
  'リンゴ': ['ニュートン', 'プリズム', '万有引力'],
  'プリズム': ['ニュートン', 'リンゴ', '万有引力'],
  '万有引力': ['ニュートン', 'リンゴ', 'プリズム'],
  'ルター': ['聖書', '活版印刷機', '免罪符'],
  '聖書': ['ルター', '活版印刷機', '免罪符'],
  '活版印刷機': ['ルター', '聖書', '免罪符'],
  '免罪符': ['ルター', '聖書', '活版印刷機'],
  'ゴッホ': ['ひまわり', '星月夜', '糸杉'],
  'ひまわり': ['ゴッホ', '星月夜', '糸杉'],
  '星月夜': ['ゴッホ', 'ひまわり', '糸杉'],
  '糸杉': ['ゴッホ', 'ひまわり', '星月夜'],
  'ジャンヌ・ダルク': ['聖剣', '軍旗'],
  '聖剣': ['ジャンヌ・ダルク', '軍旗'],
  '軍旗': ['ジャンヌ・ダルク', '聖剣'],
  'マリー・アントワネット': ['ヴェルサイユ宮殿', 'ケーキ'],
  'ヴェルサイユ宮殿': ['マリー・アントワネット', 'ケーキ'],
  'ケーキ': ['マリー・アントワネット', 'ヴェルサイユ宮殿'],
  'ガリレオ': ['地動説', '望遠鏡', '天動説'],
  '地動説': ['ガリレオ', '望遠鏡', '天動説'],
  '天動説': ['ガリレオ', '地動説', '望遠鏡'],
  '望遠鏡': ['ガリレオ', '地動説', '天動説'],
  '顕微鏡': ['野口英世', '黄熱病', '北里柴三郎', 'ペスト菌'],
  '野口英世': ['顕微鏡', '黄熱病'],
  '黄熱病': ['野口英世', '顕微鏡'],
  'ダイナマイト': ['火薬'],
  '光合成': ['アマゾン川', 'ピラニア', 'アナコンダ', '毒矢カエル', '大蛇'],
  '火薬': ['ダイナマイト', '大砲', 'ナポレオン'],
  // アフリカコンボ
  'ネルソン・マンデラ': ['アパルトヘイト', 'キリマンジャロ', 'アフリカゾウ', 'サバンナ'],
  'アパルトヘイト': ['ネルソン・マンデラ', 'キリマンジャロ', 'アフリカゾウ', 'サバンナ'],
  'キリマンジャロ': ['ネルソン・マンデラ', 'アパルトヘイト', 'アフリカゾウ', 'サバンナ'],
  'アフリカゾウ': ['サバンナ', 'アマゾン川', 'ネルソン・マンデラ', 'ダーウィン'],
  'サバンナ': ['アフリカゾウ', 'アマゾン川', 'ダーウィン', 'ネルソン・マンデラ'],
  // 産業革命コンボ
  '蒸気機関': ['石炭', '紡績機', '蒸気機関車', 'ジェームズ・ワット'],
  '石炭': ['蒸気機関', '紡績機', '蒸気機関車', 'ジェームズ・ワット'],
  '紡績機': ['蒸気機関', '石炭', '蒸気機関車', 'ジェームズ・ワット'],
  '蒸気機関車': ['蒸気機関', '石炭', '紡績機', 'ジェームズ・ワット'],
  'ジェームズ・ワット': ['蒸気機関', '石炭', '紡績機', '蒸気機関車'],
  '車輪': ['蒸気機関車', '蒸気機関', '石炭'],
};

// ===== Round-specific offering composition for synergy draft =====
const ROUND_OFFER_SPEC: Record<number, { synergy: number; random: number; tempt: number; ssrGuarantee: boolean }> = {
  1: { synergy: 2, random: 2, tempt: 1, ssrGuarantee: false },
  2: { synergy: 3, random: 1, tempt: 1, ssrGuarantee: false },
  3: { synergy: 3, random: 1, tempt: 1, ssrGuarantee: false },
  4: { synergy: 3, random: 2, tempt: 0, ssrGuarantee: false },
  5: { synergy: 2, random: 2, tempt: 1, ssrGuarantee: true },
};

export function sampleCardsWithSynergy(
  n: number,
  prefix: string,
  round: number,
  playerDeck: BattleCard[],
): BattleCard[] {
  const spec = ROUND_OFFER_SPEC[round] || ROUND_OFFER_SPEC[1];
  const timestamp = Date.now();
  const result: BattleCard[] = [];
  const usedIds = new Set<string>();

  const addCard = (card: BattleCard) => {
    if (usedIds.has(card.id)) return false;
    usedIds.add(card.id);
    result.push({ ...card, id: `${prefix}-${card.id}-${timestamp}-${result.length}` });
    return true;
  };

  // Collect synergy targets from current deck (exclude cards already at same-name limit)
  const deckNameCounts = new Map<string, number>();
  playerDeck.forEach((c) => deckNameCounts.set(c.name, (deckNameCounts.get(c.name) ?? 0) + 1));
  const isAtLimit = (name: string, rarity: CardRarity) => {
    const count = deckNameCounts.get(name) ?? 0;
    return count >= maxSameNameFor(rarity, name);
  };
  const synergyTargetNames = new Set<string>();
  playerDeck.forEach((c) => {
    const targets = SYNERGY_MAP[c.name];
    if (targets) targets.forEach((t) => {
      const tCard = DRAFTABLE_BATTLE_CARDS.find((bc) => bc.name === t);
      if (tCard && !isAtLimit(t, tCard.rarity)) synergyTargetNames.add(t);
    });
  });

  // Allowed rarities for this round
  const allowedRarities = new Set(availableRarities(round).map(([r]) => r));

  // 1. Synergy cards — weighted by combo concentration + rarity in deck
  const RARITY_WEIGHT: Record<CardRarity, number> = { N: 1, R: 3, SR: 5, SSR: 8 };
  const synergyPool = DRAFTABLE_BATTLE_CARDS.filter((c) => synergyTargetNames.has(c.name) && allowedRarities.has(c.rarity));
  const weightedSynergy = synergyPool.map((card) => {
    // Sum rarity-weighted score of related cards in deck
    const cardSynergies = SYNERGY_MAP[card.name] ?? [];
    const relatedCards = playerDeck.filter((d) =>
      d.name === card.name || cardSynergies.includes(d.name) || (SYNERGY_MAP[d.name] ?? []).includes(card.name),
    );
    const comboScore = relatedCards.reduce((s, d) => s + RARITY_WEIGHT[d.rarity], 0);
    // Map combo score to weight: 0→0.05, 1→0.10, 2-3→0.20, 4-5→0.40, 6-9→0.55, 10+→0.75
    const weight = comboScore === 0 ? 0.05
      : comboScore <= 1 ? 0.10
      : comboScore <= 3 ? 0.20
      : comboScore <= 5 ? 0.40
      : comboScore <= 9 ? 0.55
      : 0.75;
    return { card, weight: weight + Math.random() * 0.05 }; // tiny random jitter
  });
  weightedSynergy.sort((a, b) => b.weight - a.weight);
  for (let i = 0; i < spec.synergy && weightedSynergy.length > 0; i++) {
    const pick = weightedSynergy.shift();
    if (pick) addCard(pick.card);
  }

  // 2. SSR guaranteed slot (R5)
  if (spec.ssrGuarantee) {
    const ssrPool = DRAFTABLE_BATTLE_CARDS.filter((c) => c.rarity === 'SSR' && !usedIds.has(c.id));
    if (ssrPool.length > 0) {
      addCard(ssrPool[Math.floor(Math.random() * ssrPool.length)]);
    }
  }

  // 3. Temptation cards (not synergy with current deck)
  if (spec.tempt > 0) {
    const temptPool = DRAFTABLE_BATTLE_CARDS.filter((c) => !synergyTargetNames.has(c.name) && !deckNameCounts.has(c.name) && !usedIds.has(c.id) && allowedRarities.has(c.rarity));
    // Prioritize high-power temptation cards (sort by power desc with jitter)
    const shuffledTempt = [...temptPool].sort((a, b) => {
      const pa = (a.attackPower ?? a.power) + (a.defensePower ?? a.power);
      const pb = (b.attackPower ?? b.power) + (b.defensePower ?? b.power);
      return (pb - pa) + (Math.random() - 0.5) * 2;
    });
    for (let i = 0; i < spec.tempt && shuffledTempt.length > 0; i++) {
      const card = shuffledTempt.shift();
      if (card) addCard(card);
    }
  }

  // 4. Random cards to fill remaining slots
  const remaining = n - result.length;
  if (remaining > 0) {
    const randomPool = DRAFTABLE_BATTLE_CARDS.filter((c) => !usedIds.has(c.id));
    const shuffledRandom = [...randomPool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < remaining && shuffledRandom.length > 0; i++) {
      const rarity = rollRarityByRound(round);
      const rarityFiltered = shuffledRandom.filter((c) => c.rarity === rarity);
      const pick = rarityFiltered.length > 0 ? rarityFiltered[0] : shuffledRandom[0];
      if (pick) {
        addCard(pick);
        const idx = shuffledRandom.indexOf(pick);
        if (idx >= 0) shuffledRandom.splice(idx, 1);
      }
    }
  }

  // Shuffle result to avoid predictable positions
  return result.sort(() => Math.random() - 0.5);
}

// Legacy exports for compatibility
export const ALL_CARDS = [...INITIAL_CARDS, ...ALL_BATTLE_CARDS];
