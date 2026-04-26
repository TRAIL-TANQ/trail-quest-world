// ============================================================================
// battleService.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP
// Supabase 連携層 (battle_* 系テーブル) + ランタイム state 構築
// ============================================================================
//
// 責務:
//   - battle_leaders / battle_cards_meta / battle_decks / battle_deck_cards を取得
//   - preset デッキを BattleCardInstance[] へ展開
//   - battle_sessions に INSERT / UPDATE
//   - ゲスト/管理者/モニターは DB 書込をスキップ (synthetic sessionId を発行)
// ============================================================================

import { nanoid } from 'nanoid';
import { COLLECTION_CARDS } from './cardData';
import { supabase } from './supabase';
import { isAdmin, isGuest, isMonitor } from './auth';
import { createInitialState } from './battle/battleEngine';
import type {
  BattleCardInstance,
  BattleCardMetaRow,
  BattleDeckCardRow,
  BattleDeckRow,
  BattleDifficulty,
  BattleLeaderRow,
  BattleResult,
  BattleState,
  TriggerType,
} from './battle/battleTypes';

// ---- カード日本語名マスタ (Phase 6c-1) ------------------------------------
//
// battle_cards_meta テーブルには name カラムが存在しないため、TS 側で
// cardId → 日本語表示名の対応を一括登録する。expandDeck() がこのマップを
// 参照して BattleCardInstance.name を Japanese で初期化するので、UI 側は
// `card.name` をそのまま描画すれば日本語が出る。
//
// 構成:
//   - キャラクターカード (card_*)        : ~95 件 (CARD_IMAGE_OVERRIDES に対応)
//   - 装備カード (eq_*)                  : 10 件 (Phase 6b-1.6 / 0041 seed)
//   - カウンターカード (cn_*)             : 10 件 (Phase 6b-1.6 / 0042 seed)
//   - イベントカード (ev_*)               : 15 件 (Phase 6b-1.6 / 0043 seed)
//
// 未登録 cardId は getCardName() で cardId 文字列がそのまま返される
// (デバッグしやすさ優先)。

