# 4デッキ選択制 + デッキクエスト仕様書 v1.1（確定版）

**作成日**: 2026-04-21
**確定日**: 2026-04-21
**ステータス**: 確定（kk Q1-Q7 回答済み・実装開始承認）
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

### 2.2 4デッキ（✅ kk 確定 2026-04-21）

**確定**: 候補A 採用。コード定義は `client/src/lib/questProgress.ts` の
`MAIN_DECK_KEYS` 定数（UI 表示順のソースオブトゥルース）。

| # | DeckKey | 日本語 | 戦略 | テーマ性 |
|---|---|---|---|---|
| 1 | `nobunaga` | 信長 | 鉄砲スタック + 馬防柵防御 | 戦国時代 |
| 2 | `jeanne` | ジャンヌ・ダルク | 聖剣/盾 + 進化 | 中世フランス |
| 3 | `amazon` | アマゾン | ピラニア群れ + アナコンダ進化 | 生態系 |
| 4 | `qinshi` | 始皇帝 | 万里の長城 + 焚書坑儒 | 古代中国 |

**除外扱い**:
- `murasaki`（紫式部）: 解放済みだがメインデッキ候補外 → クエストクリアで獲得する「追加デッキ」
- `napoleon` / `mandela` / `wolf` / `galileo` / `davinci`: `DECK_AVAILABILITY=false`、将来解放時も「追加デッキ」扱い

→ 初回プレゼントで選択できるのは MAIN_DECK_KEYS の 4 つのみ（Commit 1 `ecce995` で実装済み）。

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

## 6. kk 確定事項（2026-04-21 承認）

### Q1: メインデッキ変更可能？
→ **B. 獲得済みデッキの中から切替可**
- 実装: マイデッキ画面に「メインに設定」ボタン。`MyDeck.isMain` フラグを1デッキのみ true。

### Q2: 獲得デッキの使い道
→ **C. メインデッキ切替可能（Q1-B と整合）**
- 実装: 獲得済みデッキも対戦で使用可、メイン切替も自由。

### Q3: カルーセル学習の実装状態
→ **C. 既に実装済み**（`QuestLearningUnitPage.tsx` + `LEARNING_CARDS`、全10デッキ分コンテンツあり）
- 4デッキに絞る UI フィルタのみ必要（Phase 1 スコープ）

### Q4: クイズの合格条件
→ **B. 80%以上で合格**
- 実装: 既存の「5問正解=クリア」を「5問中4問=80%以上」に変更。`CLEAR_THRESHOLD` 前後のロジック要改修。

### Q5: 既存プレイヤーのデータ扱い
→ **B. 保持（現状の獲得デッキ維持）**
- 実装: 既存の初回プレゼント claim を尊重、`MyDeck.isMain` は自動付与（claim 済みの最初のデッキをメインに）。

### Q6: デッキクエストの入り口
→ **A. ホーム画面の専用タブ**
- 実装: 既存 BottomNav か HomePage にメニュー追加。`QuestBoardPage` を 4デッキ表示に絞るか、新規ページを作るかは Phase 5 検討。

### Q7: 敵 CPU の強さ（Step 2 敵デッキ戦）
→ **A. 固定難易度**
- 実装: 各デッキごとに固定の AI デッキシード（stages.ts の既存 starter を流用）。後日可変化検討。

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

## 8. 実装優先度 & 進捗

### 現在の優先順位（2026-04-21 確定時点）

1. ✅ 武器スタック修正（完了、commit `1249bac`）
2. ✅ 楽市楽座 + 信長連動（完了、commit `f8a956e`）
3. 🔥 **本仕様書の実装**（着手中、下記 Phase 進捗参照）
4. 🟡 武器キャラ連動・防御時のみ（kk Q1-Q3 判断待ち）
5. 🟡 核ボス効果実装（9件の【未実装】effect ロジック）
6. 🟢 カード分類 Phase 1-5（`CARD_TYPE_SYSTEM_SPEC.md`）

### 段階的 commit 計画

| Commit | 内容 | 状態 |
|---|---|---|
| 1 | `feat(onboarding): change initial present from 5 to 4 decks` | ✅ `ecce995` |
| — | `docs(deck-quest): finalize Q1-Q7 decisions in spec` | ✅ 本 commit |
| 2 | `feat(deck-quest): enemy deck battle phase` | 🔜 次 |
| 3 | `feat(deck-quest): integrate quest flow (学習→クイズ→戦闘→獲得)` | ⏸ Commit 2 後 |
| 4 | `refactor(deck-quest): polish and testing` | ⏸ 最後 |

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

## 10. 次のアクション

1. ✅ Step 1: 武器リスト調査完了
2. ✅ Step 2: 仕様書ドラフト保存（commit `e469874`）
3. ✅ Step 3: kk Q1-Q7 回答（2026-04-21）+ 4デッキ候補A確定
4. ✅ Commit 1: 初回プレゼント 5→4 変更（commit `ecce995`）
5. 🔜 Commit 2: 敵デッキ戦フェーズ実装（最大タスク）
6. ⏸ Commit 3: 動線統合（学習 → クイズ → 戦闘 → 獲得）
7. ⏸ Commit 4: 仕上げ + テスト

---

## 変更履歴

- 2026-04-21 v1 (draft, commit `e469874`): Claude Code が kk 指示に基づき初版作成。§2.2 の4デッキは候補A暫定。
- 2026-04-21 v1.1 (確定): kk Q1-Q7 回答承認。候補A確定 (§2.2)、Q1=B/Q2=C/Q3=C/Q4=B/Q5=B/Q6=A/Q7=A 反映。Commit 1 進捗追記。
