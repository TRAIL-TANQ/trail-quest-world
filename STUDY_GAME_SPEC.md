# STUDY_GAME_SPEC.md

**プロジェクト**: TRAIL QUEST WORLD (TQW)
**機能名**: 勉強ゲーム強化 (4択モード + パネル破壊モード)
**バージョン**: **v1.1** (2026-04-22 レビュー反映版)
**作成日**: 2026-04-21 (v1.0)

---

## 📒 変更履歴

| Ver | Date       | Summary |
|-----|------------|---------|
| 1.0 | 2026-04-21 | 初版 (kk 作成) |
| 1.1 | 2026-04-22 | 7 論点レビュー反映: DB 設計改訂、ALT 統合方針、パネル生成アルゴリズム、教師ダッシュボードを Phase B に昇格、初期 60 問ルール |

---

## 🎯 目的と設計哲学

### ビジネス目的
- ALTゲームのリテンション向上
- TRAIL 生徒の自主学習時間の延伸
- 教師ダッシュボードへ「誤答ログ」等の学習データを供給

### 教育目的 (TRAIL 教育スタンスとの整合)
- **面白い! が出発点**: ゲーム性で学習意欲を点火
- **考える力の可視化**: 苦手問題がデータに残る
- **思考力重視**: 単純反復ではなく思考プロセスを問う
- **メタ認知訓練**: 「なぜ間違ったか」を自己分析

### 設計原則
1. 既存4モード温存、新モードは追加
2. 段階的リリース (4択 → パネル破壊)
3. 教科横断 (算数検証 → 国語・地理展開)
4. データ駆動 (誤答パターン DB 蓄積)
5. TRAIL 独自性 (複数正解、探索型)

---

## 🎮 現状の ALTゲーム構成

### 既存4モード (算数)
- 計算バトル / 比較バトル / 分数バトル / 小数バトル

### 課題
- 単純計算のみ、概念理解を問いにくい
- 誤答が記録されず、学習データが活かされない
- 反復止まり、探索や発見の要素がない

---

## 💡 新モード1: 4択クイズモード

### 概要
問題 + 4選択肢の古典的4択。TRAIL では「誤答分析」を教育価値の中心に。

### 基本画面

```
算数 - 4択モード
問題 5/10

  15 × 24 = ?

[A) 340]  [B) 360]
[C) 380]  [D) 410]

残り時間: 20秒
```

### 正解時
```
✅ 正解!
360 が正解です
解説: 15 × 24 = 15 × (20+4) = 300 + 60 = 360
[次の問題へ]
```

### 不正解時
```
❌ 不正解
正解は B) 360
あなたの選択: A) 340
なぜ間違った? → 24 の一の位を忘れた計算ミス
解説: 15 × 24 = 15 × (20+4) = 300 + 60 = 360
[次の問題へ]
```

### 教育的意義: 「誤答の意味」を設計
4つの選択肢は**教育的に意味のある誤答パターン**:

| 選択肢 | 設計意図 |
|-------|---------|
| 正解 (360) | - |
| 340 | 20 の計算ミス |
| 380 | 4 の計算ミス |
| 410 | 位取りミス |

→ どの選択肢を選んだかで「生徒の誤解パターン」が判明

### 難易度
- 初級: 2桁+2桁、簡単な掛け算
- 中級: 2桁×2桁、分数基礎
- 上級: 3桁×2桁、分数・小数混合

### セッション構成
- 10問/セッション
- 問題1つ 30秒
- 正答率 + 総合評価 (S/A/B/C/D)

### ALT 報酬
- 正解 +10 ALT
- パーフェクト +20 ボーナス
- **1日3回まで** (mode=quiz_4choice 単位でカウント、altGameService 統合)

### 拡張機能 (Phase B)
- 「似た問題もう1問」ボタン (苦手克服)
- 「なぜ間違ったか」選択 (メタ認知)
- 復習ノート自動生成

---

## 🧩 新モード2: パネル破壊モード

### 概要
数字パネルから条件を満たす組み合わせを探してタップ破壊。**複数正解・探索型**。

### 基本画面

```
算数 - パネル破壊モード
目標: 24 になる組み合わせを見つけてタップ!

┌────┬────┬────┬────┬────┐
│ 3  │ 7  │ 5  │ 9  │ 2  │
├────┼────┼────┼────┼────┤
│ 8  │ 6  │ 4  │12  │ 1  │
├────┼────┼────┼────┼────┤
│11  │15  │10  │ 7  │ 3  │
└────┴────┴────┴────┴────┘

コンボ: 3連鎖 🔥
残り時間: 0:45 / スコア: 180
```

