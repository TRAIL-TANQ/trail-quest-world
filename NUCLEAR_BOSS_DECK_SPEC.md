# 原子爆弾デッキ ラスボス 完全仕様書

最終更新: 2026-04-20
ステータス: **仕様確定済 / 実装未着手**
対象ステージ: Stage 10「核の脅威」（既存、`stages.ts:119-126`）
関連ドキュメント: `NOBUNAGA_V7_PLAN.md`（信長 v7、優先度上）

> **本書の位置付け**: kk と Claude Code（Opus 4.7 1M context）が
> 2026-04-20 に確定した「Stage 10 ラスボス＝原子爆弾デッキ」
> の完全設計記録。実装は信長 v7 完走後に段階的着手。
> 後日実装する Claude Code への指示書として、ここに残す。

---

## 0. 本仕様の前提と既存コードベース現況

### 0.1 既存実装（2026-04-20 現在）

- `Stage 10` は `stages.ts:119-126` に既存（`isBoss: true`）
  - 現状: `npcDeckSize: 15, npcBenchSlots: 7`
  - npcDeckSeeds: `['マンハッタン計画', 'トリニティ実験', '相対性理論の論文']`
- 既存「原子爆弾」(card-103, SSR) — `specialEffect: 'nuke_trigger'` で
  `comboRequires: ['マンハッタン計画', 'トリニティ実験']` のコンボ系 (`knowledgeCards.ts:1583-1589`)
- 既存「マンハッタン計画」(card-101, R) — `specialEffect: 'nuke_ingredient_manhattan'`
- 既存「トリニティ実験」(card-102, R) — `specialEffect: 'nuke_ingredient_trinity'`
- 既存「アインシュタイン」(card-002, SR, atk4/def3) — effect `einstein`
- 画像納品済 (`85a4e30` 2026-04-20): 原爆カード10枚 + 対核カード3枚 = **計13枚の画像**配置済
  - `client/public/images/cards/` 配下に webp 配置（`little-boy.png` など命名は実コミット参照）

### 0.2 既存 `StageRules`（`stages.ts:11-25`）

```ts
interface StageRules {
  benchLimit?: number;            // player bench max (default 6)
  npcBenchSlots?: number;         // NPC bench max (default 6)
  npcDeckSize?: number;           // NPC initial deck (default 15)
  deckPhaseCards?: number;        // cards offered per deck phase (default 6)
  skipDeckPhase?: boolean;
  npcDeckPhasePickCount?: number;
  npcSynergyRate?: number;
  npcDoubleBenchEffect?: boolean;
  npcEffectMultiplier?: number;
  npcAttackBonus?: number; npcAttackBonusFilter?: string;
  npcDefenseBonus?: number; npcDefenseBonusFilter?: string;
}
```

→ ボス戦 20枚 / ベンチ8 / 対核プールは下記§3で必要拡張を整理。

---

## 1. コンセプト

- **テーマ**: 「核時代への警鐘」
- **核心メッセージ**: 「避けられない歴史の重み、対話と条約の力」
- **対象**: TRAIL QUEST WORLD Stage 10（ラスボス）
- **教育価値**: 歴史教材として、子どもに核問題を体感させる

---

## 2. ボス戦特別ルール

| 項目 | 通常 | ボス戦 |
|---|---|---|
| デッキサイズ | 15枚 | **20枚（お互い）** |
| ベンチ上限 | 6枚 | **8枚（お互い）** |
| 対核カード | なし | **プレイヤーのデッキフェイズに3枚混入** |

### 2.1 必要な StageRules 拡張

| 新フィールド | 役割 |
|---|---|
| `playerDeckSize?: number` | プレイヤー初期デッキ枚数（デフォ 15、ボス戦 20） |
| `benchLimit: 8` | 既存項目を Stage 10 で 8 に設定 |
| `npcBenchSlots: 8` | 既存項目を 7 → 8 に変更 |
| `npcDeckSize: 20` | 既存項目を 15 → 20 に変更 |
| `deckPhaseExtraCards?: string[]` | プレイヤーのデッキフェイズに必ず混ぜるカード名リスト（対核3枚） |

### 2.2 既存ハードコードの除去

