# 4デッキ選択制 + デッキクエスト仕様書 v1.2（実装同期版）

**作成日**: 2026-04-21
**確定日**: 2026-04-21
**実装サイクル完了**: 2026-04-21（Commits 1-5 push 済み）
**ステータス**: 実装済み（§11 完了サマリー / §12 残タスク参照）
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
クイズ 10問（QUESTIONS_PER_SESSION=10、累計5正解で beginner.cleared=true）
    ↓（クリアでアンロック）
敵デッキ戦（実装済み Commit 1 `3cfa0ac`）
    ↓（勝利で battleCleared=true & MyDeck 自動追加 — Commit 2 `6501722`）
    ↓（敗北時は即再挑戦 — Commit 3 `0fedc58`）
マイデッキに追加（MyDeck.sourceDeckKey で識別）
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
→ **実装現状を正とする（kk 2026-04-21 commit-after 判断）**
- 実装: `QUESTIONS_PER_SESSION = 10` 問 / セッション、`CLEAR_THRESHOLD = 5`（累計正解 5 で `beginner.cleared = true`）。
- 1セッション内で 50% 取れなかった場合も、累計でクリア閾値に達すれば解放扱い（連続学習を促す）。
- 当初 spec の「B. 80%以上」案は廃案。実装変更は行わず、本仕様書を実装に合わせて同期した（Commit 4）。
- 関連: `QuizPracticePage.tsx` L28 / `questProgress.ts` L103。

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
| — | `docs(deck-quest): finalize Q1-Q7 decisions in spec` | ✅ `35c76da` |
| 2 | `feat(deck-quest): connect quiz victory to enemy deck battle` | ✅ `3cfa0ac` |
| 3 | `feat(deck-quest): victory grants deck ownership` | ✅ `6501722` |
| 4 | `feat(deck-quest): defeat allows immediate retry` | ✅ `0fedc58` |
| 5 | `docs(deck-quest): sync spec with implementation` | ✅ 本 commit |

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
5. ✅ Commit 2: クイズ → 敵デッキ戦の接続（commit `3cfa0ac`）
6. ✅ Commit 3: 勝利 → デッキ獲得（commit `6501722`）
7. ✅ Commit 4: 敗北 → 即再挑戦（commit `0fedc58`）
8. ✅ Commit 5: 仕様書同期（本 commit）
9. ⏸ §12 残タスクを順次着手（別日）

---

## 11. 実装完了サマリー (2026-04-21)

### 動線フロー（実装後）

```
1. /games/quiz/:deck/:difficulty
   → クイズ 10問 → 累計5正解で beginner.cleared=true
   → 結果画面に「⚔️ {デッキ}デッキ戦へ挑戦」ボタン表示

2. /games/knowledge-challenger?mode=quest&enemyDeck=<deckKey>
   → questMode useMemo がパース
   → quest auto-start useEffect:
        playerStarter = STARTER_DECKS[getFirstDeckGift()]
        aiStarter     = STARTER_DECKS[enemyDeck]
        startGame(playerStarter, undefined, aiStarter)

3. バトル決着 → screen='result'
   3a. 勝利: questVictoryHandled hook
        - markBattleCleared(enemyDeck) → progress[deckKey].battleCleared=true
        - addOwnedDeckIfMissing(userId, enemyDeck) → MyDeck 自動追加
            → sourceDeckKey 重複なら skip / getFirstDeckGift 一致で isMain=true
        - toast: 「🎉 {デッキ}デッキをマスター！...」
   3b. 敗北: 結果画面に「⚔️ {デッキ}デッキに もう一度挑戦」prominent button
        - handleQuestRetry → in-place で startGame 再発火（URL 遷移なし）
        - questVictoryHandledRef リセットで次回勝利時 hook 再発火可能
```

### データモデル拡張

`MyDeck` 型 (`client/src/lib/myDecks.ts`):
```ts
interface MyDeck {
  // 既存フィールド (id, child_id, deck_name, cards, created_at, updated_at)
  isMain?: boolean;          // メインデッキフラグ（getFirstDeckGift 一致で自動 true）
  sourceDeckKey?: DeckKey;   // 起源 starter デッキ
  unlockedAt?: string;       // ISO datetime
}
```

`DeckQuestProgress` (`client/src/lib/questProgress.ts`):
```ts
interface DeckQuestProgress {
  beginner: ...; challenger: ...; master: ...; legend: ...;
  battleCleared?: boolean;   // 敵デッキ戦勝利フラグ
}
```

### 主要 helper

| 関数 | ファイル | 役割 |
|---|---|---|
| `markBattleCleared(deckKey)` | `questProgress.ts` | battleCleared 永続化、初回 true 返却 |
| `isBattleCleared(progress, deckKey)` | `questProgress.ts` | フラグ参照 |
| `createMyDeckFromStarter(childId, deckKey, opts)` | `myDecks.ts` | starter → MyDeck 変換 |
| `addOwnedDeckIfMissing(childId, deckKey)` | `myDecks.ts` | sourceDeckKey 重複検出 + isMain 自動判定 |

---

## 12. 残タスク（別日）

| # | 項目 | 優先度 | メモ |
|---|---|---|---|
| 1 | デッキビルダー画面で「獲得済み quest デッキ」セクション表示 | 🔥 | `MyDeck.sourceDeckKey` ベースで分類、メインデッキを強調 |
| 2 | メインデッキ切替 UI（マイデッキ画面） | 🟡 | `isMain` を 1 デッキだけ true にする排他ロジック |
| 3 | クエスト戦勝利時の演出（モーダル/紙吹雪/SE） | 🟡 | 現状は toast のみ |
| 4 | ALT 報酬の追加（勝利時） | 🟢 | spec Q2-A で「マイデッキ追加のみ」確定済、後日再判断 |
| 5 | Phase 2 新ルート案 `/games/deck-quest/:deckKey`（学習→クイズ→戦闘の状態機械） | 🟢 | 現状 a 案（既存ルート活用）で十分機能、UX 改善時に検討 |
| 6 | 難易度選択（敵 CPU 強さ可変化） | 🟢 | spec Q7-A で「固定難易度」確定済 |
| 7 | 初回プレゼント時にも `MyDeck` を自動作成（`claimFirstDeck` 拡張） | 🟡 | 現状はクエスト勝利を経由しないと MyDeck エントリが作られない |
| 8 | `battleCleared` の Supabase 同期 | 🟢 | `quest_progress` テーブルに column 追加 or 別テーブル |
| 9 | 「敵デッキ戦へ」ボタンの表示条件を厳密化 | 🟢 | 現状は cleared 全デッキで表示。MAIN_DECK_KEYS 限定にするか検討 |

---

## 変更履歴

- 2026-04-21 v1 (draft, commit `e469874`): Claude Code が kk 指示に基づき初版作成。§2.2 の4デッキは候補A暫定。
- 2026-04-21 v1.1 (確定, commit `35c76da`): kk Q1-Q7 回答承認。候補A確定 (§2.2)、Q1=B/Q2=C/Q3=C/Q4=B/Q5=B/Q6=A/Q7=A 反映。Commit 1 進捗追記。
- 2026-04-21 v1.2 (本 commit): 実装サイクル完了に伴う仕様同期。§3.3 クイズ問題数を実装値（10問）に修正、Q4 を実装現状（累計5正解）に廃案差し替え、§8 進捗テーブル更新、§11 実装完了サマリー追加、§12 残タスク追加。
