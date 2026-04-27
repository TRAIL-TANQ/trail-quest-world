// ============================================================================
// battleService.test.ts
// Phase 6c-1: CARD_NAME_MAP / getCardName のユニットテスト
// ============================================================================
//
// scope: cardId → 日本語表示名解決の動作確認のみ。Supabase 通信や
// expandDeck などのランタイム処理はカバーしない (E2E or 別テスト想定)。

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CARD_NAME_MAP,
  clearCardMetaCache,
  getCardEffectText,
  getCardMetaFromCache,
  getCardName,
  setCardMetaCache,
} from '../battleService';
import type { BattleCardMetaRow } from '../battle/battleTypes';

describe('getCardName', () => {
  it('登録済 cardId は対応する日本語表示名を返す', () => {
    // 装備
    expect(getCardName('eq_napoleon_bicorne')).toBe('ナポレオンの三角帽');
    expect(getCardName('eq_jeanne_holysword')).toBe('ジャンヌの聖剣');
    // カウンター
    expect(getCardName('cn_warriors_oath')).toBe('戦士の誓い');
    expect(getCardName('cn_great_wall_shield')).toBe('万里の長城の盾');
    // イベント
    expect(getCardName('ev_honnoji')).toBe('本能寺の変');
    expect(getCardName('ev_lunar_eclipse')).toBe('月蝕');
    // キャラクター
    expect(getCardName('card_oda_nobunaga')).toBe('織田信長');
    expect(getCardName('card_mona_lisa')).toBe('モナ・リザ');
  });

  it('未登録 cardId は cardId 文字列をそのまま返す (デバッグ用フォールバック)', () => {
    expect(getCardName('card_unknown_xyz')).toBe('card_unknown_xyz');
    expect(getCardName('eq_not_in_map')).toBe('eq_not_in_map');
    expect(getCardName('')).toBe('');
  });

  it('CARD_NAME_MAP は 0041/0042/0043 seed の 35 枚 (eq*10 + cn*10 + ev*15) をカバーする', () => {
    const eqIds = Object.keys(CARD_NAME_MAP).filter((k) => k.startsWith('eq_'));
    const cnIds = Object.keys(CARD_NAME_MAP).filter((k) => k.startsWith('cn_'));
    const evIds = Object.keys(CARD_NAME_MAP).filter((k) => k.startsWith('ev_'));
    expect(eqIds.length).toBe(10);
    expect(cnIds.length).toBe(10);
    expect(evIds.length).toBe(15);
  });
});

// ============================================================================
// Phase 6c-3: カードメタ同期キャッシュ (CardDetailModal で effect_text 参照用)
// ============================================================================

function makeMetaRow(
  cardId: string,
  effectText: string | null,
): BattleCardMetaRow {
  return {
    card_id: cardId,
    card_type: 'character',
    cost: 1,
    power: 0,
    attack_power: 1,
    defense_power: 1,
    color: 'colorless',
    is_leader: false,
    effect_text: effectText,
    trigger_type: null,
    counter_value: 0,
    equipment_target_leader_id: null,
    equipment_effect_type: null,
    equipment_effect_data: null,
    event_effect_type: null,
    event_effect_data: null,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('cardMetaCache', () => {
  beforeEach(() => {
    clearCardMetaCache();
  });

  it('未ロード時は getCardMetaFromCache / getCardEffectText が null を返す', () => {
    expect(getCardMetaFromCache('eq_napoleon_bicorne')).toBeNull();
    expect(getCardEffectText('eq_napoleon_bicorne')).toBeNull();
  });

  it('setCardMetaCache 後は cardId で同期取得できる', () => {
    setCardMetaCache([
      makeMetaRow('eq_napoleon_bicorne', 'リーダー攻撃力 +2 (永続)'),
      makeMetaRow('cn_warriors_oath', 'カウンター時 +2'),
    ]);
    expect(getCardMetaFromCache('eq_napoleon_bicorne')?.card_id).toBe(
      'eq_napoleon_bicorne',
    );
    expect(getCardEffectText('eq_napoleon_bicorne')).toBe(
      'リーダー攻撃力 +2 (永続)',
    );
    expect(getCardEffectText('cn_warriors_oath')).toBe('カウンター時 +2');
  });

  it('未登録 cardId は null を返す (キャッシュロード後でも)', () => {
    setCardMetaCache([makeMetaRow('eq_napoleon_bicorne', 'A')]);
    expect(getCardMetaFromCache('eq_unknown')).toBeNull();
    expect(getCardEffectText('eq_unknown')).toBeNull();
  });
});