- `INITIAL_DECK_SIZE = 15` 直参照箇所（`knowledgeCards.ts:1740/1741/1834/1839`,
  `stages.ts:494/500/506/508`）を `playerDeckSize` パラメータ化
- `buildValidDeck` / `validateStarterDeck` のサイズチェックを動的化
- `KnowledgeChallenger.tsx:1188` の `cardCount = rules?.deckPhaseCards ?? 6`
  に加えて、`deckPhaseExtraCards` 強制混入ロジックを追加

---

## 3. 原子爆弾デッキ構成（20枚）

### 3.1 SSR（3枚）

#### 1. リトルボーイ ×1
- 攻/防: **8/1**
- デッキ内 1枚制限
- **起動条件**: `trinitySuccess` && `uraniumReady` && `oppenheimerReady` && `!littleBoyDelivered`
- 全条件充足で**自動的にデッキトップへ移動**（サーチ系）
- **公開時の効果**:
  - 相手側: ベンチ全除外 + デッキ5枚除外
  - 自分側: B-29がベンチにあれば**無傷**、なければ**ベンチ全除外+デッキ5枚除外**（相互破壊）
- 投下後: `littleBoyDelivered = true` フラグ
- 歴史: 1945年8月6日 広島投下、ウラン型

#### 2. ファットマン ×1
- 攻/防: **9/1**
- デッキ内 1枚制限
- **起動条件**: `trinitySuccess` && `plutoniumReady` && `oppenheimerReady` && `!fatManDelivered`
- 全条件充足で自動的にデッキトップへ移動
- 効果: リトルボーイと同一（B-29チェックも同一）
- 投下後: `fatManDelivered = true` フラグ
- 歴史: 1945年8月9日 長崎投下、プルトニウム型

#### 3. ロバート・オッペンハイマー ×1（Trump）
- 攻/防: **2/4**
- triggerType: passive
- ベンチ常駐で核関連カードを強化（具体強化値は実装時に kk と再確認）
- 起動条件の1つ（ベンチ有であること）
- 歴史: マンハッタン計画の科学的指導者

### 3.2 SR（7枚）

#### 4-5. B-29 エノラ・ゲイ ×1
- 攻/防: **3/3**
- triggerType: passive
- ベンチ常駐で、リトルボーイ／ファットマン発動時に**使用者を無傷にする**
- 歴史: リトルボーイを運んだ爆撃機（広島）／ボックスカーは長崎、本仕様では「B-29」として一括

> **注**: 「B-29 ×1」と記載されているが、冒頭リストでは「4-5」のスロット
> 番号で示されているため、デッキに**1枚**でよいのか**2枚（広島用・長崎用）**
> なのか実装時に kk 再確認のこと（kk の元仕様には ×1 と書かれている）。

#### 6. トリニティ実験・極秘 ×1（新規 SR）
- 攻/防: **1/3**
- 既存「トリニティ実験 R」(card-102) の **SR 版として別カード実装**
- 公開時効果: `trinitySuccess` フラグを `true` にセット
- 起動条件の1つ
- 歴史: 1945年7月16日 人類初の核爆発実験

#### 7. アインシュタイン ×1
- **既存カード活用** (card-002)
- 既存効果 `einstein`（相対性理論+光速のシナジー）維持
- **追加効果**: 原爆デッキ内で核関連カード強化を併存
- 実装: 条件判定で両効果発動（併存ロジックは `case 'einstein'` 拡張）

#### 8-10. マンハッタン計画・極秘 ×3（新規 SR）
- 攻/防: **2/3**
- 公開時: デッキから「トリニティ実験」「リトルボーイ」「ファットマン」
  のいずれか1枚をデッキトップへサーチ
- デッキ3枚制限
- kk 設計意図: サーチ系を増やしてデッキ回転率アップ、
  「組織的な科学開発の加速」の表現
- 既存「マンハッタン計画 R」(card-101) とは**別カード**として実装

#### 11-12. ロスアラモス研究所 ×2（新規 SR）
- 攻/防: **1/4**
- 公開時: デッキから「オッペンハイマー」「ウラン235」「プルトニウム239」
  のいずれか1枚をデッキトップへサーチ
- デッキ2枚制限
- kk 設計意図: 起動条件カードの準備加速

### 3.3 R（4枚）