export const CARD_NAME_MAP: Record<string, string> = {
  // ===== ナポレオン系 =====
  card_napoleon: 'ナポレオン',
  card_cannon: '大砲',
  card_waterloo: 'ワーテルローの戦い',
  card_austerlitz: 'アウステルリッツの戦い',
  card_napoleon_code: 'ナポレオン法典',
  card_arc_de_triomphe: '凱旋門',

  // ===== 信長系 =====
  card_nobunaga: '織田信長',
  card_oda_nobunaga: '織田信長',
  card_akechi_mitsuhide: '明智光秀',
  card_honnoji: '本能寺',
  card_mikka_tenka: '三日天下',
  card_atsumori: '敦盛',
  card_nagashino_formation: '長篠の三段撃ち',
  card_azuchi_castle: '安土城',
  card_rakuichi: '楽市楽座',
  card_ashigaru: '足軽',
  card_nanban_trade: '南蛮貿易',
  card_tennouzan: '天王山',
  card_hideyoshi: '羽柴秀吉',
  card_rikyu: '千利休',
  card_atago_hyakuin: '愛宕百韻',

  // ===== ダ・ヴィンチ系 =====
  card_davinci: 'レオナルド・ダ・ヴィンチ',
  card_leonardo: 'レオナルド・ダ・ヴィンチ',
  card_universal_genius: '万能の天才',
  card_mona_lisa: 'モナ・リザ',
  card_last_supper: '最後の晩餐',
  card_flying_machine: '空飛ぶ機械',
  card_blueprint: '設計図',
  card_anatomy: '解剖学',
  card_mirror_writing: '鏡文字',

  // ===== ガリレオ系 =====
  card_galileo: 'ガリレオ・ガリレイ',
  card_telescope: '望遠鏡',
  card_earth_moves: 'それでも地球は動く',
  card_geocentric: '天動説',
  card_heliocentric: '地動説',

  // ===== 紫式部系 =====
  card_murasaki: '紫式部',
  card_genji_monogatari: '源氏物語',
  card_tale_of_genji: '源氏物語',
  card_junihitoe: '十二単',
  card_waka: '和歌',
  card_fude: '筆',

  // ===== 清少納言系 =====
  card_sei_shonagon: '清少納言',
  card_makura_no_soshi: '枕草子',
  card_paper: '紙',

  // ===== アマゾン系 =====
  card_amazon: 'アマゾン川',
  card_amazon_river: 'アマゾン川',
  card_anaconda: 'アナコンダ',
  card_anaconda_hunter: 'アナコンダハンター',
  card_giant_snake: '大蛇',
  card_giant_serpent: '大蛇',
  card_poison_frog: 'ヤドクガエル',
  card_piranha: 'ピラニア',
  card_jaguar: 'ジャガー',
  card_pink_dolphin: 'ピンクイルカ',
  card_hummingbird: 'ハチドリ',
  card_tropical_forest: '熱帯雨林',

  // ===== オオカミ系 =====
  card_wolf: 'オオカミ',
  card_howl: '遠吠え',
  card_moonlight_howl: '月夜の遠吠え',
  card_pack_law: '群れの掟',
  card_territory: 'なわばり',
  card_lone_wolf: '一匹狼',
  card_lion: 'ライオン',
  card_elephant_africa: 'アフリカゾウ',
  card_african_elephant: 'アフリカゾウ',

  // ===== ジャンヌ系 =====
  card_jeanne: 'ジャンヌ・ダルク',
  card_jeanne_saint: '聖女ジャンヌ',
  card_saint_jeanne: '聖女ジャンヌ',
  card_burning_stake: '火刑台',
  card_prayer_light: '祈りの光',
  card_holy_banner: '聖なる旗',
  card_holy_sword: '聖剣',
  card_war_banner: '戦旗',
  card_lily_shield: '百合の盾',
  card_bible: '聖書',
  card_cross: '十字架',
  card_templar: 'テンプル騎士',

  // ===== 始皇帝系 =====
  card_qin_shi_huang: '始皇帝',
  card_emperor_qin: '始皇帝',
  card_terracotta_army: '兵馬俑',
  card_terracotta: '兵馬俑',
  card_qin_soldier: '秦の兵士',
  card_great_wall: '万里の長城',
  card_book_burning: '焚書',
  card_imperial_decree: '皇帝の勅令',
  card_gunpowder: '火薬',

  // ===== 汎用 =====
  card_soldier_musket: 'マスケット兵',
  card_cavalry: '騎兵',
  card_typhoon: '台風',
  card_earthquake: '大地震',
  card_sun: '太陽',
  card_moon: '月',

  // ===== v2.0.2 装備カード 10 枚 (0041 seed) =====
  eq_napoleon_bicorne: 'ナポレオンの三角帽',
  eq_nobunaga_matchlock: '信長の火縄銃',
  eq_davinci_codex: 'ダ・ヴィンチの万能手帳',
  eq_galileo_telescope: 'ガリレオの望遠鏡',
  eq_murasaki_genji: '紫式部の源氏物語',
  eq_seishonagon_pillowbook: '清少納言の枕草子',
  eq_amazon_blessing: '大河の祝福',
  eq_wolf_howl: '月夜の遠吠え',
  eq_jeanne_holysword: 'ジャンヌの聖剣',
  eq_qin_wallstone: '万里の長城の石',

  // ===== v2.0.2 カウンターカード 10 枚 (0042 seed) =====
  cn_warriors_oath: '戦士の誓い',
  cn_matchlock_wall: '火縄銃の防壁',
  cn_universal_diagram: '万能図解',
  cn_observers_eye: '観測者の眼',
  cn_tale_shield: '物語の盾',
  cn_witty_words: '機知の言葉',
  cn_river_guardian: '大河の守護者',
  cn_pack_unity: '群れの結束',
  cn_sacred_blessing: '聖なる祝福',
  cn_great_wall_shield: '万里の長城の盾',

  // ===== v2.0.2 イベントカード 15 枚 (0043 seed) =====
  ev_waterloo: 'ワーテルロー',
  ev_honnoji: '本能寺の変',
  ev_renaissance: 'ルネサンス',
  ev_heliocentric: '地動説',
  ev_genji_writing: '源氏物語の執筆',
  ev_pillow_morning: '春はあけぼの',
  ev_river_flood: '大河の氾濫',
  ev_moonlight_hunt: '月夜の狩り',
  ev_jeanne_oracle: 'ジャンヌの託宣',
  ev_great_wall_build: '万里の長城建設',
  ev_great_storm: '大嵐',
  ev_lunar_eclipse: '月蝕',
  ev_spring_arrival: '春の訪れ',
  ev_earthquake_global: '大地震',
  ev_scout: '物見',
};

