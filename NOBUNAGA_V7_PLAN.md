# 信長デッキ v7 実装計画 — 2026-04-19 夜

朝の kk 着手用。Phase 1-5 の段階的 commit プランと、仕様書を読まないと進められない不明点リスト。

> **本書のソース**: kk の今夜のメッセージ内 Phase 1-5 箇条書きを「確定仕様」、私が今夜読んだ `cardData.ts` / `knowledgeCards.ts` / `knowledgeEngine.ts` を「現行実装」とする。仕様書ファイル本体（kk 手元）は本リポジトリ未配置のため、本計画は箇条書きを補完した「私の解釈」を含む。実装着手前に「§5 不明点」を必ず確認すること。

---

## 1. 現行 信長デッキ 実装スナップショット

`stages.ts:235-253` の信長デッキ構成（15 枚、紙 1 枚はノイズ）:

| カード | id | 現 atk | 現 def | 現 効果 (knowledgeEngine.ts) |
|---|---|---|---|---|
| 織田信長 (trump) | card-006 | 3 | **2** | `case 'nobunaga'` (line 636-691) — 鉄砲で攻+3、敦盛で攻+5、楽市楽座で防+2、馬防柵で防+(足軽数+鉄砲数)、鉄砲＆楽市楽座で相手ベンチ1枚封印 |
| 鉄砲 ×3 | card-139 | **2** | 1 | `case 'gun'` (line 1802) — telop のみ、単独効果なし |
| 足軽 ×3 | card-182 | 2 | 1 | **case なし** — 単独効果なし、nobunaga 防御計算でカウントされるのみ |
| 馬防柵 | card-183 | 1 | 3 | **case なし** — nobunaga 防御計算で参照されるのみ |
| 楽市楽座 | card-140 | 1 | 1 | `case 'rakuichi'` (line 1802) — telop のみ、単独効果なし |
| 敦盛の舞 | card-181 | 1 | 1 | **case なし** — nobunaga 攻撃時 +5 として参照 |
| 長篠の陣 | card-184 | 1 | 1 | **case なし** — 単独効果なし |
| 南蛮貿易 | card-185 | 1 | 1 | **case なし** — 単独効果なし |
| 安土城 | card-186 | 1 | 5 | **case なし** — 単独効果なし |
| 本能寺の変 | card-187 | 2 | 1 | `case 'honnoji'` (line 1585-1616) — 信長+ベンチ+山札残りを exile、明智ルート4枚に置換。**今夜 d1241ef で山札退避バグ修正済** |
| 紙 (noise) | card-138 | - | - | 既存の `case 'paper'` |

明智ルート（本能寺後の派生、4枚 SR）:
- 明智光秀 4/1 (atk-only ベンチコンボ持ち、`case 'akechi_mitsuhide'`)
- 愛宕百韻 1/2 (`case 'atago_hyakuin'` — telop のみ)
- 天王山 2/3 (`case 'tennouzan'` — telop のみ)
- 三日天下 3/1 (`case 'mikka_tenka'` — 明智光秀をデッキトップ回収)

すべて `EVOLUTION_ONLY_CARDS` 登録済 → 通常デッキ抽選から除外。
`evolved-akechi-` プレフィックス ID で派生扱い、ラウンド終了で `revertEvolution` により消滅。

---

## 2. kk Phase 1-5 と現行実装の差分

| Phase | kk 仕様（今夜のメッセージから） | 現行 | 差分 |
|---|---|---|---|
| **P1.1** | 織田信長 3/3 化 | 3/2 | def +1 |
| **P1.2** | 鉄砲 1/1 統一 | 2/1 | atk -1 |
| **P2.1** | 楽市楽座: 足軽デッキトップ戻し | telop のみ | **新効果実装**（任意発動 / 自動発動 不明） |
| **P2.2** | 長篠の陣: 鉄砲3枚で攻+2 | 効果なし | **新効果実装**（カウント対象不明） |
| **P2.3** | 馬防柵: 相手初撃-1デバフ | nobunaga 防御計算で参照のみ | **新効果実装**（「初撃」定義不明） |
| **P3.1** | 足軽 A/B 選択ダイアログ | 効果なし | **新 UI + 効果**（A/B 内容不明） |
| **P3.2** | 安土城 サブバトル毎1回カウンター | 効果なし | **新機構**（カウンター対象・効果不明） |
| **P3.3** | 織田信長バフ: 南蛮貿易2倍 | 南蛮貿易は nobunaga 効果に未参照 | **nobunaga case 拡張**（「2倍」対象不明） |
| **P4.1** | 一時召喚ゾーン (`GameState` 新フィールド) | 存在しない | **新 state 追加**（型・ライフサイクル設計必要） |
| **P4.2** | 南蛮貿易: トークン鉄砲召喚 | 効果なし | **新効果実装**（個数・条件不明） |
| **P4.3** | トークン鉄砲: サブバトル終了で消滅 | 該当処理なし | **`continueAfterResolve` 等にライフサイクル追加** |
| **P4.4** | 足軽・長篠の陣: トークン鉄砲もカウント | 通常ベンチのみ参照 | **カウント計算合流** |
| **P5** | 明智光秀ルート 4枚構成確認 | 既に登録済 | **実装不要、検証のみ** |

