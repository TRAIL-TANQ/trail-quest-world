# STUDY_GAME_SPEC.md

**プロジェクト**: TRAIL QUEST WORLD (TQW)
**機能名**: 勉強ゲーム強化 (4択モード + パネル破壊モード)
**バージョン**: **v1.2** (2026-04-22 Phase A 着手前追補)
**作成日**: 2026-04-21 (v1.0)

---

## 📒 変更履歴

| Ver | Date       | Summary |
|-----|------------|---------|
| 1.0 | 2026-04-21 | 初版 (kk 作成) |
| 1.1 | 2026-04-22 | 7 論点レビュー反映: DB 設計改訂、ALT 統合方針、パネル生成アルゴリズム、教師ダッシュボードを Phase B に昇格、初期 60 問ルール |
| 1.2 | 2026-04-22 | Phase A 着手前 3 点追補: A=問題マスタ作成ガイド (INSERT 雛形 + CSV フロー + 具体例 3 問)、B=error_pattern enum 確定 (11 種)、C=Phase A 完了検証 SQL |

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
  subject          TEXT        NOT NULL,   -- Phase A は 'math' 固定 (FU-015 で enum 化検討)
  mode             TEXT        NOT NULL CHECK (mode IN ('quiz_4choice', 'panel_break')),
  question_id      TEXT        NOT NULL,   -- quiz_questions.id or 動的生成 ID
  selected_answer  TEXT,
  is_correct       BOOLEAN     NOT NULL,
  response_time_ms INTEGER,
  error_pattern    TEXT        CHECK (
    error_pattern IS NULL
    OR error_pattern IN (
      'calculation_error', 'carry_forget', 'place_value_error',
      'operation_order_error', 'sign_error', 'unit_conversion_error',
      'fraction_misunderstanding', 'decimal_misunderstanding',
      'misreading', 'time_out', 'other'
    )
  ),                                        -- v1.2: enum 固定 (§error_pattern enum 定義)
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
- 60 問の内訳 (kk 最終確定, v1.2): 初級 20 / 中級 20 / 上級 20
- 各問題は `wrong_answers` JSONB に 3 つの意味ある誤答を格納:
  ```json
  [
    {"value": "340", "error_pattern": "calculation_error", "error_detail": "20 の掛け算ミス"},
    {"value": "380", "error_pattern": "calculation_error", "error_detail": "4 の掛け算ミス"},
    {"value": "410", "error_pattern": "place_value_error"}
  ]
  ```
  - `error_pattern`: §error_pattern enum 定義 の 11 種から必ず選択 (固定 enum)
  - `error_detail`: 任意のフリーテキスト (教師向け補足。quiz_answer_logs には記録されない)

---

## 🎲 error_pattern enum 定義 (v1.2 新設)

### 設計意図
誤答分類を **固定 enum 11 種** に統一。kk の問題作成時の迷いを排除し、`quiz_answer_logs` 集計時のグルーピングを確実にする。問題固有の詳細は `wrong_answers[].error_detail` (フリーテキスト) に残し、分類軸とは切り分ける。

### enum 完全リスト

| error_pattern | 日本語名 | 使用ケース (例) |
|---|---|---|
| `calculation_error` | 計算ミス | 加減乗除の単純ミス。繰り上がり/位取りに分類されない誤り全般 |
| `carry_forget` | 繰り上がり/繰り下がり忘れ | 17+28 → 35 のように上位桁への加算を落とす |
| `place_value_error` | 位取りミス | 15×24 → 410 のように桁数/位置を誤る |
| `operation_order_error` | 四則演算順序ミス | 2+3×4 → 20 のように左から順に計算 |
| `sign_error` | 符号ミス | マイナス/プラスの符号落とし、反転 |
| `unit_conversion_error` | 単位換算ミス | m↔cm、分↔秒 の換算ミス |
| `fraction_misunderstanding` | 分数の概念誤解 | 1/2+1/3 → 2/5 のように分母分子を直接加算 |
| `decimal_misunderstanding` | 小数の概念誤解 | 0.1×0.1 → 0.1 のように小数の掛け算構造を誤る |
| `misreading` | 問題文読み違い | 「ひき算」を「たし算」と読む、数値の読み飛ばし |
| `time_out` | 時間切れで推測 | 制限時間超過による当てずっぽう (クライアントが自動付与) |
| `other` | その他 | 上記いずれにも分類しにくい誤り。濫用は避ける |