/**
 * cardId を日本語表示名へ解決。未登録 cardId は cardId 文字列をそのまま返す
 * (Phase 6c-1)。BattleCardInstance.name の初期化と、cardId を直接 UI 表示
 * している箇所 (TargetSelectionModal の発動カードラベル等) で使用。
 */
export function getCardName(cardId: string): string {
  return CARD_NAME_MAP[cardId] ?? cardId;
}

// ---- カード名 / 画像 の lookup (cardData.ts = 既存 226 枚マスタから取得) ----
//
// 旧 226 枚マスタに登録済の card-001 系 ID は cardData の name/imageUrl を
// 使う。battle 系の card_*/eq_*/cn_*/ev_* はマスタに存在しないので、
// CARD_NAME_MAP 経由の getCardName でフォールバックする。

let cardDisplayCache: Map<string, { name: string; imageUrl: string }> | null = null;
function getCardDisplay(cardId: string): { name: string; imageUrl: string } {
  if (!cardDisplayCache) {
    cardDisplayCache = new Map();
    for (const c of COLLECTION_CARDS) {
      cardDisplayCache.set(c.id, { name: c.name, imageUrl: c.imageUrl });
    }
  }
  return (
    cardDisplayCache.get(cardId) ?? { name: getCardName(cardId), imageUrl: '' }
  );
}

// ---- v2.0-launch カード画像解決 --------------------------------------------
// 0041 seed の card_xxx_yyy 形式 → /images/cards/ 配下の実画像へのマッピング。
// 既存 /images/cards/ には 276 枚の画像があるが、v2 seed の命名規則とはズレる
// ものが多いため、明示マップで吸収。ヒット無しは heuristic → そのまま返す。
// 最終的に 404 になる場合、<img onError> 側で placeholder 表示にフォールバック。

