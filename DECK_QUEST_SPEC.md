# 4デッキ選択制 + デッキクエスト仕様書 v1（ドラフト）

**作成日**: 2026-04-21
**ステータス**: ドラフト（kk Q1-Q7 回答待ち）
**作成**: Claude Code（kk 指示に基づく）

---

## 1. 背景

**現状**:
- デッキ獲得フロー = クイズ正解5問/難易度 → 解放
- 初回プレゼント = 解放済み5デッキから1つ選択（`KnowledgeChallenger.tsx` L3067-3232）
- クエストボード = デッキ別×難易度別（beginner/challenger/master/legend）のクイズ進捗
- マイデッキ = 15枚×最大3デッキを自由構築（`myDecks.ts`）

**課題**:
- 学習と実戦の分離: カルーセル学習 → クイズ → 解放、だが「そのデッキと戦って勝つ」フェーズが不在
- 継続的プレイ動機の弱さ: メインデッキ概念がなく、愛着形成の要素が薄い
- 初期選択の肥大: 現 5 デッキ → 認知負荷（「4デッキ選択制」への圧縮で解消）

---

## 2. 基本設計

### 2.1 ユーザー登録時フロー

```
ユーザー登録
    ↓
4デッキ紹介（カルーセル or 一覧）
    ↓
1つ選択
    ↓
メインデッキとして確定
    ↓
そのデッキでゲームスタート
```

### 2.2 4デッキの候補（🔴 kk 確認必須 — TBD）

**コード内に「4デッキ」という明示的グルーピングは存在しない**ため、kk 指定が必要。

**Claude Code 推奨: 候補A**

| # | DeckKey | 日本語 | 戦略 | テーマ性 |
|---|---|---|---|---|
| 1 | `nobunaga` | 信長 | 鉄砲スタック + 馬防柵防御 | 戦国時代 |
| 2 | `jeanne` | ジャンヌ・ダルク | 聖剣/盾 + 進化 | 中世フランス |
| 3 | `amazon` | アマゾン | ピラニア群れ + アナコンダ進化 | 生態系 |
| 4 | `qinshi` | 始皇帝 | 万里の長城 + 焚書坑儒 | 古代中国 |

**除外理由**:
- `murasaki`（紫式部）: 5番目に追加、テーマが他の4と被らず「4択」にすると4と5の差別化が曖昧
- `napoleon` 以下5デッキ: `DECK_AVAILABILITY=false` で一般ユーザー提供不可

**代替候補**:
- 候補B: 5デッキそのまま（= 仕様変更不要、「4」ではなく「5」）
- 候補C: テーマ地域性重視 `nobunaga, qinshi, napoleon, amazon`（ただし napoleon は準備中）

→ **kk が 4 の中身を確定次第、本節を書き換え**

### 2.3 メインデッキ制度

- プレイヤーは選択した 1 デッキをメインとして戦い続ける
- アイデンティティ形成: プロフィール・ランキングに「◯◯使い」バッジ
- 愛着と継続性: 愛着デッキ強化フロー（ガチャ/進化/SSR解放）が集中

---

## 3. デッキクエスト仕様

### 3.1 解放フロー（3ステップ）

```
Step 1: カルーセル学習 → クイズ正解
   ↓（既存: QuestLearningUnitPage + QuestPracticePage）
Step 2: そのデッキ（敵 AI）と戦って勝つ  ← 新規実装
   ↓（メインデッキで挑む）
Step 3: マイデッキ一覧に追加
   ↓（既存: myDecks.ts 拡張）
```

### 3.2 バトルボタン（既存、変更なし）

現状の `KnowledgeChallenger`（バトル画面）の動線を維持。

### 3.3 デッキクエスト（新規 or 変更）

**新規タブ/ページ**:
```
デッキクエスト一覧
    ↓（カードタップ）
カルーセル学習（既存）
    ↓（次へ）
クイズ 5問（既存）
    ↓（正解でアンロック）
敵デッキ戦（新規）    ← Phase 3
    ↓（勝利で解放）
マイデッキに追加（既存拡張）
```