### TypeScript union type (client/src/lib/quizModeService.ts に定義予定)

```ts
export type ErrorPattern =
  | 'calculation_error'
  | 'carry_forget'
  | 'place_value_error'
  | 'operation_order_error'
  | 'sign_error'
  | 'unit_conversion_error'
  | 'fraction_misunderstanding'
  | 'decimal_misunderstanding'
  | 'misreading'
  | 'time_out'
  | 'other';

export const ERROR_PATTERN_LABELS: Record<ErrorPattern, string> = {
  calculation_error:          '計算ミス',
  carry_forget:               '繰り上がり忘れ',
  place_value_error:          '位取りミス',
  operation_order_error:      '四則演算順序ミス',
  sign_error:                 '符号ミス',
  unit_conversion_error:      '単位換算ミス',
  fraction_misunderstanding:  '分数の概念誤解',
  decimal_misunderstanding:   '小数の概念誤解',
  misreading:                 '問題文読み違い',
  time_out:                   '時間切れで推測',
  other:                      'その他',
};
```

### DB 側制約 (quiz_answer_logs.error_pattern)
§DB スキーマ の CHECK 制約で enum を強制 (v1.2 で反映済)。DB レベルで逸脱を防ぐことで、集計クエリが壊れないことを保証する。

### 拡張ポリシー
- enum を増やす場合は必ず migration 経由 (DROP + ADD CHECK)
- 追加は「十分な件数の `other` がその pattern に該当する」ことを確認してから
- 濫用防止のため、Phase A 中は上記 11 種で固定

---

## 📝 問題マスタ作成ガイド (v1.2 新設)

### 目的
kk (または教材担当) が **算数 60 問** を迷わず作成できるよう、フォーマット / 命名規則 / 具体例 / 作業フローを固定する。

### 推奨作業フロー

```
[1] kk: Google Sheets (or CSV) で 60 問作成
     ↓ (カラム: id, difficulty, question_text, correct_answer,
              wrong_1_value, wrong_1_pattern, wrong_1_detail,
              wrong_2_value, wrong_2_pattern, wrong_2_detail,
              wrong_3_value, wrong_3_pattern, wrong_3_detail,
              explanation)

[2] Claude Code: CSV → INSERT SQL 変換 (変換スクリプト or 手作業)

[3] migrations/0040_study_game_seed.sql に書き込み

[4] supabase db push (or migration apply) で本番投入

[5] §Phase A 完了検証 SQL で投入件数を確認
```

**Supabase Studio の SQL Editor から直接 INSERT は禁止** (FU-012 教訓)。seed は必ず migration 経由。

### id 命名規則
- 形式: `<subject>_<mode>_<difficulty>_<連番3桁>`
- 例:
  - `math_q4_easy_001`
  - `math_q4_medium_015`
  - `math_q4_hard_020`
- `q4` は quiz_4choice の省略。`pb` は panel_break の省略 (Phase C で使用)

### wrong_answers[].error_pattern 命名規則
- §error_pattern enum 定義 の **11 種から必ず選択** (固定 enum)
- 問題固有の詳細は `error_detail` に書く (任意、フリーテキスト)
- 3 つの誤答はできる限り **異なる error_pattern** にする (教育分析のため)

### Google Sheets テンプレート (kk が入力)