const CARD_IMAGE_OVERRIDES: Record<string, string> = {
  // ナポレオン系
  card_napoleon: '/images/cards/napoleon.png',
  card_cannon: '/images/cards/cannon.png',
  card_waterloo: '/images/cards/waterloo.png',
  card_austerlitz: '/images/cards/austerlitz.png',
  card_napoleon_code: '/images/cards/napoleon-code.png',
  card_arc_de_triomphe: '/images/cards/arc-de-triomphe.png',
  // 信長系
  card_nobunaga: '/images/cards/oda-nobunaga.png',
  card_oda_nobunaga: '/images/cards/oda-nobunaga.png',
  card_akechi_mitsuhide: '/images/cards/akechi-mitsuhide.png',
  card_honnoji: '/images/cards/honnoji.png',
  card_mikka_tenka: '/images/cards/mikka-tenka.png',
  card_atsumori: '/images/cards/atsumori.png',
  card_nagashino_formation: '/images/cards/nagashino-formation.png',
  card_azuchi_castle: '/images/cards/azuchi-castle.png',
  card_rakuichi: '/images/cards/rakuichi.png',
  card_ashigaru: '/images/cards/ashigaru.png',
  card_nanban_trade: '/images/cards/nanban-trade.png',
  card_tennouzan: '/images/cards/tennouzan.png',
  card_hideyoshi: '/images/cards/hideyoshi.png',
  card_rikyu: '/images/cards/rikyu.png',
  card_atago_hyakuin: '/images/cards/atago-hyakuin.png',
  // ダ・ヴィンチ系
  card_davinci: '/images/cards/leonardo-da-vinci.png',
  card_leonardo: '/images/cards/leonardo-da-vinci.png',
  card_universal_genius: '/images/cards/vitruvian-man.png',
  card_mona_lisa: '/images/cards/mona-lisa.png',
  card_last_supper: '/images/cards/last-supper.png',
  card_flying_machine: '/images/cards/flying-machine.png',
  card_blueprint: '/images/cards/blueprint.png',
  card_anatomy: '/images/cards/anatomy.png',
  card_mirror_writing: '/images/cards/mirror-writing.png',
  // ガリレオ系
  card_galileo: '/images/cards/galileo.png',
  card_telescope: '/images/cards/telescope.png',
  card_earth_moves: '/images/cards/earth-moves.png',
  card_geocentric: '/images/cards/geocentric.png',
  card_heliocentric: '/images/cards/heliocentric.png',
  // 紫式部系
  card_murasaki: '/images/cards/murasaki-shikibu.png',
  card_genji_monogatari: '/images/cards/tale-of-genji.png',
  card_tale_of_genji: '/images/cards/tale-of-genji.png',
  card_junihitoe: '/images/cards/junihitoe.png',
  card_waka: '/images/cards/waka.png',
  card_fude: '/images/cards/fude.png',
  // 清少納言系
  card_sei_shonagon: '/images/cards/sei-shonagon.png',
  card_makura_no_soshi: '/images/cards/makura-no-soshi.png',
  card_paper: '/images/cards/paper.png',
  // アマゾン系
  card_amazon: '/images/cards/amazon-river.png',
  card_amazon_river: '/images/cards/amazon-river.png',
  card_anaconda: '/images/cards/anaconda.png',
  card_anaconda_hunter: '/images/cards/anaconda-hunter.png',
  card_giant_snake: '/images/cards/giant-serpent.png',
  card_giant_serpent: '/images/cards/giant-serpent.png',
  card_poison_frog: '/images/cards/poison-frog.png',
  card_piranha: '/images/cards/piranha.png',
  card_jaguar: '/images/cards/jaguar.png',
  card_pink_dolphin: '/images/cards/pink-dolphin.png',
  card_hummingbird: '/images/cards/hummingbird.png',
  card_tropical_forest: '/images/cards/savanna.png', // 近似代替 (本来は熱帯雨林)
  // オオカミ系
  card_wolf: '/images/cards/wolf.png',
  card_howl: '/images/cards/howl.png',
  card_moonlight_howl: '/images/cards/moonlight-howl.png',
  card_pack_law: '/images/cards/pack-law.png',
  card_territory: '/images/cards/territory.png',
  card_lone_wolf: '/images/cards/lone-wolf.png',
  card_lion: '/images/cards/lion.png',
  card_elephant_africa: '/images/cards/african-elephant.png',
  card_african_elephant: '/images/cards/african-elephant.png',
  // ジャンヌ系
  card_jeanne: '/images/cards/jeanne.png',
  card_jeanne_saint: '/images/cards/saint-jeanne.png',
  card_saint_jeanne: '/images/cards/saint-jeanne.png',
  card_burning_stake: '/images/cards/burning-stake.png',
  card_prayer_light: '/images/cards/prayer-light.png',
  card_holy_banner: '/images/cards/holy-banner.png',
  card_holy_sword: '/images/cards/holy-sword.png',
  card_war_banner: '/images/cards/war-banner.png',
  card_lily_shield: '/images/cards/lily-shield.png',
  card_bible: '/images/cards/bible.png',
  card_cross: '/images/cards/bible.png', // 近似代替
  card_templar: '/images/cards/holy-sword.png', // 近似代替
  // 秦始皇帝系
  card_qin_shi_huang: '/images/cards/emperor-qin.png',
  card_emperor_qin: '/images/cards/emperor-qin.png',
  card_terracotta_army: '/images/cards/terracotta.png',
  card_terracotta: '/images/cards/terracotta.png',
  card_qin_soldier: '/images/cards/qin-soldier.png',
  card_great_wall: '/images/cards/great-wall.png',
  card_book_burning: '/images/cards/book-burning.png',
  card_imperial_decree: '/images/cards/imperial-decree.png',
  card_gunpowder: '/images/cards/gunpowder.png',
  // 汎用イベント / フォールバック無しの可能性大
  card_soldier_musket: '/images/cards/ashigaru.png', // 近似
  card_cavalry: '/images/cards/nagashino-formation.png', // 近似
  card_typhoon: '/images/cards/wind-tunnel.png', // 近似 (台風 → 風)
  card_earthquake: '/images/cards/great-wall.png', // 適切な代替なし
  card_sun: '/images/cards/sunflower.png', // 近似
  card_moon: '/images/cards/moonlight-howl.png', // 近似

  // ---- v2.0.2 Phase 6b-1.6: 装備カード 10 枚 -------------------------------
  eq_napoleon_bicorne: '/images/cards/napoleon-bicorne.png', // Manus 新規
  eq_nobunaga_matchlock: '/images/cards/gun.png', // 既存流用
  eq_davinci_codex: '/images/cards/research-notes.png', // 既存流用
  eq_galileo_telescope: '/images/cards/telescope.png', // 既存流用
  eq_murasaki_genji: '/images/cards/tale-of-genji.png', // 既存流用
  eq_seishonagon_pillowbook: '/images/cards/makura-no-soshi.png', // 既存流用
  eq_amazon_blessing: '/images/cards/amazon-blessing.png', // Manus 新規
  eq_wolf_howl: '/images/cards/moonlight-howl.png', // 既存流用
  eq_jeanne_holysword: '/images/cards/holy-sword.png', // 既存流用
  eq_qin_wallstone: '/images/cards/great-wall.png', // 既存流用 (始皇帝デッキ共有)

  // ---- v2.0.2 Phase 6b-1.6: カウンターカード 10 枚 -------------------------
  cn_warriors_oath: '/images/cards/war-banner.png',
  cn_matchlock_wall: '/images/cards/nagashino-formation.png',
  cn_universal_diagram: '/images/cards/blueprint.png',
  cn_observers_eye: '/images/cards/microscope.png',
  cn_tale_shield: '/images/cards/lily-shield.png',
  cn_witty_words: '/images/cards/fude.png',
  cn_river_guardian: '/images/cards/anaconda.png',
  cn_pack_unity: '/images/cards/pack-law.png',
  cn_sacred_blessing: '/images/cards/prayer-light.png',
  cn_great_wall_shield: '/images/cards/great-wall.png', // 始皇帝デッキ世界観共有

  // ---- v2.0.2 Phase 6b-1.6: イベントカード 15 枚 ---------------------------
  ev_waterloo: '/images/cards/waterloo.png',
  ev_honnoji: '/images/cards/honnoji.png',
  ev_renaissance: '/images/cards/mona-lisa.png', // 流用
  ev_heliocentric: '/images/cards/heliocentric.png',
  ev_genji_writing: '/images/cards/waka.png', // 流用
  ev_pillow_morning: '/images/cards/paper.png', // 流用
  ev_river_flood: '/images/cards/amazon-river.png', // 流用
  ev_moonlight_hunt: '/images/cards/howl.png', // 流用
  ev_jeanne_oracle: '/images/cards/saint-jeanne.png', // 流用
  ev_great_wall_build: '/images/cards/great-wall.png', // 始皇帝デッキ共有
  ev_great_storm: '/images/cards/wind-tunnel.png', // 流用
  ev_lunar_eclipse: '/images/cards/lunar-eclipse.png', // Manus 新規
  ev_spring_arrival: '/images/cards/spring-arrival.png', // Manus 新規
  ev_earthquake_global: '/images/cards/earthquake-global.png', // Manus 新規
  ev_scout: '/images/cards/ashigaru.png', // 流用
};