#### 13. 核分裂 ×1
- 攻/防: **2/2**
- 公開時: 自ベンチのN1枚除外で攻撃+3
- (任意発動 / 強制発動は実装時に再確認、kk pseudocode は強制と読める)

#### 14. ウラン235 ×1
- 攻/防: **1/3**
- triggerType: passive
- ベンチ+1で核分裂の攻撃+1（**スタッカブル**）
- 起動条件の1つ（ベンチ有であること）→ リトルボーイ発動

#### 15. プルトニウム239 ×1
- 攻/防: **1/3**
- triggerType: passive
- ベンチ+1で防御+1（スタッカブル）
- 起動条件の1つ → ファットマン発動

#### 16. マンハッタン計画 ×2（既存）
- **既存「マンハッタン計画 R」(card-101)** をそのまま活用
- 既存効果 `specialEffect: 'nuke_ingredient_manhattan'` 維持
- 新規 SR 版（§3.2 #8-10）とは別物として共存

### 3.4 N（3枚）

#### 17. 広島原爆ドーム ×1
- 攻/防: **0/3**
- triggerType: passive
- ベンチ常駐で、自カード破壊時 +3ファン

#### 18. 被爆者の証言 ×1
- 攻/防: **0/2**
- 公開時: 相手のSSR 1枚の攻撃-3（そのラウンド中）

#### 19-20. 科学者 ×2
- 攻/防: **1/1**
- 公開時: ベンチにオッペンハイマー or アインシュタインがいれば攻撃+1

---

## 4. 対核カード（プレイヤー側、ボス戦限定）

プレイヤーのデッキフェイズで3枚が候補に含まれる（`deckPhaseExtraCards` 機構）:

#### 対核1. 核兵器禁止条約（TPNW） — R 2/3
- 公開時: 相手SSR「リトルボーイ」or「ファットマン」を**除外**
- 歴史: 2017年採択、2021年発効

#### 対核2. 包括的核実験禁止条約（CTBT） — R 1/3
- 公開時: 相手の `trinitySuccess` フラグを `false` に戻す
- 歴史: 1996年採択

#### 対核3. 折り鶴 — N 0/2
- triggerType: passive
- ベンチ常駐、自カード除外時 +2ファン
- 歴史: サダコ・ササキ、千羽鶴

---

## 5. 起動条件システム（実装仕様）

```typescript
// state extension (新フィールドを GameState に追加)
interface AtomicConditions {
  trinitySuccess: boolean;     // トリニティ実験成功
  uraniumReady: boolean;        // ウラン235ベンチ有
  plutoniumReady: boolean;      // プルトニウム239ベンチ有
  oppenheimerReady: boolean;    // オッペンハイマーベンチ有
  littleBoyDelivered: boolean;  // リトルボーイ投下済み
  fatManDelivered: boolean;     // ファットマン投下済み
}

interface GameState {
  // ... 既存
  atomicConditions: { player: AtomicConditions; ai: AtomicConditions };
}

function isLittleBoyReady(conds: AtomicConditions): boolean {
  return conds.trinitySuccess
    && conds.uraniumReady
    && conds.oppenheimerReady
    && !conds.littleBoyDelivered;
}

function isFatManReady(conds: AtomicConditions): boolean {
  return conds.trinitySuccess
    && conds.plutoniumReady
    && conds.oppenheimerReady
    && !conds.fatManDelivered;
}

// 条件充足時、デッキトップに自動移動（reveal フックや bench 配置時に判定）
function checkAtomicConditions(state: GameState, side: Side): GameState {
  const conds = state.atomicConditions[side];
  let next = state;
  if (isLittleBoyReady(conds)) {
    next = moveToDeckTop(next, side, 'リトルボーイ');
    // 緊迫テロップ: ☢️ リトルボーイ起動！広島への影
  }
  if (isFatManReady(conds)) {
    next = moveToDeckTop(next, side, 'ファットマン');
    // 緊迫テロップ: ☢️ ファットマン起動！長崎への影
  }
  return next;
}

// 原子爆弾公開時の効果（リトルボーイ・ファットマン共通）
function atomicBombEffect(
  state: GameState,
  attackerSide: Side,
  bombType: 'little-boy' | 'fat-man',
): GameState {
  const defenderSide = otherSide(attackerSide);

  // 相手は必ず被害
  let next = exileAllBench(state, defenderSide);
  next = exileDeckTop(next, defenderSide, 5);

  // 自分側: B-29チェック
  const myBench = (attackerSide === 'player' ? next.player : next.ai).bench;
  const hasB29 = myBench.some(slot => slot.card.name === 'B-29 エノラ・ゲイ');

  if (!hasB29) {
    // 相互破壊
    next = exileAllBench(next, attackerSide);
    next = exileDeckTop(next, attackerSide, 5);
    // テロップ: 💥 相互破壊！両陣営に壊滅的被害
  } else {
    // B-29で無傷
    // テロップ: ✈️ エノラ・ゲイが運ぶ / ボックスカーが運ぶ
  }

  // 投下済みフラグ
  if (bombType === 'little-boy') {
    next.atomicConditions[attackerSide].littleBoyDelivered = true;
  } else {
    next.atomicConditions[attackerSide].fatManDelivered = true;
  }

  return next;
}
```