```
id                    | difficulty | question_text     | correct_answer | w1_value | w1_pattern            | w1_detail        | w2_value | w2_pattern              | w2_detail         | w3_value | w3_pattern          | w3_detail        | explanation
math_q4_easy_001      | easy       | 17 + 28 = ?       | 45             | 35       | carry_forget          | 繰り上がり忘れ    | 315      | place_value_error       | 3と15を並べた      | 43       | calculation_error   | 単純計算ミス       | 17+28 = (10+7)+(20+8) = 30+15 = 45
math_q4_medium_001    | medium     | 15 × 24 = ?       | 360            | 340      | calculation_error     | 20の掛け算ミス    | 380      | calculation_error       | 4の掛け算ミス      | 410      | place_value_error   |                  | 15×24 = 15×(20+4) = 300+60 = 360
math_q4_hard_001      | hard       | 3/4 + 1/6 = ?     | 11/12          | 4/10     | fraction_misunderstanding | 分母分子を直接加算 | 4/24    | fraction_misunderstanding | 通分できず分母を掛けた | 9/12    | calculation_error | 通分後の加算ミス    | 通分して 9/12 + 2/12 = 11/12
```

### INSERT SQL 雛形 (Claude Code が CSV から変換)

```sql
-- migrations/0040_study_game_seed.sql
INSERT INTO quiz_questions (
  id, subject, mode, difficulty,
  question_text, correct_answer, wrong_answers, explanation
) VALUES
(
  'math_q4_easy_001', 'math', 'quiz_4choice', 'easy',
  '17 + 28 = ?', '45',
  '[
    {"value": "35",  "error_pattern": "carry_forget",        "error_detail": "繰り上がり忘れ"},
    {"value": "315", "error_pattern": "place_value_error",   "error_detail": "3と15を並べた"},
    {"value": "43",  "error_pattern": "calculation_error",   "error_detail": "単純計算ミス"}
  ]'::jsonb,
  '17+28 = (10+7)+(20+8) = 30+15 = 45'
),
(
  'math_q4_medium_001', 'math', 'quiz_4choice', 'medium',
  '15 × 24 = ?', '360',
  '[
    {"value": "340", "error_pattern": "calculation_error",   "error_detail": "20 の掛け算ミス"},
    {"value": "380", "error_pattern": "calculation_error",   "error_detail": "4 の掛け算ミス"},
    {"value": "410", "error_pattern": "place_value_error"}
  ]'::jsonb,
  '15×24 = 15×(20+4) = 300+60 = 360'
),
(
  'math_q4_hard_001', 'math', 'quiz_4choice', 'hard',
  '3/4 + 1/6 = ?', '11/12',
  '[
    {"value": "4/10", "error_pattern": "fraction_misunderstanding", "error_detail": "分母分子を直接加算"},
    {"value": "4/24", "error_pattern": "fraction_misunderstanding", "error_detail": "通分できず分母を掛けた"},
    {"value": "9/12", "error_pattern": "calculation_error",         "error_detail": "通分後の加算ミス"}
  ]'::jsonb,
  '通分して 9/12 + 2/12 = 11/12 (最小公倍数 12)'
)
-- ... 残り 57 問
;
```

### 具体例 3 問 (各難易度 1 問、kk の参考資料)

#### 例1: 初級 (easy) — 繰り上がりのある加算
- **問題**: `17 + 28 = ?`
- **正解**: `45`
- **誤答 3 パターン**:
  | 値 | error_pattern | error_detail |
  |---|---|---|
  | 35 | `carry_forget` | 繰り上がり忘れ (10+20=30, 7+8=15→5だけ取る) |
  | 315 | `place_value_error` | 3と15を並べて書いた |
  | 43 | `calculation_error` | 一の位単純ミス |
- **解説**: 17+28 = (10+7)+(20+8) = 30+15 = 45

#### 例2: 中級 (medium) — 2桁 × 2桁
- **問題**: `15 × 24 = ?`
- **正解**: `360`
- **誤答 3 パターン**:
  | 値 | error_pattern | error_detail |
  |---|---|---|
  | 340 | `calculation_error` | 20 の掛け算ミス |
  | 380 | `calculation_error` | 4 の掛け算ミス |
  | 410 | `place_value_error` | 位取りミス |
- **解説**: 15×24 = 15×(20+4) = 300+60 = 360