/**
 * v2 seed の card_id を /images/cards/ 配下のパスへ解決。
 * 優先: 明示マップ > 226枚マスタ (cardData.ts) > heuristic (underscore→hyphen) > as-is
 * 最終的に 404 になる場合の placeholder は呼び出し側 (<img onError>) に任せる。
 */
export function resolveCardImage(cardId: string): string {
  // 1. 明示マップ
  const explicit = CARD_IMAGE_OVERRIDES[cardId];
  if (explicit) return explicit;
  // 2. 既存 226 枚マスタ
  const fromMaster = getCardDisplay(cardId).imageUrl;
  if (fromMaster) return fromMaster;
  // 3. heuristic: card_xxx_yyy → /images/cards/xxx-yyy.png
  if (cardId.startsWith('card_')) {
    const stripped = cardId.slice('card_'.length).replace(/_/g, '-');
    return `/images/cards/${stripped}.png`;
  }
  // 4. そのまま
  return `/images/cards/${cardId}.png`;
}

// ---- 取得 API ----

export async function fetchLeaders(): Promise<BattleLeaderRow[]> {
  const { data, error } = await supabase
    .from('battle_leaders')
    .select('*')
    .order('id');
  if (error) {
    console.warn('[battleService] fetchLeaders failed:', error.message);
    return [];
  }
  return (data as BattleLeaderRow[]) ?? [];
}