---

## 3. Phase 別 commit 分割案

### Phase 1 — 基本属性変更（30 分、2 commit）

**P1.1 — `feat(nobunaga): trump stats 3/3`**
- `knowledgeCards.ts:476` — `'織田信長': { attackPower: 3, defensePower: 3 }`
- 影響: nobunaga 防御計算（楽市楽座+2 / 馬防柵+N）のベース値が +1 上昇。バランスは Phase 5 完了後の通しテストで再評価。

**P1.2 — `feat(gun): stats 1/1`**
- `knowledgeCards.ts:460` — `'鉄砲': { attackPower: 1, defensePower: 1 }`
- 影響: 鉄砲単体の攻撃力が下がる代わりに、Phase 2-4 のシナジーで取り戻す設計と推定。

**type check + 通しテストは P1.2 完了後にまとめて実施。**

---

### Phase 2 — 既存効果変更（1-2 時間、3 commit）

**P2.1 — `feat(rakuichi): return 足軽 to deck top`**
- `knowledgeEngine.ts` の `case 'rakuichi'` (line 1802 の `case 'gun': case 'rakuichi'` から `'rakuichi'` を分離) を新規 case に
- 効果: ベンチの足軽 1 枚をデッキトップに戻す（または除外から戻す — **要確認**）
- 任意発動か自動発動か（attackerEffect か常時か）は **要確認**
- 参考実装: `case 'mikka_tenka'` (1660 行) の「明智光秀をデッキトップに戻す」と同パターン

**P2.2 — `feat(nagashino): +2 atk if 鉄砲 ≥ 3`**
- `case 'nagashino'` を新規追加
- ベンチの鉄砲枚数 (+ トークン鉄砲、Phase 4 で合流) が 3 以上なら attacker 時 `bonusAttack += 2`
- 参考実装: `case 'galileo'` (703 行) の地動説カウント

**P2.3 — `feat(bafousaku): -1 enemy first attack debuff`**
- 新 `GameState` フィールド: `enemyFirstAttackDebuff: { player: number; ai: number }`
- `case 'bafousaku'` を追加 (馬防柵がベンチに公開された時 → 相手の `enemyFirstAttackDebuff[opp] += 1`)
- attacker reveal 時に「初撃」判定（**「初撃」= サブバトル最初の攻撃 / ラウンド最初の攻撃 / バトル全体最初 — 要確認**）して bonusAttack を debit
- 既存実装の参考: 万里の長城類似 と kk が言及 → 万里の長城は `'万里の長城'` ベンチカードで passive defender bonus、active な「相手攻撃-X」ではない。**実装パターンは万里の長城とは異なる、要再確認**

---

### Phase 3 — 新 UI + バフ（2-3 時間、3-4 commit）

**P3.1 — `feat(ashigaru): A/B reveal dialog`**
- `case 'ashigaru'` 追加
- KnowledgeChallenger.tsx に新ダイアログコンポーネント（`OptionalEffectDialog` 再利用 or 新規）
- A / B の選択肢内容: **要確認**（攻撃モード / 防御モード? 鉄砲召喚? 馬防柵展開?）
- 選択結果は `GameState.pendingAshigaruChoice` 等の一時 state で保持

**P3.2 — `feat(azuchi): per-sub-battle counter`**
- 新 `GameState` フィールド: `azuchiUsedThisSubBattle: { player: boolean; ai: boolean }`
- `continueAfterResolve` でリセット（サブバトル終了時に false に戻す）
- `case 'azuchi'` 追加 — 既使用なら no-op、未使用なら効果発動 + フラグ true
- 効果内容: **要確認**

