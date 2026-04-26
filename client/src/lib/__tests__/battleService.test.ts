// ============================================================================
// battleService.test.ts
// Phase 6c-1: CARD_NAME_MAP / getCardName のユニットテスト
// ============================================================================
//
// scope: cardId → 日本語表示名解決の動作確認のみ。Supabase 通信や
// expandDeck などのランタイム処理はカバーしない (E2E or 別テスト想定)。

import { describe, it, expect } from 'vitest';
import { CARD_NAME_MAP, getCardName } from '../battleService';

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