export async function fetchCards(): Promise<BattleCardMetaRow[]> {
  const { data, error } = await supabase.from('battle_cards_meta').select('*');
  if (error) {
    console.warn('[battleService] fetchCards failed:', error.message);
    return [];
  }
  return (data as BattleCardMetaRow[]) ?? [];
}

export interface PresetDeck {
  deck: BattleDeckRow;
  cards: BattleDeckCardRow[];
}

export async function fetchPresetDecks(): Promise<PresetDeck[]> {
  const { data: decks, error: deckErr } = await supabase
    .from('battle_decks')
    .select('*')
    .eq('is_preset', true)
    .order('id');
  if (deckErr) {
    console.warn('[battleService] fetchPresetDecks (decks) failed:', deckErr.message);
    return [];
  }
  if (!decks || decks.length === 0) return [];

  const deckRows = decks as BattleDeckRow[];
  const ids = deckRows.map((d) => d.id);

  const { data: cards, error: cardsErr } = await supabase
    .from('battle_deck_cards')
    .select('*')
    .in('deck_id', ids);
  if (cardsErr) {
    console.warn('[battleService] fetchPresetDecks (cards) failed:', cardsErr.message);
    return deckRows.map((d) => ({ deck: d, cards: [] }));
  }

  const byDeck = new Map<number, BattleDeckCardRow[]>();
  for (const dc of (cards as BattleDeckCardRow[]) ?? []) {
    const list = byDeck.get(dc.deck_id) ?? [];
    list.push(dc);
    byDeck.set(dc.deck_id, list);
  }
  return deckRows.map((d) => ({ deck: d, cards: byDeck.get(d.id) ?? [] }));
}

// ---- デッキ展開 (BattleDeckCardRow[] → BattleCardInstance[]) ----

/**
 * preset deck を BattleCardInstance[] (30 枚) に展開。
 * count > 1 の行は同じカードを count 回複製し、それぞれ一意な instanceId を持たせる。
 */
export function expandDeck(
  deckCards: BattleDeckCardRow[],
  cardMetaById: Map<string, BattleCardMetaRow>,
): BattleCardInstance[] {
  const out: BattleCardInstance[] = [];
  for (const dc of deckCards) {
    const meta = cardMetaById.get(dc.card_id);
    if (!meta) {
      console.warn(`[battleService] expandDeck: unknown card_id ${dc.card_id}`);
      continue;
    }
    const display = getCardDisplay(dc.card_id);
    // DB に trigger_type カラム未追加の状態でも安全に動くよう undefined → null に正規化
    const triggerType =
      (meta as { trigger_type?: TriggerType }).trigger_type ?? null;
    // v2.0.2 追加カラム: counter_value / equipment_* / event_* も
    // 旧 DB スキーマで undefined になり得るためデフォルト値で補完
    const m = meta as BattleCardMetaRow;
    for (let i = 0; i < dc.count; i++) {
      out.push({
        instanceId: nanoid(10),
        cardId: dc.card_id,
        name: display.name,
        cost: meta.cost,
        power: meta.power,
        attackPower: meta.attack_power,
        defensePower: meta.defense_power,
        color: meta.color,
        cardType: meta.card_type ?? 'character',
        effectText: meta.effect_text,
        triggerType,
        counterValue: m.counter_value ?? 0,
        equipmentTargetLeaderId: m.equipment_target_leader_id ?? null,
        equipmentEffectType: m.equipment_effect_type ?? null,
        equipmentEffectData: m.equipment_effect_data ?? null,
        eventEffectType: (m.event_effect_type as string | null | undefined) ?? null,
        eventEffectData: m.event_effect_data ?? null,
      });
    }
  }
  return out;
}