#### 例3: 上級 (hard) — 分数の加算 (通分)
- **問題**: `3/4 + 1/6 = ?`
- **正解**: `11/12`
- **誤答 3 パターン**:
  | 値 | error_pattern | error_detail |
  |---|---|---|
  | 4/10 | `fraction_misunderstanding` | 分母分子を直接加算 |
  | 4/24 | `fraction_misunderstanding` | 通分できず分母を掛けた |
  | 9/12 | `calculation_error` | 通分後の加算ミス |
- **解説**: 最小公倍数 12 で通分 → 9/12 + 2/12 = 11/12

### 作問時の 3 原則
1. **誤答は教育的意味を持たせる**: ランダムな数字ではなく、実際の誤解パターンを表現する
2. **3 つの誤答はできる限り異なる pattern にする**: 同じ pattern ばかりだと分析価値が下がる
3. **正解が一目でわからない難易度設計**: easy でも暗算即答にならない難易度を選ぶ

### kk 60 問作成の分担
- **Claude Code**: CSV テンプレ提供 + seed migration の空テンプレ + CSV → INSERT 変換
- **kk**: 60 問の問題文 / 正解 / 3 誤答 / error_pattern / explanation 作成 (Phase A 実装中の 1-3 日で並行)

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

## 🧪 Phase A 完了検証 SQL (v1.2 新設)

### 目的
Phase A の成功条件を **手元で即座に検証できる SQL セット**。kk が Supabase SQL Editor に貼って確認する想定。
Phase A で検証対象のテスト生徒 id は `個別_さとる` を例示 (実運用時は対象生徒 id を置換)。

### 1. 問題マスタ seed 投入確認 (難易度別カウント)
- **検証内容**: seed migration 投入後、算数 4択 60 問が難易度別 20/20/20 で入っているか
- **期待値**: easy=20, medium=20, hard=20 (合計 60)

```sql
SELECT difficulty, COUNT(*) AS question_count
FROM quiz_questions
WHERE subject = 'math'
  AND mode = 'quiz_4choice'
  AND is_active = TRUE
GROUP BY difficulty
ORDER BY
  CASE difficulty
    WHEN 'easy' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'hard' THEN 3
    WHEN 'extreme' THEN 4
  END;
```

### 2. 誤答ログ記録確認 (直近 10 件)
- **検証内容**: 生徒が 4択に回答した後、`quiz_answer_logs` に必須カラムが埋まって記録されているか
- **期待値**: `child_id`, `mode`, `question_id`, `is_correct` が欠損なし / `error_pattern` は誤答時のみ enum 値 / `response_time_ms` が正の整数

```sql
SELECT child_id, subject, mode, question_id, selected_answer,
       is_correct, error_pattern, response_time_ms, created_at
FROM quiz_answer_logs
WHERE child_id = '個別_さとる'
ORDER BY created_at DESC
LIMIT 10;
```

### 3. 日次セッション / 正答率 (JST 基準)
- **検証内容**: 1 セッション = 10 問として、日に何セッション完走したか + 正答率
- **期待値**: 1 セッション当たり 10 行記録、正答率 0-100%

```sql
SELECT
  DATE(created_at AT TIME ZONE 'Asia/Tokyo') AS jst_date,
  COUNT(*)                                                  AS total_answers,
  COUNT(*) FILTER (WHERE is_correct = TRUE)                 AS correct_count,
  ROUND(
    COUNT(*) FILTER (WHERE is_correct = TRUE)::numeric
      / NULLIF(COUNT(*), 0) * 100, 1
  ) AS accuracy_pct
FROM quiz_answer_logs
WHERE child_id = '個別_さとる'
  AND mode = 'quiz_4choice'
GROUP BY DATE(created_at AT TIME ZONE 'Asia/Tokyo')
ORDER BY jst_date DESC;
```

**注意**: ALT の「1 日 3 回制限」は localStorage 側でカウントしており、DB からは直接検証できない。DB 側は「セッション履歴」として残る。3 回制限の動作確認は F12 DevTools の Application → LocalStorage で `alt_game_count_<childId>_quiz_4choice_<YYYY-MM-DD>` キーを見る。

