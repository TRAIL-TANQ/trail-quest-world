// ============================================================================
// battleValidator.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP
// デッキ構築バリデーション
// ============================================================================
//
// 責務:
//   - デッキ構築時の構文チェック (枚数 / 色制限 / 同名上限 / リーダー未設定)
//   - 全エラーを集めて返す (最初のエラーで停止しない)
//
// 非責務 (B3 側で処理):
//   - applyAction 内の実行時合法性チェック (コスト/手札存在/ボード満杯等)
//
// 将来の拡張余地:
//   - プリセットデッキの DB 整合性検証
//   - カスタムデッキ構築画面 (v2.0.1+) での即時検証
// ============================================================================

import type {
  BattleCardInstance,
  BattleColor,
  DeckValidationResult,
} from './battleTypes';

// ---- 定数 ------------------------------------------------------------------

export const DECK_SIZE_EXPECTED = 30; // v2.0-launch: デッキは 30 枚ちょうど
export const MAX_COPIES_PER_CARD = 4; // 同名カード (= 同 cardId) の上限

// ---- 型 --------------------------------------------------------------------

/**
 * leader 引数に使える最小型。BattleLeaderRow / LeaderState の両方を受け付ける。
 */
type LeaderColorLike = { color: BattleColor };

// ---- 公開 API --------------------------------------------------------------

/**
 * デッキ構築バリデーション。
 *
 * チェック内容 (全て同時実施、最初のエラーで停止しない):
 *   1. leader 未設定 → 'leader_not_set'
 *   2. 合計枚数 != 30 → 'wrong_total' (actual / expected)
 *   3. 色制限: card.color が leader.color でも 'colorless' でもない → 'color_violation'
 *      (同じ cardId による重複報告はしない)
 *   4. 同 cardId のカードが 4 枚超 → 'count_exceeded' (1 cardId につき 1 回のみ報告)
 *
 * @param deckCards - デッキを構成するカードインスタンス配列 (30 枚ちょうどを期待)
 * @param leader - リーダー情報 (color フィールドがあれば何でも可)
 */
export function validateDeckBuild(
  deckCards: BattleCardInstance[] | null | undefined,
  leader: LeaderColorLike | null | undefined,
): DeckValidationResult {
  const errors: DeckValidationResult['errors'] = [];
  const cards = deckCards ?? [];
  const totalCards = cards.length;

  // 1. leader 未設定
  if (!leader) {
    errors.push({ code: 'leader_not_set' });
  }

  // 2. 合計枚数
  if (totalCards !== DECK_SIZE_EXPECTED) {
    errors.push({
      code: 'wrong_total',
      actual: totalCards,
      expected: DECK_SIZE_EXPECTED,
    });
  }

  // 3. 色制限 (leader がある場合のみ実施)
  if (leader) {
    const reportedColorViolations = new Set<string>();
    for (const card of cards) {
      if (reportedColorViolations.has(card.cardId)) continue;
      if (card.color !== leader.color && card.color !== 'colorless') {
        errors.push({
          code: 'color_violation',
          cardId: card.cardId,
          cardColor: card.color,
          leaderColor: leader.color,
        });
        reportedColorViolations.add(card.cardId);
      }
    }
  }

  // 4. 同名 (= 同 cardId) 上限
  const counts = new Map<string, number>();
  for (const card of cards) {
    counts.set(card.cardId, (counts.get(card.cardId) ?? 0) + 1);
  }
  counts.forEach((count, cardId) => {
    if (count > MAX_COPIES_PER_CARD) {
      errors.push({
        code: 'count_exceeded',
        cardId,
        count,
        max: MAX_COPIES_PER_CARD,
      });
    }
  });

  return {
    isValid: errors.length === 0,
    totalCards,
    errors,
  };
}

// ---- 補助ユーティリティ ----------------------------------------------------

/**
 * deckCards から cardId 別の枚数 Map を返す。
 * UI (デッキ一覧表示など) の集計に利用想定。
 */
export function tallyDeckByCardId(
  deckCards: BattleCardInstance[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of deckCards) {
    counts.set(card.cardId, (counts.get(card.cardId) ?? 0) + 1);
  }
  return counts;
}