### 5.1 状態管理のライフサイクル

- 初期化: `createInitialGameState` で両 side の `AtomicConditions` を全 false
- 更新タイミング:
  - `trinitySuccess`: トリニティ実験・極秘 公開時 → true
  - `uraniumReady` / `plutoniumReady` / `oppenheimerReady`: bench 出入りに連動して都度評価
  - `littleBoyDelivered` / `fatManDelivered`: 公開時の `atomicBombEffect` 内で true に
- リセット:
  - `littleBoyDelivered` / `fatManDelivered` は**バトル全体で永続**（再投下不可）
  - `trinitySuccess` も基本永続（CTBT で false に戻されるケース有り）
  - サブバトル / ラウンド境界では**リセットしない**（ラスボス1戦完結のため）

---

## 6. 実装推定工数

| 作業 | 工数 |
|---|---|
| 新規13カード登録（cardData.ts + knowledgeCards.ts + 効果実装） | 4-6時間 |
| 既存カード昇格・効果調整（マンハッタン×3 SR / トリニティ SR / アインシュタイン併存効果） | 1-2時間 |
| 起動条件システム実装（`AtomicConditions` state + 5つの判定 + デッキトップ移動） | 1-2時間 |
| ボス戦ルール拡張（`playerDeckSize` 追加 + INITIAL_DECK_SIZE 直参照解消 + benchLimit/npcBenchSlots 8 化） | 1-2時間 |
| デッキフェイズ分岐（`deckPhaseExtraCards` 機構） | 1-2時間 |
| 緊迫演出（テロップ・SE・点滅） | 1時間 |
| Stage 10統合・実機テスト・バランス調整 | 1-2時間 |
| **合計** | **10-17時間** |

---

## 7. Manus 発注状態

- ✅ **画像納品済 2026-04-20** (`85a4e30`)
- 配置先: `client/public/images/cards/`
  - 原爆デッキ側 (10枚): `little-boy.png`, `fat-man.png`, `oppenheimer.png`,
    `enola-gay-b29.png`, `nuclear-fission.png`, `uranium-235.png`,
    `plutonium-239.png`, `hiroshima-dome.png`, `hibakusha-testimony.png`,
    `scientist.png`
  - 対核カード (3枚): `tpnw-treaty.png`, `ctbt-treaty.png`, `origami-crane.png`
- 未納品: 「ロスアラモス研究所」「マンハッタン計画・極秘」「トリニティ実験・極秘」
  の3点（既存名と差別化された極秘版が必要なら追加発注、もしくは既存画像流用判断）

---

## 8. kk 設計思想

> **「核時代への警鐘」**
>
> - 原爆デッキは「使うデッキ」ではなく「**条件が揃うと使われる**デッキ」
> - プレイヤーは対核カードで歴史を変えられる
> - 子どもたちに「避けられない流れ」と「対抗する希望」の両方を体感させる
> - TRAIL の教育理念: 「面白い！が出発点」で歴史を学ぶ

---

## 9. 実装優先順位