### 4. error_pattern 別 誤答集計 (教師ダッシュボード Phase B 前倒し検証)
- **検証内容**: Phase B で UI 化する前に、集計クエリが想定通り動くか
- **期待値**: enum 11 種のいずれかで降順に集計される

```sql
SELECT error_pattern,
       COUNT(*) AS miss_count
FROM quiz_answer_logs
WHERE child_id = '個別_さとる'
  AND is_correct = FALSE
  AND error_pattern IS NOT NULL
GROUP BY error_pattern
ORDER BY miss_count DESC;
```

### 5. RLS 検証 (anon 権限の最小化確認)
- **検証内容**: anon role で `quiz_answer_logs` を SELECT できないこと、`quiz_questions` を SELECT できること
- **期待値**: (a) SELECT on quiz_answer_logs → 0 rows / permission denied, (b) SELECT on quiz_questions → 60 rows

```sql
-- Supabase Studio の SQL Editor でなく、anon キーで curl/fetch して確認:
--   (a) SELECT * FROM quiz_answer_logs LIMIT 1;  -- 0 rows or permission denied であること
--   (b) SELECT * FROM quiz_questions WHERE is_active = TRUE LIMIT 5;  -- 5 rows 返ること
--   (c) INSERT INTO quiz_answer_logs (...) VALUES (...);  -- 成功すること
-- curl 例:
--   curl -H "apikey: <anon_key>" -H "Authorization: Bearer <anon_key>" \
--     "https://<project>.supabase.co/rest/v1/quiz_answer_logs?limit=1"
```

### 6. error_pattern CHECK 制約の動作確認
- **検証内容**: enum 外の値を INSERT しようとしてエラーになること
- **期待値**: `ERROR: new row for relation "quiz_answer_logs" violates check constraint`

```sql
-- 失敗するはず
INSERT INTO quiz_answer_logs (
  child_id, subject, mode, question_id, selected_answer,
  is_correct, response_time_ms, error_pattern
) VALUES (
  'test_child', 'math', 'quiz_4choice', 'math_q4_easy_001', '35',
  FALSE, 5000, 'invalid_pattern_xxx'
);
-- → ERROR: violates check constraint
```

### 成功条件と SQL の対応表

| Phase A 成功条件 | 検証 SQL |
|---|---|
| 算数4択で10問完走 | §3 日次セッション (1 日で total_answers = 10 以上) |
| 誤答ログが error_pattern 込みで記録 | §2 直近 10 件 / §4 error_pattern 別集計 |
| ALT 加算 / 日次制限 3 回が動作 | localStorage 直接確認 (DB では §3 で日別 row 数だけ確認) |
| F12 Console エラーゼロ | ブラウザ DevTools 目視 |
| seed 60 問投入 | §1 難易度別カウント |
| RLS が最小権限で機能 | §5 anon 権限検証 |
| enum 逸脱を DB レベルで拒否 | §6 CHECK 制約動作確認 |

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

## 📝 v1.2 変更反映サマリ

Phase A 着手前の kk 追加依頼 3 点を以下セクションに反映:

| 追補依頼 | 反映セクション |
|---|---|
| A. 問題マスタ 60 問の「フォーマット雛形」先出し | §問題マスタ作成ガイド (新設) — INSERT 雛形 / CSV テンプレ / 具体例 3 問 / 作業フロー |
| B. 誤答パターン enum の完全リスト確定 | §error_pattern enum 定義 (新設) — 11 種固定 + TypeScript union + DB CHECK 制約 / §DB スキーマ の quiz_answer_logs CHECK 追加 / §Seed 初期投入 の JSONB 例更新 |
| C. Phase A 完了検証 SQL 同梱 | §Phase A 完了検証 SQL (新設) — 6 クエリ + 成功条件との対応表 |

その他の微修正:
- 60 問の難易度内訳を 20/25/15 → **20/20/20** (kk 最終確定) に変更
- `subject` カラムに Phase A 'math' 固定コメント追加 (FU-015 連動)
- `wrong_answers[]` JSONB 構造に `error_detail` フィールド (任意、フリーテキスト) を明示

---

**仕様書 以上 (v1.2)**