### ルール
- 5×5 = 25マスの盤面
- 60秒制限
- タップで選択 / 再タップで解除
- 条件満たす組み合わせ → 自動判定 → 破壊 + スコア

### 判定例 (24になる)
- `3 × 8` ✅
- `4 × 6` ✅
- `12 + 12` ✅ (2つ必要)
- `2 × 3 × 4` ✅ (3つ以上も可)

### 破壊演出
1. 光る → パーティクル爆発 → 破壊音
2. 上のパネルが重力で落下 (テトリス的)
3. 空いた列に新パネル生成

### コンボシステム

| コンボ数 | 倍率 |
|---------|------|
| 1連鎖 | 1.0x |
| 2連鎖 (3秒以内) | 1.5x |
| 3連鎖 | 2.0x |
| 4連鎖 | 3.0x |
| 5連鎖以上 | 5.0x |

### お題バリエーション
- **数値目標**: 「24になる」「100超え」「素数3つ」
- **概念系**: 「公倍数」「約数4つ以上」「平方数」
- **応用**: 「3桁の数字を作る」「分数で1/2 超」

### 難易度
- 初級: 3×3, 30秒, 和差のみ
- 中級: 4×4, 60秒, 四則演算
- 上級: 5×5, 90秒, 素数・約数
- 超級 (Phase B): 時間無制限, ランキング競争

### ALT 報酬
- 破壊 +5 ALT (コンボ倍率適用)
- クリアボーナス +30 ALT
- **1日10回まで** (mode=panel_break 単位でカウント、altGameService 統合)

### 教育的意義
- **探索的思考**: 正解は1つじゃない
- **試行錯誤**: 失点なしで色々試せる
- **パターン発見**: 盤面から使える数字を瞬時に
- **スピード+正確性**: 時間下での冷静な判断

---

## 📚 教科別展開 (将来)

### 算数 (Phase A, B)
- 4択: 計算、文章題、単位換算
- パネル: 数値目標、概念系

### 国語 (Phase C 検討)
- 4択: 漢字読み、語彙、文法
- パネル: 「同じ部首の漢字」「熟語を作る」

### 地理 (Phase D 検討)
- 4択: 国名、首都、地形、気候
- パネル: 「同じ大陸の国」「海に接する県」

### 理科 (Phase E)
- 4択: 実験結果予測、用語
- パネル: 「同じ元素の化合物」「周期表グループ」

### 社会/歴史 (Phase F)
- 4択: 年代、人物
- パネル: 「同じ時代の出来事」「時系列並び替え」

---

## 🗂️ DB スキーマ追加 (v1.1 改訂)

### 設計原則
- **既存 `quiz_attempts` (0036 で text 化済み) には追記しない**。責務が違うので汚染を避ける
- **問題マスタは初日から DB 化** (TS 定数案は却下、deploy フリーを優先)
- **RLS 方針**: 各テーブルごとに最小権限を明示 (anon INSERT only / anon SELECT only)

### テーブル定義 (migration で作成)

```sql
-- 勉強ゲーム 4択 / パネル破壊 の回答ログ (教育分析用途)
-- 既存 quiz_attempts とは用途が別。mode/subject/error_pattern カラムを持つ
CREATE TABLE quiz_answer_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         TEXT        NOT NULL,
  subject          TEXT        NOT NULL,
  mode             TEXT        NOT NULL CHECK (mode IN ('quiz_4choice', 'panel_break')),
  question_id      TEXT        NOT NULL,   -- quiz_questions.id or 動的生成 ID
  selected_answer  TEXT,
  is_correct       BOOLEAN     NOT NULL,
  response_time_ms INTEGER,
  error_pattern    TEXT,                    -- NULL 可 (正解時、または分類不可時)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quiz_logs_child
  ON quiz_answer_logs (child_id, created_at DESC);
CREATE INDEX idx_quiz_logs_error_pattern
  ON quiz_answer_logs (error_pattern)
  WHERE is_correct = FALSE;

-- 問題マスタ (教材担当が SQL Editor から直接追加できる)
CREATE TABLE quiz_questions (
  id             TEXT        PRIMARY KEY,
  subject        TEXT        NOT NULL,
  mode           TEXT        NOT NULL CHECK (mode IN ('quiz_4choice', 'panel_break')),
  difficulty     TEXT        NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),
  question_text  TEXT        NOT NULL,
  correct_answer TEXT        NOT NULL,
  wrong_answers  JSONB       NOT NULL,       -- [{value, error_pattern}, ...]
  explanation    TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quiz_questions_lookup
  ON quiz_questions (subject, mode, difficulty, is_active);

-- パネル破壊セッション (コンボ履歴 / スコア集計)
CREATE TABLE panel_break_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          TEXT        NOT NULL,
  subject           TEXT        NOT NULL,
  difficulty        TEXT        NOT NULL,
  target_rule       TEXT        NOT NULL,      -- "sum_24" / "prime_3" など
  panels_destroyed  INT         NOT NULL DEFAULT 0,
  max_combo         INT         NOT NULL DEFAULT 0,
  total_score       INT         NOT NULL DEFAULT 0,
  duration_seconds  INT         NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_panel_sessions_child
  ON panel_break_sessions (child_id, created_at DESC);
```