1. **信長デッキ v7 完走** (Phase 2 完了済 / Phase 3-5 残)
2. 本仕様書の最終確認・残不明点の解消（§10 参照）
3. ロスアラモス／極秘版カード画像の判断（既存流用 or Manus 追加発注）
4. 本デッキ実装（段階的 commit）
   - Phase A: `StageRules` 拡張 + 既存カードの昇格・効果併存
   - Phase B: 新規13カード登録（stat + 効果ハンドラ）
   - Phase C: `AtomicConditions` state + 起動条件チェック
   - Phase D: 原子爆弾公開時効果（B-29 守護 / 相互破壊）
   - Phase E: 対核カード3枚 + `deckPhaseExtraCards` 機構
   - Phase F: 緊迫演出 + Stage 10 統合
5. 実機テスト・バランス調整

---

## 10. 実装着手前の最終確認事項（kk 判断必要）

1. **マンハッタン計画 SR 版は既存 R 版と別カード（別 ID）か？**
   - 別カード前提で本仕様書を書いた（既存 card-101 は R 2/2 のまま温存、
     新規「マンハッタン計画・極秘」を SR 2/3 で別 ID 採番）
2. **トリニティ実験 SR 版も同様の別カード扱いで OK か？**
3. **アインシュタイン併存効果の具体内容**
   - 既存 `einstein` case はそのまま、原爆デッキ条件で追加発動する形か？
   - 何を強化（核関連の atk +X / def +Y / 起動条件加速?）
4. **オッペンハイマーの passive 強化値**
   - 「核関連カードを強化」の具体（atk+/def+/効果+）
5. **B-29 を 1枚 or 2枚**（広島用・長崎用で分けるか）
6. **核分裂効果は強制発動 or 任意発動**
   - 自ベンチN除外がコストとなる挙動なので、任意発動が自然
7. **原爆投下効果の演出の重さ**
   - 子ども向け教育コンテンツとして、どこまでショックを抑えるか
   - テロップ表現の最終確認
8. **対核カード3枚はプレイヤーのデッキフェイズで「必ず提示」か「ランダムで含める」か**
   - 必ず提示なら `deckPhaseExtraCards` を強制混入
   - ランダムなら `deckPhaseExtraCardPool` 等別機構

---

## 11. 関連ドキュメント

- `NOBUNAGA_V7_PLAN.md` — 信長 v7 実装計画（本仕様書より優先）
- `SESSION_2026-04-20.md` — 本仕様書作成日のセッション記録
- 関連既存ファイル:
  - `client/src/lib/cardData.ts` — カード UI メタデータ
  - `client/src/lib/knowledgeCards.ts` — カード stats / effect 定義 / EFFECT_BY_CARD_NAME
  - `client/src/lib/knowledgeEngine.ts` — reveal effect handler / passive bench effects
  - `client/src/lib/stages.ts` — Stage 10 設定 / StageRules 型

---

## 12. 2026-04-21 判断記録（kk）

> 本章は 2026-04-21 に kk が確定した Phase ボス-A / ボス-B 着手前の設計判断記録。
> §2 / §3 / §4 / §10 の**上書き仕様**として扱う（古い記述と矛盾があれば本章を優先）。

### 12.1 ボス戦ルール（Phase ボス-A）

| 項目 | 確定値 | 実装メモ |
|---|---|---|
| プレイヤー初期デッキ | **15 枚**（starter のまま） | ビルダー側は 15 枚で固定。ボス戦のみ ラウンド間デッキフェイズで +2/ラウンドずつ増えていき最大 20 枚到達 |
| プレイヤー最大デッキ | **20 枚**（ボス戦時） | `StageRules.playerDeckSize` で上書き可。`MAX_DECK_SIZE` のハードコードも同様に stageRules 経由で可変化 |
| AI 初期デッキ | **20 枚** | `StageRules.npcDeckSize: 20` |
| プレイヤーベンチ | **8 枠** | `StageRules.benchLimit: 8` |
| AI ベンチ | **8 枠** | `StageRules.npcBenchSlots: 8` |
| デッキフェイズ強制混入枠 | 対核 5 枚プールから提示 | `StageRules.deckPhaseExtraCards?: string[]` 新規 |
| ベンチ 8 枠 UI | 実装後実機確認で判断 | **案 A: 横 1 列 8 枠カード縮小** で試作、崩れれば **案 B: 2 段ベンチ (4×2)** |