### 3.4 既存実装との統合点

| 機能 | 既存ファイル | 新規作業 |
|---|---|---|
| カルーセル学習 | `QuestLearningUnitPage.tsx`, `questUnits.ts`, `LEARNING_CARDS` | 4デッキに絞り込む UI フィルタ |
| クイズ | `QuestPracticePage.tsx`, `questQuizData.ts` | なし |
| 敵デッキ戦 | `KnowledgeChallenger.tsx`（汎用バトル） | クエスト専用エントリー（固定敵デッキ・勝利フラグ記録） |
| マイデッキ追加 | `myDecks.ts`, `DeckBuilderPage.tsx` | 「デッキ取得済み」状態の UI/状態管理 |

---

## 4. マイデッキ一覧

### 4.1 表示構造

```
[メインデッキ]        ← 選択済み、強調枠
  🔥 信長デッキ
  15枚 / SSR 1 / SR 2

[獲得済みデッキ]      ← クエストクリアで追加
  🗡️ ジャンヌデッキ
  🌿 アマゾンデッキ

[未獲得デッキ]        ← ロック状態
  🏛️ 始皇帝デッキ（🔒 クエスト未挑戦）
```

### 4.2 データ構造拡張

既存 `MyDeck` 型（`myDecks.ts`）に以下を追加：
```ts
export interface MyDeck {
  id: string;
  child_id: string;
  deck_name: string;
  cards: MyDeckCardEntry[];
  created_at: string;
  updated_at: string;
  // 新規:
  isMain?: boolean;            // メインデッキフラグ（1ユーザー1つ）
  sourceDeckKey?: DeckKey;     // 起源となる starter デッキ
  unlockedAt?: string;         // クエストクリア日時
}
```

---

## 5. 実装への影響

| 領域 | 影響 | 見積 |
|---|---|---|
| ユーザー登録フロー | 初回プレゼント UI を「4デッキ選択」に変更 | 2-3h |
| ホーム画面 | メインデッキバッジ追加、「デッキクエスト」タブ新設 | 2-4h |
| カルーセル学習 | 既存を4デッキに絞るフィルタ | 1-2h |
| クイズ → 敵デッキ戦 接続 | `QuestPracticePage` クリア後に戦闘画面へ遷移 | 3-5h |
| 敵デッキ戦（Phase 3） | クエスト専用 `KnowledgeChallenger` モード、固定シード、勝利時 `markDeckUnlocked` | 4-6h |
| マイデッキ拡張 | `isMain` / `sourceDeckKey` フィールド、メインデッキ切替 UI | 3-4h |
| DB マイグレーション | `user_decks.is_main`, `source_deck_key` カラム追加 | 1h |
| 既存プレイヤー移行 | 初期スターターデッキを自動的にメインに設定（Q5） | 2-3h |

---

## 6. kk 判断事項（実装前に確定必要）

### Q1: メインデッキ変更可能？
- **A.** 固定（一度選んだら変更不可）
- **B.** 獲得済みデッキの中から切替可（推奨: バランス的に妥当）
- **C.** 全デッキ使用可能（メインデッキ概念が弱まる）

### Q2: 獲得デッキの使い道
- **A.** 観賞用のみ（コレクション要素）
- **B.** 対戦でも使える（メインは変えられないが、戦闘時に選択可）
- **C.** メインデッキ切替可能（= Q1-B と整合）

### Q3: カルーセル学習の実装状態
- ✅ **A.** 既に実装済み（`QuestLearningUnitPage.tsx` + `LEARNING_CARDS`、全10デッキ分コンテンツあり）
- 備考: 4デッキに絞る UI フィルタのみ必要

### Q4: クイズの合格条件
- 現状: 難易度ごとに **5問正解**（累計）で難易度クリア
- **A.** 全問正解必須（厳しめ）
- **B.** 80%以上
- **C.** 現状維持（5問累計）← 推奨

### Q5: 既存プレイヤーのデータ扱い
- **A.** リセット（全員選び直し）— 不親切
- **B.** 保持（現状の獲得デッキ維持、メインは最初に選んだ初回プレゼントデッキ）← 推奨
- **C.** マイグレーション（最もプレイ時間が長いデッキを自動的にメインに）