### RLS 方針 (v1.1 明記)

| テーブル | RLS | anon 権限 | 理由 |
|---|---|---|---|
| `quiz_answer_logs` | ENABLE | INSERT only | クライアントが回答を書き込む。SELECT は教師ダッシュボード経由 (service_role / RPC) |
| `quiz_questions` | ENABLE | SELECT only | 読み取り専用マスタ。生徒クライアントが問題取得に使う |
| `panel_break_sessions` | ENABLE | INSERT only | セッション終了時に client から投下。集計は service_role 経由 |

```sql
-- 適用例
ALTER TABLE quiz_answer_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY qal_anon_insert ON quiz_answer_logs
  FOR INSERT TO anon WITH CHECK (TRUE);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY qq_anon_select ON quiz_questions
  FOR SELECT TO anon USING (is_active = TRUE);

ALTER TABLE panel_break_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pbs_anon_insert ON panel_break_sessions
  FOR INSERT TO anon WITH CHECK (TRUE);
```

### Seed 初期投入
- Phase A 着手時、`migrations/0040_study_game_seed.sql` で **算数 4択 60 問** を `quiz_questions` に投入
- 60 問の内訳 (目安): 初級 20 / 中級 25 / 上級 15
- 各問題は `wrong_answers` JSONB に 3 つの意味ある誤答を格納:
  ```json
  [
    {"value": "340", "error_pattern": "20_multiply_miss"},
    {"value": "380", "error_pattern": "4_multiply_miss"},
    {"value": "410", "error_pattern": "place_value_miss"}
  ]
  ```

---

## 💰 ALT 報酬 / altGameService 統合方針 (v1.1 新設)

### 統合ポイント
既存 `client/src/lib/altGameService.ts` の設計を踏襲:
- 1 日制限は **localStorage + JST 基準** でカウント (DB に専用テーブルを作らない)
- 獲得量は `updateChildStatus(childId, altEarned, xpEarned)` 経由で `child_status.alt_points` に反映
- ゲーム単位 (mode 単位) でカウンタ分離

### 追加実装 (Phase A)

`altGameService.ts` に新 mode を追加する形で以下を追記:

```ts
// mode 別の 1 日上限
const DAILY_LIMITS: Record<StudyGameMode, number> = {
  quiz_4choice: 3,
  panel_break: 10,
  // 既存モード (calc_battle, compare_battle, etc.) はそのまま共通 5 回制限
};

// JST 基準の今日のカウント localStorage key
function dailyCountKey(childId: string, mode: StudyGameMode, jstDate: string) {
  return `alt_game_count_${childId}_${mode}_${jstDate}`;
}

// セッション完了時のラッパー
export async function processStudyGameResult(params: {
  childId: string;
  mode: StudyGameMode;
  altEarned: number;        // モード内で算出した生の獲得量
  xpEarned?: number;
}): Promise<{ applied: number; capped: boolean }> {
  const jstDate = getJstDateKey();
  const currentCount = readCount(params.childId, params.mode, jstDate);
  const limit = DAILY_LIMITS[params.mode] ?? 5;

  if (currentCount >= limit) {
    // 上限超過: DB 記録は続行するが ALT は付与しない
    return { applied: 0, capped: true };
  }

  await updateChildStatus(params.childId, params.altEarned, params.xpEarned ?? 0);
  incrementCount(params.childId, params.mode, jstDate);
  return { applied: params.altEarned, capped: false };
}
```

### 上限到達時の UX
- セッションは完走可能 (ゲーム体験を損なわない)
- 画面上部に「今日の ALT 獲得回数上限に達しました。学習記録は残ります」表示
- `quiz_answer_logs` / `panel_break_sessions` への DB 記録は継続 (教師ダッシュボードのデータ価値を維持)

---

## 🧮 パネル生成アルゴリズム (v1.1 新設)

### 要件
- 盤面に **「目標を達成できる組み合わせ」が最低 1 つは存在** する
- 生成コスト < 100ms (UI blocking 回避)
- 難易度 / 目標ルール / 盤面サイズに応じた柔軟性