#### 判断理由（kk）
- ビルダー 20 枚化は「全ステージに影響、整合性崩れる」ため却下
- 「ラウンド進行でデッキが成長」のドラマ性を活かす
- 対核カードを含む戦略的選択が可能になる

### 12.2 核デッキ 20 枚構成（§3 の上書き）【2026-04-21 kk 最終確定】

kk 指示:「**もっと同名カードふやしなさい。せめて 12 種くらいにしないとすぐベンチオーバーする**」

同名を多めにしてベンチ stacking で枠を圧縮する設計。**12 種 / 20 枚**:

| # | カード | rarity | 枚数 | 役割 |
|---|---|---|---|---|
| 1 | リトルボーイ | SSR | 1 | 1 枚制限、起動条件付き |
| 2 | ファットマン | SSR | 1 | 1 枚制限、起動条件付き |
| 3 | ロバート・オッペンハイマー | SSR | **2** | 起動条件カード、passive bench 強化。**同名追加** |
| 4 | B-29 エノラ・ゲイ | SR | **2** | 核兵器使用者の無傷守護。**同名追加** |
| 5 | トリニティ実験・極秘 | SR | 1 | `trinitySuccess` トリガー |
| 6 | マンハッタン計画・極秘 | SR | 3 | サーチ（トリニティ/リトルボーイ/ファットマン） |
| 7 | ロスアラモス研究所 | SR | **3** | サーチ（オッペンハイマー/ウラン/プルトニウム）。**+1** |
| 8 | 核分裂 | R | 2 | ベンチ N 除外で攻撃 +3 |
| 9 | ウラン235 | R | 2 | リトルボーイ起動条件、stackable |
| 10 | プルトニウム239 | R | 2 | ファットマン起動条件、stackable |
| 11 | 科学者 | N | 1 | オッペンハイマー/アインシュタイン bench で攻撃 +1 |
| | **合計** | | **20 枚 / 12 種** | |

#### §3 からの変更点
- **追加**: オッペンハイマー ×2（+1）、B-29 ×2（+1）、ロスアラモス ×3（+1）
- **据え置き**: マンハッタン計画・極秘 ×3、ウラン235 ×2、プルトニウム239 ×2、核分裂 ×2
- **削減**: 科学者 ×2 → ×1
- **削除**: マンハッタン計画（既存 R ×2）、アインシュタイン（SR ×1）、広島原爆ドーム（N ×1）、被爆者の証言（N ×1）
  - 広島・被爆者の証言は **プレイヤー側対核プール** へ移動（§12.3）
  - マンハッタン計画（既存 R）・アインシュタインは AI デッキから外し、プレイヤーが通常引ける状態に戻す

#### ベンチ 8 枠運用の効率（kk 設計意図）
同名カードはベンチで 1 スロットに stack される仕様（既存 `bench: { name, count }[]` 構造）。

| スタック例 | ベンチ使用スロット |
|---|---|
| オッペンハイマー ×2 | 1 |
| B-29 ×2 | 1 |
| ウラン235 ×2 | 1 |
| プルトニウム239 ×2 | 1 |
| 核分裂 ×2 | 1 |
| マンハッタン計画・極秘 ×3 | 1 |
| ロスアラモス研究所 ×3 | 1 |
| **計** | **7 スロット**で主要 15 枚を収容 |

→ ベンチ 8 枠で起動条件カード全員を並べてもあふれない。「ベンチオーバー」回避と起動条件充足の両立が成立。

#### 同名重複サマリ（12 種構成）
- マンハッタン計画・極秘: 3 枚
- ロスアラモス研究所: 3 枚
- オッペンハイマー: 2 枚
- B-29: 2 枚
- 核分裂: 2 枚
- ウラン235: 2 枚
- プルトニウム239: 2 枚
- 単独 5 種: リトルボーイ / ファットマン / トリニティ・極秘 / 科学者
- **同名重複合計: 16 枚 / 7 種**

#### 起動条件充足の確実性（kk 確認）
- トリニティ成功: マンハッタン計画・極秘 ×3 のサーチで確実に引ける
- ウラン235 有: デッキ ×2 + ロスアラモス ×3 サーチで保証
- プルトニウム239 有: デッキ ×2 + ロスアラモス ×3 サーチで保証
- オッペンハイマー 有: デッキ ×2 + ロスアラモス ×3 サーチで過剰供給
- リトルボーイ / ファットマン: マンハッタン計画・極秘 ×3 でサーチ可能

