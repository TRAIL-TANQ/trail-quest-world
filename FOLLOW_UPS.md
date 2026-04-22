# FOLLOW_UPS.md

**プロジェクト**: TRAIL QUEST WORLD (TQW)
**作成日**: 2026-04-22 (Phase 1 完成時点)
**用途**: スコープ外 or 後回し確定になった技術債務 / 再設計候補 / 追調査項目の一元管理

---

## 読み方

- `ID`: 追跡用の一意 ID (FU-XXX)。コミットメッセージや issue から参照できる
- `Status`: `open` / `planned` (着手予定) / `done` / `wontfix`
- `Priority`: `P1` (次スプリント推奨) / `P2` (Phase 2 内) / `P3` (Phase 3 以降)
- `Owner`: 明示されていれば記入、無ければ未定

---

## 🔴 P1 — 次スプリント以内に片付けたい

### FU-001: children / users / schools テーブル orphan 整理
- **Status**: open
- **Priority**: P1
- **Origin**: 0032 / 0033 / 0036 の diagnostic で判明
- **内容**:
  - 3 テーブルとも migration 管理外で Supabase Studio 経由で作成された痕跡
  - 全て空 (kk 診断で確認) かつ app コードから参照ゼロ
  - しかし他テーブル (child_status / diagnoses / daily_missions / parent_reports / quiz_attempts) から FK で参照されていた (現在は全て撤廃済み)
- **決着案**: 3 テーブルを DROP TABLE ... CASCADE で削除 → baseline 化 migration を追加
- **リスク**: 今後 children テーブルを再利用する予定があれば慎重に。kk に確認要

### FU-002: chat_logs ↔ diagnoses FK 再設計
- **Status**: open
- **Priority**: P1
- **Origin**: 0036 で FK `chat_logs_diagnosis_id_fkey` を DROP
- **内容**:
  - chat_logs 24 行は全て `diagnosis_id = NULL` で論理的に孤立
  - diagnoses テーブルは dormant skeleton (id + child_id + created_at のみ)
  - chat_logs の正体が不明 (進路相談 AI のログと推測)
- **決着案**:
  - (a) chat_logs の実運用を確認 → 不要なら DROP
  - (b) 運用継続なら diagnoses の本来仕様を定義 (FU-005 と合流) → FK を正しく張り直す

### FU-003: DROP+CREATE migration 後の RLS ENABLE 再入問題
- **Status**: open (根本原因不明)
- **Priority**: P1 (再発リスクあり)
- **Origin**: 0033 Path Z 適用後、child_status の RLS が意図せず ENABLE + policy 0 件で anon 完全拒否状態になっていた (0036 push 後に発覚)
- **仮説**:
  - Supabase Studio GUI で誰かが「Enable RLS」を押した
  - Studio の新規テーブル作成フローに既存テーブル巻き込みトリガーがある
  - Supabase バックエンド側のデフォルト変更 (通知なし)
- **決着案**:
  1. 恒久 migration 0037 で `ALTER TABLE public.child_status DISABLE ROW LEVEL SECURITY` を明示再適用 (既に暫定実行済み、migration 化は未)
  2. 全 text child_id テーブル (gacha_pulls / user_profile / quest_progress / quiz_history / alt_game_scores 等) の RLS 状態を pg_tables で網羅確認 → 同じ被害の有無確認
  3. Supabase Studio 側の挙動再現試験 (時間あれば)

### FU-004: 他テーブルの RLS 状態網羅確認
- **Status**: open
- **Priority**: P1
- **Origin**: FU-003 と同じ
- **クエリ案**:
  ```sql
  SELECT t.tablename, t.rowsecurity AS rls_enabled,
    (SELECT count(*) FROM pg_policies p
      WHERE p.schemaname=t.schemaname AND p.tablename=t.tablename) AS policy_count
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'child_status','gacha_pulls','user_profile','quest_progress',
      'quiz_history','alt_game_scores','battle_history','owned_skins',
      'pin_codes','shop_items','hall_of_fame','user_decks'
    )
  ORDER BY t.tablename;
  ```
- **期待**: `rls_enabled = true AND policy_count = 0` の行がゼロ。あれば FU-003 に合流して 0037 で一括 DISABLE 復元

---

## 🟡 P2 — Phase 2 に織り込み

### FU-005: dormant 3 テーブル (daily_missions / diagnoses / parent_reports) の本来仕様定義
- **Status**: open
- **Priority**: P2
- **Origin**: 0036 で最小 skeleton (id + child_id + created_at) で再作成済み
- **内容**:
  - daily_missions: `useMissionStore` (client 側) は MOCK_DAILY_MISSIONS 前提で動作、DB 永続化なし → 教室運用で「昨日のミッション達成」が翌日残らない
  - diagnoses: AI 進路相談用? (chat_logs との関係含めて要定義)
  - parent_reports: 現状 weekly_reports が主実装系、parent_reports は何が違うのか不明
- **決着案**: 各テーブルの用途を kk / 教室運用担当と確認 → カラム拡張 migration + RLS ポリシー + client service 層

### FU-006: child_status の恒久 RLS 方針
- **Status**: open (暫定は DISABLE)
- **Priority**: P2
- **Origin**: FU-003 の暫定措置として DISABLE 復元済み
- **決着案**:
  - Supabase Auth 導入が前提。auth.uid() が使えるようになったタイミングで `child_id_own` ポリシー (auth.uid() = JOIN children.id) を再設計
  - 現状 anon 直アクセスで pin-based auth 運用なので、RLS で「自分の row のみ」制約は技術的に不可能