### アルゴリズム (Phase C で実装)

```
1. 目標値 target、目標ルール rule、盤面サイズ N、難易度 difficulty を入力
2. 数値 pool を難易度から生成 (初級: 1-12、中級: 1-20、上級: 1-50 + 素数多め)
3. 盤面 N×N をランダム配置
4. validate(盤面, target, rule):
   - 2 組合せ全探索 (O(N^4))
   - 3 組合せは枝刈り付き探索 (O(N^6) だが target 超過で剪定)
   - rule に該当する組合せが 1 つ以上見つかれば OK
5. 失敗したら 3 に戻って再生成 (最大 10 回)
6. 10 回失敗したら difficulty を 1 段下げて retry
7. 最低難易度でも失敗したら「解が必ずあるシード済み盤面」をフォールバック (5 セットを server 側に用意)
```

### 性能見積もり
- 5×5 = 25 マスで 2 組合せ探索: 25 × 24 / 2 = 300 通り、四則演算評価込みで < 1ms
- 3 組合せ探索: 300 × 23 = 6,900 通り、枝刈りで実効 ~1,000 通り、< 5ms
- 10 回再生成しても最悪 < 50ms、十分余裕

### 詳細は Phase C 着手時に再定義
- お題ルール (素数 / 約数 / 平方数) ごとの validator 関数
- シードフォールバック盤面の選定基準
- ユニットテスト (1,000 盤面で解存在率 100% であること)

---

## 🎨 UI/UX 設計方針

### 共通
- ダークブルー + 金アクセント + ガラスモーフィズム (既存統一、v12 系デザイントークン)
- ALT獲得時は金色パーティクル
- コンボ成立時は画面端エフェクト

### 4択モード
- 選択肢ボタン大きめ (タップしやすさ)
- タップ時バイブ (モバイル、設定で OFF 可能)
- 正解/不正解の色で明確区別 (緑/赤)

### パネル破壊
- 選択パネルは金の縁取りで明確
- 破壊エフェクト豊富 (爆発、パーティクル、振動)
- コンボ数字は画面中央に大きく表示
- アクセシビリティ対応は FOLLOW_UPS (FU-014) 参照

---

## 🚀 実装フェーズ (v1.1 改訂)

### Phase A: 4択モード MVP (1-2週間)
**スコープ**:
- `client/src/pages/QuizModePage.tsx` 新規
- migration `00XX_study_game_tables.sql` (3 テーブル + RLS + index)
- migration `00XX_study_game_seed.sql` (算数 4択 **60 問** 投入)
- `client/src/lib/quizModeService.ts` 新規 (fetch_questions / submit_answer)
- `client/src/lib/altGameService.ts` に `processStudyGameResult` 追加
- 選択肢4つ UI / 正解・不正解表示
- ALT 加算 (日次制限 3 回)
- DB 記録 (quiz_answer_logs)
- ALTゲームページにカード追加

**成功条件**:
- 算数4択で10問完走
- 誤答ログが `quiz_answer_logs` に正しく記録される (error_pattern 込み)
- ALT 加算 / 日次制限 3 回が動作
- F12 Console エラーゼロ

### Phase B: 4択拡張 + 教師ダッシュボード (1-2週間、v1.1 で昇格)
- 「なぜ間違ったか」選択 UI (メタ認知)
- 似た問題リトライボタン
- 復習ノート自動生成 (最後の誤答 5 問をまとめ表示)
- **教師用・誤答パターン集計画面** (v1.1 で Phase A から昇格)
  - 画面仕様: 生徒ごとの誤答 top 5 パターン / 問題ごとの誤答分布 / 時系列改善グラフ
  - 具体 UI は kk が教室運用を見て spec 追加 (FU-016)
- 100 問拡充 (60 → 160 問)

### Phase C: パネル破壊 MVP (2-3週間)
- `client/src/pages/PanelBreakPage.tsx` 新規
- 盤面グリッド (3×3 から開始)
- 選択状態管理 (Set<PanelId>)
- 条件判定 (四則演算 validator)
- **生成検証ループ** (本 spec §パネル生成アルゴリズム 参照)
- 破壊アニメ + 重力落下
- コンボシステム (1→5x 倍率)
- DB 記録 (panel_break_sessions)

### Phase D: パネル破壊拡張 (1-2週間)
- 4×4 / 5×5 対応
- お題バリエーション (素数、約数、倍数、平方数)
- ランキング (超級モード、`hall_of_fame` 連携)
- エフェクト強化