### 12.3 対核カード プール 5 枚化（§4 の上書き）

以前の 3 枚 → **5 枚プール**に拡張。デッキフェイズで候補提示（提示方式は下記 12.5 で確認）:

| # | カード | rarity | 現行効果（§3.4 / §4 由来） | 所属変更 |
|---|---|---|---|---|
| 1 | 核兵器禁止条約（TPNW） | R | 相手 SSR「リトルボーイ」or「ファットマン」除外 | 既存 |
| 2 | 包括的核実験禁止条約（CTBT） | R | 相手 `trinitySuccess` を false に戻す | 既存 |
| 3 | 折り鶴 | N | ベンチ常駐、自カード除外時 +2 ファン | 既存 |
| 4 | **広島原爆ドーム** | N | ベンチ常駐、自カード破壊時 +3 ファン（平和 passive） | **AI → プレイヤー** |
| 5 | **被爆者の証言** | N | 公開時、相手 SSR 1 枚の攻撃-3 | **AI → プレイヤー** |

### 12.4 ラウンド進行強化方式（§5 との関係）

**案 X 採用**: 既存の起動条件システム（§5）で自然実現。新機構の追加実装は不要。

ラウンドフロー:
- **Round 1（準備フェーズ）**: マンハッタン計画（既存 R ×2）/ マンハッタン計画・極秘（SR ×3）でサーチ
- **Round 2（条件充足フェーズ）**: トリニティ実験・極秘 / ウラン235 ×2 / プルトニウム239 ×2 / オッペンハイマー がベンチへ集結
- **Round 3（発動フェーズ）**: 全条件充足で リトルボーイ / ファットマン が自動デッキトップへ移動 → 公開・投下

### 12.5 確認事項（実装着手前に kk 再確認）

§10 の 8 項目に加えて、本章で発生した新規確認項目:

| # | 項目 | 推奨 |
|---|---|---|
| 12-A | ~~21 枚 vs 20 枚の枚数調整~~ | **解決済**（§12.2 改訂で 12 種 20 枚確定） |
| 12-B | 対核カード 5 枚プールの提示方式 | **強制 3/5 提示** 推奨（ランダム候補ではなく必ず混入） |
| 12-C | 広島原爆ドーム・被爆者の証言 は AI 側で再登場しないことの明示 | `DRAFTABLE_BATTLE_CARDS` の AI プール除外 ルール追加 |
| 12-D | ベンチ 8 枠のレイアウト | **案 A（横 1 列縮小）** で試作 → 実機確認 |
| 12-E | `MAX_DECK_SIZE` の上書き粒度 | `StageRules.playerDeckSize` が `MAX_DECK_SIZE` も兼ねる（単一パラメータで 20 枚化） |
| 12-F | マンハッタン計画（既存 R）・アインシュタインを AI 核ボスデッキから除外した件 | §12.2 で削除済。通常プール維持（プレイヤーは引き続き使用可）|
| 12-G | 科学者 ×1 化でボス支援は十分か | ロスアラモス ×3 + オッペンハイマー ×2 で支援系が厚いため ×1 で可 |

### 12.6 リトルボーイ・ファットマン 特殊発動仕様（2026-04-20 kk 確定）

> **注**: 当初 §12.3 として想定されたが、§12.3 は既に「対核カード プール 5 枚化」で使用済のため、本章末尾に §12.6 として配置。

#### カード特性

| 項目 | 仕様 |
|---|---|
| カードタイプ | 特殊発動カード（`special_trigger`） |
| 通常ドロー | **対象外**（デッキに含まれるが、ドロー処理では引かれない） |
| 配置タイミング | **A 案**: 起動条件充足時、デッキトップへ自動移動 → 次のドローで自然に引かれる |
| 発動後 | **除外**（1 ゲーム 1 回のみ） |
| 条件未達のまま試合終了 | **デッキに残る**（特別処理なし、「使われなかった核」として扱う） |

#### 起動条件（各独立判定）

**リトルボーイ**（ウラン型）:
- `trinitySuccess = true`
- **ウラン235** がベンチにあり、かつ非封印
- **オッペンハイマー** がベンチにあり、かつ非封印