### FU-007: altBalance 共通化 (useAltBalance hook)
- **Status**: open
- **Priority**: P2
- **Origin**: Commit G で ShopPage と MarketPage が同じ fetchChildStatus → setAltBalance 経路を持つことが発覚
- **内容**: `hooks/useAltBalance.ts` を新設、`{ altBalance, setAltBalance, refetch }` を返す
- **影響範囲**: ShopPage / MarketPage / GachaPage / QuestLearningUnitPage / QuizPracticePage / KnowledgeChallenger / TimeAttackPage / ShopBuy / ShopSell (現状 7+ 箇所に似たロジックが散在)

### FU-008: Dependabot 警告 47 件
- **Status**: open
- **Priority**: P2 (security)
- **Origin**: git push のたびにリモートから警告 (high=16 / moderate=30 / low=1)
- **リンク**: https://github.com/TRAIL-TANQ/trail-quest-world/security/dependabot
- **決着案**:
  1. まず high=16 を優先対処 (pnpm update / upgrade / override で個別対応)
  2. moderate=30 はまとめてバッチ対応
  3. low=1 はスコープ判断後

### FU-009: BottomNav モバイル 6 タブ将来対応
- **Status**: done (現状 OK) / watchlist
- **Priority**: P3
- **Origin**: Commit G で 5 → 6 タブ化、モバイル実機で崩れなし確認済み
- **内容**: 7 タブ以上に増やす場合、`max-width: 430px` では崩壊必至
- **決着案 (先行)**:
  - ラベル非表示 (アイコンのみ) モード
  - 「その他」タブでドロワー展開
  - タブ個別カスタマイズ (favorited 4 + more)

### FU-010: HTML バグ `<a>` cannot contain nested `<a>`
- **Status**: open
- **Priority**: P3
- **Origin**: F12 Console 警告 (kk 報告、別件)
- **調査**: どのコンポーネントか未特定。wouter `<Link>` 入れ子を疑う
- **決着案**: 警告発生ページを特定 → HTML 構造見直し

---

## 🟢 P3 — Phase 3 以降 / 未確定

### FU-011: 既存プレイヤーの localStorage ALT → child_status.alt_points 移行
- **Status**: open
- **Priority**: P3
- **Origin**: 0033 コメント欄
- **内容**: 以前は UUID ガードで DB 書き込みが silent skip されていたため、localStorage にしか ALT 残高が存在しないプレイヤーが存在する可能性
- **決着案**: 起動時に `localStorage.kc_child_status_<childId>` と DB `child_status.alt_points` を比較、DB が 0 で localStorage に値があれば 1 回限りの merge. 今は Phase 1 リリース前でユーザーベース小なので優先度低

### FU-012: Schema management 全体見直し
- **Status**: open
- **Priority**: P2/P3 (運用で決める)
- **Origin**: 今回の一連の作業で判明
- **内容**:
  - Supabase Studio 経由の手動テーブル作成が migration と drift 発生源
  - 教訓: **全テーブルは migration 経由で作成**、Studio GUI は SELECT 参照のみに運用ルール化
- **決着案**: `CONTRIBUTING.md` / `CLAUDE.md` に明文化、レビュー時の check list に加える

### FU-013: v12 すりガラス風デザインのガイドライン化
- **Status**: open
- **Priority**: P3
- **Origin**: Commit G で BottomNav に適用した `.tqw-card-panel` 系デザイン
- **内容**: 他のナビ / ヘッダー / カード部品にも段階展開する際、色・blur 値を決定ファイル (`tokens.css` or `index.css` 変数化) で統一
- **決着案**: デザインシステム spec に `--tqw-glass-bg` / `--tqw-glass-blur` / `--tqw-glass-border` を定義、各コンポーネントが参照

---

## 📚 STUDY_GAME_SPEC 関連 FOLLOW_UPS (Phase A/B/C の scope 外に明示)

### FU-014: パネル破壊アクセシビリティ
- **Status**: open
- **Priority**: P2 (パネル破壊 Phase C 実装後)
- **内容**:
  - 色弱対応: コンボ表示 / 破壊エフェクトの色以外のマーキング (パターン / 形状)
  - 振動無効: iOS / Android の haptic feedback を個別 OFF できる設定
  - 長押し選択モード: クイックタップ → 長押し切替オプション

### FU-015: subject enum マイグレーション設計
- **Status**: open
- **Priority**: P3 (多教科展開時)
- **内容**: `subject TEXT` を運用初期は柔軟性のため text、教科数固定後に ENUM 化
- **決着案**: Phase E 着手時に subject の集計 (unique 値リスト) → enum migration 設計

### FU-016: 教師ダッシュボードの誤答可視化画面
- **Status**: planned (Phase B スコープに明記済み)
- **Priority**: P2 (Phase B)
- **内容**:
  - 生徒ごとの誤答パターン頻度
  - 問題ごとの誤答ディストラクタ分布
  - 時系列での誤答改善曲線
- **具体画面仕様**: kk 教室運用を踏まえて後日追加

---

## 運用ルール

- 新しい follow-up を発見したら末尾に FU-XXX として追記
- 解消したら Status を `done` に更新し、該当コミット hash を記録
- `wontfix` にする場合は理由を明記

---

## 関連

- [STUDY_GAME_SPEC.md](./STUDY_GAME_SPEC.md) — 勉強ゲーム強化仕様
- [CARD_MARKET_SPEC.md](./CARD_MARKET_SPEC.md) — カード市場仕様
- [NUCLEAR_BOSS_DECK_SPEC.md](./NUCLEAR_BOSS_DECK_SPEC.md)
- [DECK_QUEST_SPEC.md](./DECK_QUEST_SPEC.md)
- [CARD_TYPE_SYSTEM_SPEC.md](./CARD_TYPE_SYSTEM_SPEC.md) *(untracked)*