**P3.3 — `feat(nobunaga): 南蛮貿易 doubles bonus`**
- `case 'nobunaga'` (636 行) に追加: ベンチに南蛮貿易があれば既存の atk/def ボーナスを 2 倍
- 「2 倍」が atk のみか def も含むか、敦盛+5 や封印効果も対象か **要確認**
- 既存ロジック構造変更が中規模、テスト要

---

### Phase 4 — トークン鉄砲システム（2-3 時間、2-3 commit）

**P4.1 — `feat(state): temp summon zone scaffold`**
- `GameState` に新フィールド: `tempSummons: { player: BattleCard[]; ai: BattleCard[] }`
- 初期化（`createInitialGameState`）、リセット（`continueAfterResolve` でサブバトル終了時クリア、`advanceToNextRound` でラウンド終了時クリア）
- 同名3枚制限の判定から除外（addToBench 系の上限チェックを通らない）
- パワー計算（`computeEffectivePower` 等）からも除外（戦闘参加なし）
- UI 表示: ベンチ横に小型表示 or ベンチ内サブセクション（**要確認**）

**P4.2 — `feat(nanban): summon token 鉄砲`**
- `case 'nanban'` 追加 — `tempSummons[side]` にトークン鉄砲を N 枚追加
- N 値・召喚タイミング（attacker / 自動 / 任意）は **要確認**
- トークンカードの ID: `token-gun-${stamp}-${i}` 等で派生扱い、ALL_BATTLE_CARDS の鉄砲を base に生成