// ---- セッション開始 / 終了 ----

export interface StartBattleParams {
  childId: string;
  p1LeaderId: string;
  p1DeckId: number;
  p2LeaderId: string;
  p2DeckId: number;
  difficulty: BattleDifficulty;
}

export interface StartBattleResult {
  sessionId: number; // guest/admin/monitor は synthetic (負値)
  initialState: BattleState;
}

export async function startBattle(
  params: StartBattleParams,
): Promise<StartBattleResult> {
  const [leaders, cards, presetDecks] = await Promise.all([
    fetchLeaders(),
    fetchCards(),
    fetchPresetDecks(),
  ]);

  const leaderById = new Map(leaders.map((l) => [l.id, l]));
  const cardMetaById = new Map(cards.map((c) => [c.card_id, c]));
  const deckById = new Map(presetDecks.map((d) => [d.deck.id, d]));

  const p1Leader = leaderById.get(params.p1LeaderId);
  const p2Leader = leaderById.get(params.p2LeaderId);
  if (!p1Leader) throw new Error(`p1 leader not found: ${params.p1LeaderId}`);
  if (!p2Leader) throw new Error(`p2 leader not found: ${params.p2LeaderId}`);

  const p1DeckEntry = deckById.get(params.p1DeckId);
  const p2DeckEntry = deckById.get(params.p2DeckId);
  if (!p1DeckEntry) throw new Error(`p1 deck not found: ${params.p1DeckId}`);
  if (!p2DeckEntry) throw new Error(`p2 deck not found: ${params.p2DeckId}`);

  const p1DeckCards = expandDeck(p1DeckEntry.cards, cardMetaById);
  const p2DeckCards = expandDeck(p2DeckEntry.cards, cardMetaById);

  // DB 書込 (guest/admin/monitor はスキップ)
  let sessionId: number;
  if (isGuest() || isAdmin() || isMonitor()) {
    sessionId = -Date.now(); // synthetic id, 負値で「ローカル専用」を示す
  } else {
    const { data, error } = await supabase
      .from('battle_sessions')
      .insert({
        player1_id: params.childId,
        player1_leader: params.p1LeaderId,
        player1_deck_id: params.p1DeckId,
        player2_id: 'ai',
        player2_leader: params.p2LeaderId,
        player2_deck_id: params.p2DeckId,
        difficulty: params.difficulty,
        turn_count: 0,
        duration_seconds: 0,
        alt_earned: 0,
      })
      .select('id')
      .single();
    if (error || !data) {
      console.warn('[battleService] startBattle insert failed:', error?.message);
      sessionId = -Date.now();
    } else {
      sessionId = (data as { id: number }).id;
    }
  }

  const initialState = createInitialState(
    String(sessionId),
    params.childId,
    p1Leader,
    p1DeckCards,
    p2Leader,
    p2DeckCards,
    params.difficulty,
  );

  return { sessionId, initialState };
}

/**
 * セッションを終局結果で更新。
 * guest/admin/monitor または synthetic sessionId (負値) の場合はスキップ。
 */
export async function finishBattle(
  sessionId: number,
  result: BattleResult,
): Promise<void> {
  if (sessionId < 0) return;
  if (isGuest() || isAdmin() || isMonitor()) return;

  const { error } = await supabase
    .from('battle_sessions')
    .update({
      winner: result.winner,
      turn_count: result.turnCount,
      duration_seconds: result.durationSeconds,
      alt_earned: result.altEarned,
      state_snapshot: result.finalState,
    })
    .eq('id', sessionId);
  if (error) {
    console.warn('[battleService] finishBattle failed:', error.message);
  }
}

/**
 * リーダーのカード画像 URL を取得。
 * battle_leaders.image_url をそのまま使うが、null/空文字ならフォールバック。
 */
export function leaderImageUrl(leader: BattleLeaderRow | null | undefined): string {
  if (!leader) return '';
  return leader.image_url?.trim() || '';
}