### Q6: デッキクエストの入り口
- **A.** ホーム画面の専用タブ ← 推奨
- **B.** バトル画面に統合
- **C.** 別ページ（現状 `QuestBoardPage` の拡張）

### Q7: 敵 CPU の強さ（Step 2 敵デッキ戦）
- **A.** 固定難易度（推奨: 初学者に優しい）
- **B.** プレイヤーレベル依存
- **C.** 難易度選択（beginner/challenger/master/legend と連動）

---

## 7. 実装工数見積

| Phase | 内容 | 工数 |
|---|---|---|
| Phase 1 | 4デッキ確定 + 初回プレゼント UI 改修 | 2-3h |
| Phase 2 | マイデッキ型拡張 + メインデッキ機構 | 4-6h |
| Phase 3 | 敵デッキ戦（クエスト専用モード） | 6-8h |
| Phase 4 | クイズ → 敵デッキ戦 接続 | 3-5h |
| Phase 5 | マイデッキ一覧 UI 刷新 | 3-4h |
| Phase 6 | 既存プレイヤー移行 | 2-3h |
| Phase 7 | DB マイグレーション + テスト | 2-4h |
| **合計** | | **22-33h（約 3-5 営業日）** |

---

## 8. 実装優先度

### 現在の優先順位（2026-04-21 時点）

1. 🔥 武器スタック修正（完了、commit `1249bac`）
2. 🔥 楽市楽座 + 信長連動（完了、commit `f8a956e`）
3. 🟡 武器キャラ連動・防御時のみ（次、kk Q1-Q3 判断待ち）
4. 🟡 核ボス効果実装（9件の【未実装】effect ロジック）
5. ⏸ **本仕様書の実装** ← kk 判断待ち
6. 🟢 カード分類 Phase 1-5（`CARD_TYPE_SYSTEM_SPEC.md`）

### 本仕様書の実装タイミング

**kk 判断待ち**:
- Q1-Q7 回答後、4デッキ確定 → 段階的 commit（Phase 1 から順）
- 核ボスデッキの完成タイミング（NUCLEAR_BOSS_DECK_SPEC.md）との並行可

---

## 9. 関連ファイル

### 既存実装
- `client/src/lib/questProgress.ts` — DeckKey / DECK_AVAILABILITY / QuestProgress
- `client/src/lib/stages.ts` — STARTER_DECKS（10デッキ + random）
- `client/src/lib/questUnits.ts` — QUEST_UNITS + LEARNING_CARDS
- `client/src/lib/questQuizData.ts` — デッキ別クイズセット
- `client/src/lib/myDecks.ts` — マイデッキ構築・所持判定
- `client/src/pages/KnowledgeChallenger.tsx` L3067-3232 — 初回プレゼント UI
- `client/src/pages/QuestBoardPage.tsx` — クエストボード
- `client/src/pages/QuestLearningUnitPage.tsx` — カルーセル学習
- `client/src/pages/QuestPracticePage.tsx` — クイズ
- `client/src/pages/DeckBuilderPage.tsx` — マイデッキ構築

### 影響のある Supabase テーブル
- `user_decks` — マイデッキ保存（マイグレーション 0009）
- （新規予定）`user_main_deck` or `user_decks.is_main` カラム追加

---

## 10. 次のアクション（kk 確認用）

1. ✅ Step 1: Claude Code 武器リスト調査完了（前ターン報告済み）
2. ✅ Step 2: 本仕様書ドラフト保存（このコミット）
3. ⏸ Step 3: kk Q1-Q7 回答 + 4デッキ（§2.2）確定
4. ⏸ Step 4: 実装 GO/NO-GO 判断 + Phase 順序承認
5. ⏸ Step 5: Phase 1 から段階的 commit 開始

---

## 変更履歴

- 2026-04-21 v1 (draft): Claude Code が kk 指示に基づき初版作成。§2.2 の4デッキは候補Aを暫定採用、kk 確認待ち。