**P4.3 — `feat(ashigaru,nagashino): count token guns in bench effects`**
- 足軽効果 (P3.1)、長篠の陣効果 (P2.2) のカウント計算に `tempSummons[side].filter(c => c.name === '鉄砲').length` を加算
- 織田信長効果 (`case 'nobunaga'` の `gunCount` も対象、line 643）

---

### Phase 5 — 明智光秀ルート確認（30 分、0-1 commit）

**P5.1 — 検証のみ（commit なしの可能性）**
- 本能寺の変発動 → 明智ルート 4 枚に置換 → ラウンド終了で消滅 → 信長デッキ復帰 を実機検証
- 本日 `d1241ef` で山札退避バグ修正済、これと併せて検証
- 不具合あれば追加 commit

---

## 4. 実装順序の推奨

```
Phase 1 (両 commit) → type check → 通し動作確認
  ↓
Phase 2.3 (馬防柵) ← 仕様確認後に実施。先送り可能
  ↓
Phase 2.1 + 2.2 (楽市楽座 + 長篠の陣)
  ↓
Phase 4.1 (state scaffold) ← 先に基盤作る
  ↓
Phase 3.2 (安土城カウンター) ← state パターン確立後
  ↓
Phase 4.2 + 4.3 (南蛮貿易 + カウント合流)
  ↓
Phase 3.1 (足軽 A/B) ← UI 重め、最後でも OK
  ↓
Phase 3.3 (信長 南蛮貿易バフ) ← Phase 4 完了後の方が安全
  ↓
Phase 5 (検証)
```

理由:
- Phase 1 は破壊的でなく即着手可能
- Phase 4.1 (state 基盤) を Phase 3.2/4.2 より先に作るとリファクタが減る
- Phase 3.3 は Phase 3.1/3.2/4 全て影響範囲なので最後

---

## 5. 朝、kk に必ず確認すべき不明点

実装着手前に明確化が必要な仕様（kk の「分からないまま実装しない」原則に従う）:

### 高優先度（実装ブロッカー）

1. **楽市楽座: 足軽戻しの発動条件**
   - 任意発動 (`OptionalEffect`) か、ベンチに公開された瞬間の自動発動か
   - 戻す対象: ベンチの足軽 / 除外の足軽 / デッキの足軽 / 全部?
   - 戻す枚数: 1 / N / 全部?
   - 戻す先: デッキトップ / デッキ底 / ベンチ?

2. **馬防柵: 「相手初撃-1」の「初撃」定義**
   - サブバトル毎の最初の攻撃 / ラウンドの最初 / バトル全体の最初?
   - 持続: 1 回限定 / ラウンド中継続 / バトル中?
   - kk が「万里の長城類似」と言うが、現行の万里の長城は passive defender bonus でデバフではない。挙動の違いを明確化

3. **足軽 A/B 選択: 各選択肢の効果内容**
   - A = 何? B = 何?
   - 発動タイミング: 公開時 / 攻撃時 / 防御時?

4. **安土城: カウンター効果**
   - 「サブバトル毎 1 回」何ができる?
   - 攻撃ボーナス / 防御ボーナス / カード回収 / 封印解除?
   - 任意発動か自動発動か

5. **南蛮貿易: トークン鉄砲召喚**
   - 召喚枚数 (1 / 2 / 3?)
   - 召喚タイミング (公開時 / 攻撃時?)
   - 上限あるか (累積禁止?)
   - 任意か自動か

6. **織田信長: 南蛮貿易 2 倍バフ**
   - 何を 2 倍? (atk のみ / def も / 敦盛+5 も / 封印効果も?)
   - 重複あるか (南蛮貿易 ×2 で 4 倍?)

### 中優先度（実装は進めるが調整可能）

7. **トークン鉄砲の UI 表示位置**
   - ベンチ内? ベンチ横? デッキ上?
   - 通常鉄砲との視覚的差別化（色・枠・ラベル）

8. **長篠の陣: 「鉄砲 3 枚」の定義**
   - 通常鉄砲のみ / トークン鉄砲も含む / ベンチ + デッキ全合計?
   - 「3 枚」は固定か、「3 枚以上」でスケールする (4 枚で +3 等)?

9. **織田信長 3/3 化のバランス影響**
   - Phase 1 単体で他デッキ vs 信長の勝率がどう変わるか
   - 通しテストの基準値（kk 仕様の「55% 前後」の対戦相手は誰?）

### 低優先度（リリース後でも可）

10. **明智ルートの再バランス可能性** — 4 枚の atk/def が現行で確定か、Phase 5 検証時に調整余地あるか

---

## 6. 影響範囲・リスク

### 他デッキへの波及
- Phase 1 (織田信長 3/3, 鉄砲 1/1) は他デッキ無関係
- Phase 4 (一時召喚ゾーン) の `GameState` 拡張は **全デッキの advanceToNextRound / continueAfterResolve に影響**。将来他デッキでも一時召喚を使う可能性あり、汎用設計推奨
- Phase 2.3 (馬防柵デバフ state) の `enemyFirstAttackDebuff` も同様、全デッキの reveal 経路を通る
- 安土城カウンター (`azuchiUsedThisSubBattle`) は信長専用なので影響少

### 既存テストへの影響
- `vitest` テストが信長デッキ・本能寺の変を直接カバーしているか不明 (要確認)
- 現行コードは `case 'nobunaga'` 周辺の挙動が複雑、Phase 3.3 で 2 倍化を入れる際にスナップショットテストがあれば破壊的
- 朝、Phase 1 着手前に `pnpm test` の existing 結果を確認

### バランス検証
- kk が「鉄砲サーチ・南蛮×信長・本能寺リセット・馬防柵」を強さの源泉と挙げているが、Phase 単位で実装する間は不完全な強さになる
- Phase 3 完了時点で「鉄砲 1/1 化＋シナジー未完成」で信長が弱すぎる窓が発生する可能性
- 対策: Phase 1 は Phase 2-4 のどれかと同日にまとめる、または Phase 1 を最後に回す

---

## 7. 朝の起動手順（推奨）

1. `git log --oneline origin/main | head -5` で最新確認 (`d1241ef` 本能寺修正が反映されているはず)
2. kk が本日の検証結果を共有 (ジャンヌ系 / 本能寺の変)
3. **§5 不明点 1-6 を kk に確認**
4. 確認結果を `NOBUNAGA_V7_PLAN.md` に追記してから Phase 1 着手
5. Phase 単位で commit → push → kk 検証 → 次 Phase

---

## 8. メモ: 本能寺の変 修正 (本日 `d1241ef`)

`knowledgeEngine.ts:1602` に 1 行追加:
```ts
for (const c of my.deck) newExileSelf.push(c);
```
これで本能寺発動時の山札残りも exile 経由で次ラウンド復帰する。明智ルート 4 枚は既存の `evolved-akechi-` プレフィックス + `revertEvolution` (line 3146) で消滅する。

朝の検証項目（kk のメッセージより）:
1. 本能寺の変発動 → 4 枚明智に
2. ベンチ空
3. 明智で戦闘
4. ラウンド終了
5. デッキが信長 15 枚復帰
6. ベンチ復帰
7. 明智カード消滅

PASS なら Phase 1 着手 OK。FAIL ならまず本能寺修正をフィードバック。