### Phase E: 他教科展開 (段階的)
- 国語 → 地理 → 理科 → 社会/歴史
- subject enum マイグレーション設計 (FU-015)

---

## ⚠️ リスク管理

### 技術
- **盤面生成の解なし問題**: 本 spec §パネル生成アルゴリズム で検証ループ + フォールバック
- **アニメパフォーマンス**: エフェクトレベル設定 (高/中/低)
- **Supabase Studio 経由の手動テーブル追加禁止** (FU-012 教訓)。全テーブルは migration 経由で作成

### 教育
- **ゲーム化過剰**: 1日プレイ時間上限 (保護者設定、FU-014 関連)、学習成果可視化を前面
- **誤答記録ストレス**: 教師/保護者のみ閲覧、生徒には「成長の記録」として提示

### 運用
- **問題セット枯渇**: 常時拡充、ランダム化強化、DB 化で deploy フリー追加可能

---

## 📚 TRAIL 教育哲学との接続

| 領域 | 4択モード | パネル破壊 |
|------|---------|----------|
| 思考プロセスの可視化 | 誤答で分かる | 試行錯誤で分かる |
| メタ認知 | 「なぜ間違った」 | 成功パターン発見 |
| 探究心 | 解説で深める | 複数解答の発見 |
| 創造性 | - | 多様な組み合わせ |
| 継続性 | 復習機能 | コンボの中毒性 |
| 教師連携 | 誤答ログ | プレイパターン分析 |

### 探究テーマ案
- 「自分の誤答パターンから何が見えた?」
- 「24 を作る組み合わせは全部で何通り?」
- 「相手がどの選択肢を選ぶか予測できる?」

---

## 🔗 関連ドキュメント

- [FOLLOW_UPS.md](./FOLLOW_UPS.md) — 技術債務 / 再設計候補の一覧
- [NUCLEAR_BOSS_DECK_SPEC.md](./NUCLEAR_BOSS_DECK_SPEC.md)
- [CARD_MARKET_SPEC.md](./CARD_MARKET_SPEC.md)
- [DECK_QUEST_SPEC.md](./DECK_QUEST_SPEC.md)
- [CARD_TYPE_SYSTEM_SPEC.md](./CARD_TYPE_SYSTEM_SPEC.md) *(untracked)*

---

## 📌 Next Actions (v1.1 改訂)

### 即座
1. kk が v1.1 レビュー
2. 問題マスタ **60 問** 作成 (算数 4択、kk or 教材担当が準備)
   - フォーマット: `quiz_questions` テーブルの INSERT 文 or CSV/JSON
   - Claude Code がフォーマット雛形を提供可能 (要依頼)

### 短期
3. Phase A 実装 (migration + QuizModePage + altGameService 統合 + ALTゲームページ連携)
4. ALTゲームページ UI 調整 (新モードカード追加)

### 中期
5. Phase B 拡張 + **教師ダッシュボード誤答集計画面** (v1.1 で昇格)
6. Phase C 着手 (パネル破壊 MVP)

### 長期
7. 他教科展開 (Phase D-F)
8. 教師ダッシュボード連携深化
9. 保護者レポート

---

## 🎯 成功指標 (KPI)

### 短期
- 算数4択週利用率 60%+
- 完走率 80%+
- 誤答ログ週1,000件+

### 中期
- パネル破壊人気 (週利用率 40%+)
- 日平均プレイ 30% 増
- 教師ダッシュボード週利用回数 (教師 1 人あたり 3 回+)

### 長期
- 全教科展開
- 誤答分析が教師常用ツール
- 他校導入時のキラー機能

---

## 📝 v1.1 変更反映サマリ

7 論点への kk 回答を以下のセクションに反映:

| 論点 | 反映セクション |
|---|---|
| 1. quiz_answer_logs 別テーブル共存 | §DB スキーマ 冒頭 / テーブル定義 |
| 2. 問題マスタ DB-first | §DB スキーマ / §Phase A / §Next Actions |
| 3. RLS 方針 (anon INSERT/SELECT 個別) | §RLS 方針 (新設) |
| 4. altGameService 統合 | §ALT 報酬 / altGameService 統合方針 (新設) |
| 5. パネル生成検証ループ | §パネル生成アルゴリズム (新設) |
| 6. 初期投入 60 問 | §Phase A / §Next Actions |
| 7. 教師ダッシュボードを Phase B に | §Phase B / §KPI 中期 / §Next Actions |

FOLLOW_UPS 化:
- パネル破壊アクセシビリティ → FU-014
- 多科目展開時 subject enum → FU-015
- 教師ダッシュボード誤答可視化 → FU-016

---

**仕様書 以上 (v1.1)**