**ファットマン**（プルトニウム型）:
- `trinitySuccess = true`
- **プルトニウム239** がベンチにあり、かつ非封印
- **オッペンハイマー** がベンチにあり、かつ非封印

> 両方同時充足も、片方のみ充足もあり得る。歴史的正確性（ウラン型 = 広島、プルトニウム型 = 長崎）を反映。

#### 発動効果

| 対象 | 被害 |
|---|---|
| 相手 | ベンチ全除外 + デッキ 5 枚除外 |
| 自分（B-29 エノラ・ゲイ ベンチ有） | **無傷**（投下機体による保護） |
| 自分（B-29 ベンチ無） | 相手と同じ被害（**相互破壊** = MAD） |

#### 起動フロー

1. 起動条件変化時（ベンチ配置、ターン開始、`trinitySuccess` トグル等）にチェック
2. 条件充足 → 該当カードをデッキ内から検索しデッキトップへ移動
3. 緊迫テロップ表示
   - 「☢️ リトルボーイ起動！広島への影」
   - 「☢️ ファットマン起動！長崎への影」
4. 次のドローフェーズで自然に最優先ドロー
5. 通常の攻撃カードとして公開 → 効果発動
6. 発動後 `littleBoyDelivered` / `fatManDelivered = true`、カードを除外へ

#### 実装に必要な新メカニクス（Phase ボス-B で着手）

- カードタイプ識別: `isSpecialTrigger` フラグ
- ドロー処理の分岐: 通常カード vs 特殊発動カード
- 起動条件チェックロジック（ベンチ・ステート変化のフック）
- デッキトップ移動処理 + 緊迫テロップ
- 発動後除外 + 2 回目発動ロック

#### 教育的意図

条件未達のまま終了 = **核抑止成功**。「使われなかった核兵器」も歴史的事実であり、「核は使われないのがベスト」という教育的メッセージを内包する。

---

## 13. Phase ボス-A / ボス-B 工程（2026-04-21 確定）

### Phase ボス-A: ボス戦ルール基盤（4.5-7.5 時間）

| # | 作業 |
|---|---|
| A-1 | `StageRules` に `playerDeckSize?: number` / `deckPhaseExtraCards?: string[]` 追加 |
| A-2 | `createInitialDeck(size?)` / `validateDeck(deck, maxSize?)` / `canAddCardToDeck(deck, card, maxSize?)` パラメータ化 |
| A-3 | `INITIAL_DECK_SIZE` / `MAX_DECK_SIZE` 直参照箇所を `stageRules.playerDeckSize ?? INITIAL_DECK_SIZE` に置換 |
| A-4 | Stage 10 設定更新: `{ playerDeckSize: 20, npcDeckSize: 20, benchLimit: 8, npcBenchSlots: 8 }` |
| A-5 | `deckPhaseExtraCards` 強制混入ロジック（`KnowledgeChallenger.tsx` L1188 付近） |
| A-6 | ベンチ 8 枠 レイアウト 試作（案 A: 横 1 列縮小） |
| A-7 | ルール説明の拡張（「デッキ 20 枚 / ベンチ 8 枠」表示）|
| A-8 | 型チェック・統合テスト・push |

### Phase ボス-B: 核デッキ実装（10-17 時間、§6）

§6 の工程（新規 13 カード効果実装 + AtomicConditions state + B-29 守護 + 相互破壊 + 対核 5 枚プール + 緊迫演出）に以下を追加:

- ウラン235 / プルトニウム239 を ×2 化（stackable 効果の機構検証含む）
- 対核プールを 3 枚 → 5 枚化（広島ドーム・被爆者の証言のプレイヤー側移動）
- AI ドラフト時、広島ドーム・被爆者の証言を除外するフィルタ追加

### 着手タイミング
- **信長 v7 Phase 3 完了 or 中断可能ポイント到達後**
- kk 実機検証（2026-04-20 深夜 push 分）完了後

### 優先順位（確定）
1. 🔥 信長 v7 Phase 3（進行中）
2. 🔥 実機検証（武器スタック + ピラニア条件化）
3. 🟡 Phase ボス-A
4. 🟡 Phase ボス-B
5. 🟢 カード分類 Phase 1-5
