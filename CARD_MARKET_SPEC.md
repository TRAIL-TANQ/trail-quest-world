# CARD_MARKET_SPEC.md

**プロジェクト**: TRAIL QUEST WORLD (TQW)
**機能名**: TRAIL カード市場 (Card Market)
**バージョン**: v1.1
**最終更新**: 2026-04-21
**作成者**: kk + Claude

---

## 📝 改訂履歴

### v1.1 (2026-04-21) — 既存コードベース整合性対応

v1.0 に対する `CARD_MARKET_SPEC_REVIEW.md` の指摘事項を反映。主な変更点:

| 章 | v1.0 → v1.1 変更 | 該当指摘 |
|---|---|---|
| § DBスキーマ | 🔄 全RLSポリシーを `auth.uid()` 方式から SECURITY DEFINER RPC + anon 全拒否方式へ書き換え | 🔴-1 |
| § DBスキーマ | 🔄 `child_card_acquisitions` 新規テーブルを廃止、既存 `gacha_pulls` に `source` カラム追加で統一 | 🔴-3 |
| § 保護カードポリシー | 🆕 新規セクション追加 (進化専用7枚 + 進化トリガー3枚の売却禁止リスト) | 🔴-4 |
| § 保護カードポリシー | 🆕 `sellable` フラグは `knowledgeCards.ts` マスタに追加、DBには持たせない | kk 回答項目2 |
| § 不正対策 | 🔄 競合制御を「楽観ロック」から「RPC内 `SELECT ... FOR UPDATE`」へ変更 | 🔴-2 |
| § UI設計 | 🔄 Shop タブ構成を `ガチャ | 直販 | 売却 | 市場情報` の4タブに確定 | kk 回答項目3 |
| § UI設計 | 🆕 デッキ組み込み中カードはグレーアウト + ツールチップ | kk 回答項目4 |
| § API設計 | 🔄 REST API を全て SECURITY DEFINER RPC に書き換え | 🔴-1 / 🔴-2 |
| § 実装フェーズ | 🔄 Phase 1 工数 15-20h → **25-30h**、統合タスクを Phase 1 内に明記 | kk 回答項目6 |
| § 既存コードとの統合方針 | 🆕 新規セクション追加 (gacha_pulls 拡張、altGameService.ts 統合、myDecks.ts 連携) | kk 回答項目1/6 |
| § 開発時の注意点 | 🔄 マイグレーション番号 `0029_card_market.sql` に確定 | 🟡-2 |
| § 既存ALT更新系の扱い | 🆕 既存ガチャ/ショップのRPC化リファクタは Phase 外、別PR化と明記 | kk 回答項目7 |

#### v1.1 インプレース更新 (2026-04-21 追記) — Phase 1 スコープ拡張

**変更**: Phase 1 の実装フェーズ記述を「固定価格・売却のみ」から「動的価格・売買両方」へ変更。成功条件側 (kk 当初ビジョン) に実装フェーズ側を合わせる形で整合させた。

**背景**: kk 当初ビジョン「買われると高く、売られると安く」の本質は動的価格。固定価格 MVP → 動的価格移行は二度手間になるため、最初から動的価格で実装する。

**影響範囲**: § 実装フェーズ のみ (DB スキーマ / RPC 実装パターン / RLS 設計 / 保護カードポリシー / UI 設計は変更なし)。旧 Phase 2 (動的価格) を Phase 1 に統合し、旧 Phase 3/4 を Phase 2/3 に繰り上げ。

**工数**: 25-30h 据え置き (元の内訳に動的価格 + buy RPC が含まれていた想定)。Commit C が「売却 RPC + 動的価格計算」、Commit E (直販) も Phase 1 内に確定。

**Commit 順序**:
- Commit A: 0029_card_market.sql (DB DDL) ← 完了
- Commit B: 初期価格マスタ投入
- Commit C: 売却 RPC + 動的価格計算 (calculatePrice) + ±30%ガード
- Commit D: 売却 UI 単体
- Commit E: 直販 buy RPC + UI
- Commit F: 市場情報タブ (トレンドのみ、チャートは Phase 2)
- Commit G: グレーアウト + ツールチップ (保護カード / デッキ組み込み)
- Commit H: テスト一式

### v1.0 (2026-04-21) — 初版

初版作成 (kk + Claude)。

---

## 🎯 目的と設計哲学

### ビジネス目的
- カード収集の動機を「バトル勝利」から「市場価値」へ拡張
- ALT 経済に蛇口/排水口を設け、インフレを防ぎつつ流動性を生む
- プレイヤーのリテンション向上 (価格変動を毎日チェックする習慣形成)

### 教育目的 (TRAIL 教育スタンスとの整合)
- **需要と供給の原理** を体験的に学ぶ
- **意思決定の可視化** (いつ買うか、いつ売るか)
- **データリテラシー** (価格チャートを読む力)
- **衝動抑制** (感情的な売買を避ける判断力)

### 設計原則
1. **プレイヤー間取引は禁止** (法務リスク回避)
2. **運営が唯一の買取/販売相手** (市場コントロール可能)
3. **需給のみで価格決定** (恣意的価格操作なし、透明性)
4. **投機抑制設計** (買い→即売りで利益が出ない)
5. **教育要素の明示** (市場学習ツールとして機能)

---

## 📊 初期価格設計

### レアリティ別基準価格

| レアリティ | 基準価格 (ALT) | 初期売却価格 | 初期購入価格 | マージン |
|-----------|---------------|-------------|-------------|---------|
| **N** (ノーマル) | 50 | 30 | 50 | 40% |
| **R** (レア) | 200 | 120 | 200 | 40% |
| **SR** (スーパーレア) | 1,000 | 600 | 1,000 | 40% |
| **SSR** (ウルトラレア) | 5,000 | 3,000 | 5,000 | 40% |

**マージン 40% の意味**:
- 売却価格 = 購入価格 × 0.6
- 買って即売ると 40% 損失 = 投機抑制
- 運営マージン = ALT 経済の安定化弁

---

## 💹 動的価格変動ロジック

### 基本式

```typescript
const calculatePrice = (card: Card): PriceResult => {
  const basePrice = getBasePrice(card.rarity);
  const netDemand = card.totalPurchases - card.totalSales;
  const sensitivity = 50; // β: 感度定数

  // 需給係数 (0.3 ~ 3.0 の範囲にクランプ)
  const coefficient = Math.max(
    0.3,
    Math.min(3.0, (netDemand / sensitivity) + 1)
  );

  const buyPrice = Math.round(basePrice * coefficient);
  const sellPrice = Math.round(buyPrice * 0.6);

  return { buyPrice, sellPrice, coefficient };
};
```

### 変動範囲
- **下限係数**: 0.3 (基準の30%まで下落、大暴落防止)
- **上限係数**: 3.0 (基準の3倍まで上昇、バブル抑制)
- **感度 β**: 50 (調整可能、初期値)

### 変動例 (SR: 基準1,000 ALT)

| 状況 | 純需給 (購入-売却) | 係数 | 購入価格 | 売却価格 |
|------|------------------|-----|---------|---------|
| 初期 | 0 | 1.0 | 1,000 | 600 |
| 人気↑ | +25 | 1.5 | 1,500 | 900 |
| 大流行 | +70 | 2.4 | 2,400 | 1,440 |
| 上限到達 | +150 | 3.0 | 3,000 | 1,800 |
| 中立化 | 0 | 1.0 | 1,000 | 600 |
| 売却殺到 | -50 | 0.5 | 500 | 300 |
| 暴落 | -200 | 0.3 | 300 | 180 |

---

## 🆕 保護カードポリシー (v1.1 新規)

### 設計原則
- 売却可否は `knowledgeCards.ts` の **カード定義マスタ** に `sellable: boolean` フィールドとして持たせる
- DB (`card_market_prices` 等) には **複製しない** (単一ソース・オブ・トゥルース)
- 売却RPC内でこのマスタを参照して判定
- 売却画面で `sellable=false` のカードは**グレーアウト + ツールチップ表示**

### 売却禁止カード一覧 (計10枚)

#### 進化専用カード (7枚) — バトル中の進化でのみ出現

これらは通常プレイで所持できない設計のため、万が一所持状態になった場合でも売却不可とする (defense-in-depth)。`EVOLUTION_ONLY_CARDS` (knowledgeCards.ts:1680) と完全一致。

| card_id | カード名 | レアリティ | 進化元 | 備考 |
|---------|---------|----------|--------|-----|
| `card-202` | 聖女ジャンヌ | SSR | ジャンヌ・ダルク (`card-057`) | 火刑トリガーで進化 |
| `card-165` | 大蛇 | SR | アナコンダ (`card-116`) | |
| `card-206` | 万能の天才 | SSR | ダ・ヴィンチ (`card-001`) | |
| `card-188` | 明智光秀 | SR | — | 本能寺の変チェーン |
| `card-189` | 愛宕百韻 | SR | — | 本能寺の変チェーン |
| `card-190` | 天王山 | SR | — | 本能寺の変チェーン |
| `card-191` | 三日天下 | SR | — | 本能寺の変チェーン |

#### 進化トリガーカード (3枚) — 売ると進化不可能になる

| card_id | カード名 | レアリティ | 効果 |
|---------|---------|----------|-----|
| `card-187` | 本能寺の変 | SSR | ベンチの信長を犠牲に明智光秀チェーン発動 |
| `card-163` | 焚書坑儒 | SSR | 始皇帝ルートの進化トリガー |
| `card-203` | 火刑 | **N** | ベンチのジャンヌを除外、聖女ジャンヌへの進化トリガー |

⚠️ **注意**: 火刑は **Nレアリティ** (基準価格50ALT) だが機能的に重要なため保護対象。レアリティと保護フラグは独立判定すること。

### 進化元カードの扱い

進化元となる `card-001` (ダ・ヴィンチ) / `card-057` (ジャンヌ・ダルク) / `card-116` (アナコンダ) / 信長 等は **意図的に売却可能** とする。

- 売却は「進化チェーンを放棄する」というプレイヤーの選択
- 売却禁止にすると「売れないゴミ」と化すリスク、かつUXを損なう
- 教育的にも「重要な資産を売ると何を失うかを体験させる」狙いで売却を許可

### デッキ組み込み中カードの売却

`sellable=true` のカードでも、以下の場合は**売却時にブロック** + UIでグレーアウト:

- **メインデッキ** (バトル出場中デッキ) に組み込まれている
- **獲得済み MyDeck** (プレイヤーが保存している任意デッキ) に組み込まれている
- 判定: `myDecks.ts` のヘルパー (新規 `isCardInAnyDeck(cardId, childId): boolean`) を使用

ツールチップ:
> 「デッキに組み込み中。デッキから外してから売却してください」

### sellable フラグの定義箇所

```typescript
// client/src/lib/knowledgeCards.ts (既存ファイル拡張)

// 売却禁止カードIDのセット (進化専用7枚 + 進化トリガー3枚)
export const NON_SELLABLE_CARD_IDS = new Set<string>([
  // 進化専用 (EVOLUTION_ONLY_CARDS と同期、ID で管理)
  'card-202', 'card-165', 'card-206',
  'card-188', 'card-189', 'card-190', 'card-191',
  // 進化トリガー
  'card-187', 'card-163', 'card-203',
]);

export const isCardSellable = (cardId: string): boolean =>
  !NON_SELLABLE_CARD_IDS.has(cardId);
```

**既存コードとの整合性**:
- `EVOLUTION_ONLY_CARDS` (名前ベースのSet) は現状維持 (バトルロジックで使用中)
- `NON_SELLABLE_CARD_IDS` はIDベース (DB/RPC と直接連携)
- 両者が進化専用7枚で一致することを `tests/` で保証

---

## 🔒 不正対策・安全装置 (v1.1 更新)

### クールダウン
- 同一カード 24時間以内に売却→購入を繰り返せない (Pump & Dump 防止)
- 購入後 24時間は売却不可 (即転売防止)
- 判定: `gacha_pulls.pulled_at` の最新値を参照 (v1.1 で `child_card_acquisitions` を廃止し `gacha_pulls` に統合)

### 売買上限
- 1ユーザー 50枚/日 まで売却可能
- 1ユーザー 100枚/日 まで購入可能 (ガチャ以外の直販分)

### 価格変動ガード
- 1日の価格変動幅は ±30% まで (前日00:00時点のスナップショット基準)
- `card_price_history.snapshot_date = CURRENT_DATE - 1` の `buy_price` を基準点とする
- 上限到達時は翌日まで変動停止 (バッチ確定時刻: 毎日 00:05 JST)

### 🆕 競合制御 (v1.1 変更)

v1.0 の「楽観ロック」方針を撤回。理由: 既存コードベースに `version` カラム等の楽観ロック基盤が存在しないため。

代替: **SECURITY DEFINER RPC 内で `SELECT ... FOR UPDATE` による悲観ロック** を採用。既存の `consume_invite_code` (0020) および `admin_generate_weekly_report` (0028) と同一パターン。

```sql
-- RPC 内部の典型的な排他ロック
select alt_points into v_current_alt
  from public.child_status
  where child_id = p_child_id
  for update;
```

同一トランザクション内で以下を原子的に実行:
1. `child_status.alt_points` の排他取得
2. カード所持確認 + クールダウン判定
3. 1日売却上限判定
4. 価格マスタ (`card_market_prices`) の排他取得
5. ALT 更新 + 取引ログ INSERT + 所持レコード削除 + 価格マスタ更新

### 教育的配慮
- 極端な価格変動時に「投機注意」モーダル表示
- 大量売却時に「本当に売却しますか?」確認ダイアログ
- 月次損益サマリを子に見せる (自省促進)

---

## 🗂️ DB スキーマ (v1.1 大幅書き換え)

### 🔄 重要変更点

1. **`child_card_acquisitions` 新規テーブルは作らない** (v1.0 からの変更)
   - 既存 `gacha_pulls` (0002) に `source` カラムを追加して統一
   - カード所持の正本は `gacha_pulls` のまま維持
   - `computeOwnership()` (`myDecks.ts:131-182`) の既存ロジックを温存

2. **RLS ポリシーから `auth.uid()` を完全撤廃**
   - 理由: プロジェクトは Supabase Auth 未導入、PIN認証のみ
   - 全テーブル `anon` ロール全拒否、SECURITY DEFINER RPC 経由でのみアクセス
   - 参考 migration: `0020_consume_invite_code.sql` / `0028_admin_generate_weekly_report.sql`

3. **マイグレーション番号**: `0029_card_market.sql`

### 新規テーブル (3テーブル)

```sql
-- ============================================================
-- 0029_card_market.sql
-- ============================================================

-- 価格マスタ (カードごとの現在価格)
create table public.card_market_prices (
  card_id           text primary key,
  rarity            text not null check (rarity in ('N', 'R', 'SR', 'SSR')),
  base_price        integer not null check (base_price > 0),
  current_buy_price integer not null check (current_buy_price > 0),
  current_sell_price integer not null check (current_sell_price > 0),
  total_purchases   integer not null default 0,
  total_sales       integer not null default 0,
  last_updated      timestamptz not null default now()
);

comment on table public.card_market_prices is
  'カード市場の現在価格マスタ。価格は RPC 経由でのみ更新される。';
comment on column public.card_market_prices.current_sell_price is
  '現在の売却価格 = 運営が買い取る価格 (買取価格)';

-- RLS: 読み取りは公開、書き込みは SECURITY DEFINER RPC 経由のみ
alter table public.card_market_prices enable row level security;
create policy "public_read_card_market_prices"
  on public.card_market_prices for select
  using (true);
-- INSERT/UPDATE/DELETE ポリシーは作らない → anon 不可

-- ============================================================

-- 取引履歴 (監査 + 損益計算)
create table public.card_transactions (
  id                uuid primary key default gen_random_uuid(),
  child_id          text not null,
  card_id           text not null,
  transaction_type  text not null check (transaction_type in ('buy', 'sell')),
  price             integer not null check (price > 0),
  alt_balance_after integer not null,
  created_at        timestamptz not null default now()
);

comment on column public.card_transactions.alt_balance_after is
  '取引後のALT残高 (監査用スナップショット、正本は child_status.alt_points)';

create index idx_card_transactions_child
  on public.card_transactions (child_id, created_at desc);
create index idx_card_transactions_card
  on public.card_transactions (card_id, created_at desc);

-- RLS: anon 全拒否、読み取りは専用 RPC 経由
alter table public.card_transactions enable row level security;
create policy "deny_anon_card_transactions"
  on public.card_transactions for all
  to anon using (false);

-- ============================================================

-- 価格履歴 (チャート表示用、日次スナップショット)
create table public.card_price_history (
  id               uuid primary key default gen_random_uuid(),
  card_id          text not null,
  snapshot_date    date not null,
  buy_price        integer not null,
  sell_price       integer not null,
  daily_purchases  integer not null default 0,
  daily_sales      integer not null default 0,
  created_at       timestamptz not null default now(),
  unique (card_id, snapshot_date)
);

create index idx_card_price_history_card_date
  on public.card_price_history (card_id, snapshot_date desc);

-- RLS: 読み取りは公開
alter table public.card_price_history enable row level security;
create policy "public_read_card_price_history"
  on public.card_price_history for select
  using (true);
```

### 既存テーブル拡張 (gacha_pulls)

```sql
-- ============================================================
-- 0029_card_market.sql (続き)
-- gacha_pulls 拡張: source カラム追加でカード所持源泉を統一
-- ============================================================

-- 既存カラム: id, child_id, card_id, rarity, gacha_type, pity_count, pulled_at
alter table public.gacha_pulls
  add column if not exists source text not null default 'gacha'
    check (source in ('gacha', 'shop_buy', 'quest_reward', 'market_buy'));

-- 既存データは全て source='gacha' で初期化 (DEFAULT により自動適用)

-- 市場購入時のクールダウン判定用インデックス
create index if not exists idx_gacha_pulls_child_card_date
  on public.gacha_pulls (child_id, card_id, pulled_at desc);

comment on column public.gacha_pulls.source is
  'カード取得経路: gacha (ガチャ) / shop_buy (直販) / quest_reward (クエスト報酬) / market_buy (市場購入)';
```

**命名について**: `gacha_pulls` という名前はガチャ起源を示すが、v1.1 では「全カード取得履歴の正本」として機能する。将来的にテーブル名を `card_acquisitions` にリネームする選択肢は残すが、今スコープでは名前変更しない (影響範囲が広すぎるため)。

---

## 🎨 UI 設計 (v1.1 タブ構成確定)

### 1. Shop 画面の新タブ構成

既存 ShopPage のタブ (`avatar` / `bg` / `title` / `item`) とは**独立した** 「市場機能ブロック」を追加。

v1.1 確定タブ:

```
┌──────────────────────────────────────────────────────┐
│ Shop                                                  │
├──────────────────────────────────────────────────────┤
│ [既存] アバター | 背景 | 称号 | アイテム              │
│ ─────────────────────────────────────────────────── │
│ [v1.1新規] ガチャ | 直販 | 売却 | 市場情報           │
└──────────────────────────────────────────────────────┘
```

- **ガチャ**: 既存 `GachaPage.tsx` を ShopPage 内に統合 or 別ページのまま導線だけ張る (Phase 1 では**別ページ維持**、タブは導線のみ)
- **直販**: 固定価格で特定カードを確定購入 (Phase 2 以降)
- **売却**: プレイヤーの所持カードを運営が買い取る (Phase 1 メイン機能)
- **市場情報**: 価格チャート + 高騰/暴落 TOP5 (Phase 3)

### 2. 「売却」タブ UI (Phase 1)

```
┌─────────────────────────────────┐
│ 💰 カード売却                    │
├─────────────────────────────────┤
│ 所持ALT: 12,450                  │
├─────────────────────────────────┤
│ [フィルタ: レアリティ / 学習単元] │
│ [並び替え: 売却価格↓]            │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ [画像] 信長 (SR)              │ │
│ │ 所持: 3枚                     │ │
│ │ 売却価格: 900 ALT (↑50%)     │ │
│ │ [📈チャート] [💰売却]         │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [画像] 聖女ジャンヌ (SSR) 🔒  │ │
│ │ 所持: 1枚 (進化カード)        │ │
│ │ 売却不可                      │ │
│ │ ツールチップ: 「進化に必要な  │ │
│ │   ため売却不可」              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [画像] 鉄砲 (R) 📘           │ │
│ │ 所持: 5枚 (うち2枚デッキ)     │ │
│ │ 売却可能: 3枚                 │ │
│ │ ツールチップ: 「デッキに組み込 │ │
│ │   み中。外してから売却」      │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

UI 実装上のポイント:
- `isCardSellable(cardId)` === false → **グレーアウト + 🔒アイコン**
- `isCardInAnyDeck(cardId, childId)` === true → **黄色警告アイコン📘**、デッキ外の枚数のみ売却可
- ツールチップは `onHover` + モバイルタップで表示

### 3. 価格チャート (モーダル、Phase 3)

```
┌─────────────────────────────────┐
│ 📈 信長 (SR) 価格推移            │
├─────────────────────────────────┤
│  3000 ┤           ●              │
│  2500 ┤      ●  ╱                │
│  2000 ┤   ●╱                     │
│  1500 ┤ ●                        │
│  1000 ┤●━━━━━━━━━━━━━━━━━━━ 基準 │
│       └────────────────────      │
│       7日前   昨日   今日        │
├─────────────────────────────────┤
│ 最安値: 800 (4/14)               │
│ 最高値: 2,800 (4/20)             │
│ 現在:   1,500 (売却: 900)        │
│ 取引数: 過去7日で 234件          │
└─────────────────────────────────┘
```

### 4. 市場ダッシュボード (新ページ、Phase 3)

```
┌─────────────────────────────────┐
│ 🏪 TRAIL カード市場              │
├─────────────────────────────────┤
│ 🔥 今 高騰中 TOP5                │
│ 1. ナポレオン SR  +180%          │
│ 2. ジャンヌ    SR  +150%          │
│ 3. ...                           │
├─────────────────────────────────┤
│ 📉 今 暴落中 TOP5                │
│ 1. 足軽      R   -45%            │
│ 2. ...                           │
├─────────────────────────────────┤
│ 📊 最も取引された TOP5           │
│ 1. ...                           │
├─────────────────────────────────┤
│ 💡 今日の市場ニュース            │
│ 「江戸時代カードが人気上昇中」   │
└─────────────────────────────────┘
```

---

## 🛠️ API 設計 (v1.1 全面書き換え: REST → RPC)

v1.0 の `POST /api/market/sell` のような REST API は**廃止**。
全て Supabase SECURITY DEFINER RPC + クライアントからの `supabase.rpc()` 呼び出しに統一。

### RPC 1: カード売却 (`market_sell_card`)

```sql
create or replace function public.market_sell_card(
  p_child_id text,
  p_card_id  text
) returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  v_current_alt int;
  v_sell_price int;
  v_buy_price int;
  v_last_acquired timestamptz;
  v_daily_sell_count int;
  v_acquisition_id uuid;
begin
  -- 1. 残高取得 + 排他ロック
  select alt_points into v_current_alt
    from public.child_status
    where child_id = p_child_id
    for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'child_not_found');
  end if;

  -- 2. 最新所持レコード取得 + 排他ロック (クールダウン判定用)
  select id, pulled_at into v_acquisition_id, v_last_acquired
    from public.gacha_pulls
    where child_id = p_child_id
      and card_id = p_card_id
    order by pulled_at asc  -- 最も古い所持を売却 (FIFO)
    limit 1
    for update;

  if v_acquisition_id is null then
    return jsonb_build_object('success', false, 'reason', 'card_not_owned');
  end if;

  -- 3. クールダウン判定 (最新の取得から24h経過しているか)
  if exists (
    select 1 from public.gacha_pulls
    where child_id = p_child_id
      and card_id = p_card_id
      and pulled_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('success', false, 'reason', 'cooldown_24h');
  end if;

  -- 4. 1日売却上限判定 (50枚/日)
  select count(*) into v_daily_sell_count
    from public.card_transactions
    where child_id = p_child_id
      and transaction_type = 'sell'
      and created_at > now() - interval '24 hours';

  if v_daily_sell_count >= 50 then
    return jsonb_build_object('success', false, 'reason', 'daily_sell_limit');
  end if;

  -- 5. 価格マスタ取得 + 排他ロック
  select current_buy_price, current_sell_price
    into v_buy_price, v_sell_price
    from public.card_market_prices
    where card_id = p_card_id
    for update;

  if v_sell_price is null then
    return jsonb_build_object('success', false, 'reason', 'card_not_listed');
  end if;

  -- 6. ALT 加算
  update public.child_status
    set alt_points = alt_points + v_sell_price,
        updated_at = now()
    where child_id = p_child_id;

  -- 7. 取引履歴記録
  insert into public.card_transactions
    (child_id, card_id, transaction_type, price, alt_balance_after)
    values (p_child_id, p_card_id, 'sell', v_sell_price, v_current_alt + v_sell_price);

  -- 8. 所持レコード削除 (FIFO で最古の1件)
  delete from public.gacha_pulls where id = v_acquisition_id;

  -- 9. 価格マスタ更新 (売却数+1 + 動的価格再計算 + ±30%ガード)
  update public.card_market_prices
    set total_sales = total_sales + 1,
        last_updated = now()
    where card_id = p_card_id;
  -- Commit C 実装時に calculatePrice を RPC 内で呼び current_buy_price /
  -- current_sell_price を更新。±30% ガードは前日スナップショット
  -- (card_price_history) との比較で適用。

  return jsonb_build_object(
    'success', true,
    'sell_price', v_sell_price,
    'alt_balance_after', v_current_alt + v_sell_price
  );
end;
$$;

grant execute on function public.market_sell_card(text, text) to anon;
```

**エラーコード**:
- `child_not_found`: 該当childが存在しない
- `card_not_owned`: カード未所持
- `cooldown_24h`: 24時間クールダウン中
- `daily_sell_limit`: 1日売却上限到達
- `card_not_listed`: 市場マスタに未登録

**sellable チェックは呼び出し側 (TypeScript)** で実施する。理由: sellable リストは `knowledgeCards.ts` のマスタにあり、DBに複製しない方針。RPC は所持判定のみ行う。

### RPC 2: カード購入 (`market_buy_card`) — Phase 1

`market_sell_card` と対称構造。Commit E で実装する。

```sql
-- 骨格 (正式実装は Commit E)
create or replace function public.market_buy_card(
  p_child_id text,
  p_card_id  text
) returns jsonb
security definer
set search_path = public
language plpgsql
as $$
-- 1. child_status.alt_points を FOR UPDATE で排他取得
-- 2. card_market_prices を FOR UPDATE で排他取得 (current_buy_price)
-- 3. 残高不足チェック (alt_points < current_buy_price → insufficient_alt)
-- 4. 1日購入上限判定 (100枚/日)
-- 5. ALT 減算
-- 6. card_transactions に ('buy', p_card_id, price) で INSERT
-- 7. gacha_pulls に source='market_buy' で INSERT (カード付与)
-- 8. total_purchases += 1 → calculatePrice 実行 → current_buy/sell_price 更新
--    (±30% ガード込み、前日スナップショット比)
$$;

grant execute on function public.market_buy_card(text, text) to anon;
```

**エラーコード**:
- `insufficient_alt`: ALT残高不足
- `daily_buy_limit`: 1日購入上限 (100枚/日) 到達
- `card_not_listed`: 市場マスタに未登録

### RPC 3: 価格取得 (`fetch_market_prices`) — RPC不要、直接SELECT可

`card_market_prices` は RLS で読み取り公開されているため、RPC を介さず直接 `select * from card_market_prices` で取得可能。

クライアント側:
```typescript
const { data } = await supabase
  .from('card_market_prices')
  .select('card_id, current_buy_price, current_sell_price, total_purchases, total_sales')
  .in('card_id', targetCardIds);
```

### RPC 4: 価格履歴取得 (`fetch_card_price_history`) — RPC不要

同じく `card_price_history` は読み取り公開。

### RPC 5: 取引履歴取得 (`fetch_my_card_transactions`)

```sql
create or replace function public.fetch_my_card_transactions(
  p_child_id text,
  p_limit    int default 50
) returns setof card_transactions
security definer
set search_path = public
language sql
stable
as $$
  select * from public.card_transactions
  where child_id = p_child_id
  order by created_at desc
  limit p_limit;
$$;

grant execute on function public.fetch_my_card_transactions(text, int) to anon;
```

### RPC 6: 市場ダッシュボード (`fetch_market_dashboard`) — Phase 3

```sql
-- trending_up / trending_down / most_traded を集計して返す
-- (Phase 3 で実装、仕様省略)
```

---

## 🔗 既存コードとの統合方針 (v1.1 新規)

### 統合対象ファイルと役割

| ファイル | 統合内容 | 影響度 |
|---------|---------|-------|
| `client/src/lib/gachaService.ts` | `recordPulls()` に `source` パラメータを受け取るよう拡張、既存呼び出しは `'gacha'` で呼ぶ | 🟡 中 |
| `client/src/lib/altGameService.ts` | 直接触らない。市場は独自RPCで ALT 更新 (updateChildStatus 経由しない) | 🟢 低 |
| `client/src/lib/myDecks.ts` | `computeOwnership()` は `gacha_pulls` 参照のまま温存。新規 `isCardInAnyDeck()` ヘルパーを追加 | 🟡 中 |
| `client/src/lib/knowledgeCards.ts` | `NON_SELLABLE_CARD_IDS` セットと `isCardSellable()` 関数を追加 | 🟢 低 |
| `client/src/lib/marketService.ts` (新規) | 薄いラッパー層。`supabase.rpc()` 呼び出しを関数化 | 🟢 低 |
| `client/src/pages/ShopPage.tsx` | 新タブ (ガチャ/直販/売却/市場情報) を追加、既存4タブと並列配置 | 🟡 中 |
| `client/src/pages/ShopSellTabPage.tsx` (新規) | 売却タブ本体 | 🟢 低 |

### altGameService.ts との関係

**結論: altGameService.ts は触らない**。市場機能は独立した RPC で直接 `child_status.alt_points` を更新する。

理由:
- `altGameService.ts` は「ALTゲームのスコア管理」に特化しており、ALT更新は `updateChildStatus()` への薄いパススルーでしかない
- 市場は `market_sell_card` RPC 内で排他ロック付きで直接更新する方が安全
- 関数再利用のためにサービス層を経由すると、トランザクション境界がクライアント側に漏れる

### 既存ガチャ/ショップの ALT 更新リファクタについて

⚠️ **Phase 1 では既存ガチャ/ショップの ALT 更新ロジックは触らない**。

現状、`spendAltForGacha()` / `purchaseSkin()` 等は `updateChildStatus()` 経由で `child_status.alt_points` を楽観的 UPDATE している。競合制御がないため、理論上は同じレース条件の脆弱性を抱えているが、以下の理由から**別 PR で順次対応**:

- 市場 Phase 1 のスコープが肥大化する
- 既存 UI の回帰テストが必要になる
- 市場 Phase 1 で RPC + `FOR UPDATE` パターンを確立してから、それを既存箇所にも適用する流れが自然

**仕様書への明記**: 将来別PRで以下のリファクタを行う:

1. `gacha_spend_alt(p_child_id, p_cost)` RPC を作成 → `spendAltForGacha()` から呼ぶ
2. `shop_purchase_skin(p_child_id, p_item_id)` RPC を作成 → `purchaseSkin()` から呼ぶ
3. 両者とも `SELECT ... FOR UPDATE` 排他ロック内で残高確認+減算+履歴記録を原子化

---

## 🚀 実装フェーズ (v1.1 インプレース更新版)

### Phase 1: 動的価格・売買両方の MVP (**25-30h**)

**目標**: 動的価格で売買が動作し、保護カード/デッキ組み込みカードがブロックされる + 既存コード統合

#### DB 関連 (7-8h) — Commit A, B
- [x] `0029_card_market.sql` 作成 — Commit A 完了
  - 3新規テーブル (card_market_prices / card_transactions / card_price_history)
  - `gacha_pulls` に `source` カラム追加 + インデックス追加
  - RLS ポリシー (anon 全拒否 / 読み取り公開)
- [ ] 基準価格マスタ初期化スクリプト `scripts/init-market-prices.ts` — Commit B
  - `COLLECTION_CARDS` (cardData.ts) + `ALL_BATTLE_CARDS` (knowledgeCards.ts) の和集合
  - レアリティから基準価格を算出して INSERT
  - ID形式不統一 (`card-001` と `little-boy` 等) を網羅
  - `current_buy_price = base_price`、`current_sell_price = base_price * 0.6` で初期化

#### RPC 関連 (8-10h) — Commit C, E
- [ ] `market_sell_card(p_child_id, p_card_id)` RPC 実装 — Commit C
  - `SELECT ... FOR UPDATE` 排他ロック
  - クールダウン (購入後24h) / 1日売却上限 (50枚/日) / 所持判定
  - `total_sales += 1`
  - **動的価格再計算**: `calculatePrice()` を RPC 内で実行
  - **±30%ガード**: 前日スナップショット (`card_price_history` の最新 `snapshot_date`) と比較
- [ ] `market_buy_card(p_child_id, p_card_id)` RPC 実装 — Commit E
  - 同じ排他ロック構造、`total_purchases += 1` + 動的価格再計算
  - 1日購入上限 (100枚/日)
  - 購入時 `gacha_pulls` に `source='market_buy'` で INSERT
- [ ] `fetch_my_card_transactions(p_child_id, p_limit)` RPC 実装 — Commit C

#### クライアント統合 (4-5h) — Commit D, E
- [ ] `knowledgeCards.ts` に `NON_SELLABLE_CARD_IDS` / `isCardSellable()` 追加 — Commit D
- [ ] `myDecks.ts` に `isCardInAnyDeck(cardId, childId)` ヘルパー追加 — Commit G
- [ ] `gachaService.ts` の `recordPulls()` に `source` パラメータ追加 — Commit E
- [ ] `marketService.ts` (新規) で RPC 呼び出しラッパー — Commit D

#### UI (6-8h) — Commit D, E, F, G
- [ ] `ShopPage.tsx` にタブ4つ追加 (ガチャ=既存導線 / 直販 / 売却 / 市場情報) — Commit D
- [ ] `ShopSellTabPage.tsx` (売却タブ本体) — Commit D
  - 所持カード一覧 (rarity フィルタ / 売却価格ソート)
  - 売却確認ダイアログ + RPC 呼び出し + 結果表示
- [ ] `ShopBuyTabPage.tsx` (直販タブ本体) — Commit E
  - `card_market_prices` から直接 SELECT で全カード一覧表示
  - 購入確認ダイアログ + RPC 呼び出し
- [ ] `ShopMarketInfoTabPage.tsx` (市場情報タブ、トレンドのみ) — Commit F
  - 現在価格一覧、24時間の変動率表示
  - **チャートは Phase 2** (本Phaseでは `↑/↓/→` のトレンドアイコンのみ)
- [ ] 保護カード/デッキ組み込みのグレーアウト + ツールチップ — Commit G
  - `isCardSellable` = false → 🔒アイコン + 「進化に必要なため売却不可」
  - `isCardInAnyDeck` = true → 📘アイコン + 「デッキに組み込み中」

#### テスト・検証 (2-3h) — Commit H
- [ ] `NON_SELLABLE_CARD_IDS` と `EVOLUTION_ONLY_CARDS` の一致を保証するユニットテスト
- [ ] 売却/購入RPC の結合テスト (クールダウン / 上限 / 同時取引)
- [ ] 動的価格変動の境界値テスト (係数0.3上限、3.0上限、±30%ガード)
- [ ] Supabase ダッシュボードで RLS 動作確認

**成功条件** (kk 完了条件に準拠):
- プレイヤーが所持カード (`gacha_pulls`) を**動的価格で**売却できる
- プレイヤーが**直販で動的価格購入**できる
- ALT 残高が正しく更新される (`child_status.alt_points`)
- 取引履歴が DB に記録される (`card_transactions`)
- 保護カード (進化専用7枚 + 進化トリガー3枚) が売却 UI でブロックされる
- デッキ組み込み中カードが売却 UI でブロックされる
- クールダウン (24h) / 1日売買上限が動作する
- 価格変動ガード (前日比±30%) が動作する

### Phase 2: 可視化 (1-2週間、旧 Phase 3)
**目標**: 価格チャート + 市場ダッシュボード (高騰/暴落 TOP5)

- [ ] 日次スナップショットバッチ (Supabase Edge Function + cron、毎日 00:05 JST)
- [ ] 価格チャートコンポーネント (Recharts)
- [ ] 市場情報タブ拡張 (高騰/暴落 TOP5 / 最も取引された TOP5)
- [ ] `fetch_market_dashboard` RPC 実装

**成功条件**:
- 7日間の価格推移が見られる
- 市場全体の動向が把握できる

### Phase 3: 教育コンテンツ (2-4週間、後日検討、旧 Phase 4)
- [ ] 市場ニュース機能 (週次自動生成 or 手動投稿)
- [ ] 教師ダッシュボード連携 (生徒の売買傾向)
- [ ] 保護者向け学習レポート (月次)
- [ ] 「市場介入イベント」機構 (買取2倍キャンペーンなど)

---

## ⚠️ リスク管理

### 技術リスク
- **価格計算の競合**: 同時複数取引で価格が不整合になる可能性
  → 対策: SECURITY DEFINER RPC 内 `SELECT ... FOR UPDATE` による排他ロック (v1.1 方式)

- **バッチ処理失敗**: 日次スナップショットが失敗するとチャート欠損
  → 対策: リトライ機構 + 失敗通知 (Edge Function での実装時に組み込む)

- **ID 体系不統一**: `card-001` と `little-boy` が混在、初期化漏れでそのカードが売買不可に
  → 対策: 初期化スクリプトで `COLLECTION_CARDS + ALL_BATTLE_CARDS` の和集合を使う

### 教育リスク
- **投機的になりすぎる**: 子が勉強より市場チェックに没頭
  → 対策: 1日売却上限、「衝動売却警告」、保護者通知

- **格差感**: 売買で差がつくと劣等感が生まれる可能性
  → 対策: 市場参加は任意、デッキ構築の楽しさを別軸で強調

### 法務リスク (低減済み)
- プレイヤー間取引なし → 資金決済法対象外
- ゲーム内通貨のみ → 景表法リスク低
- 13歳未満対応 → 保護者同意プロセス既存のものを踏襲

---

## 📝 開発時の注意点

### Manus スコープ制限 (既存ルール準拠)
- Manus は UI 画像 (アイコン、チャート装飾等) のみ生成
- 価格計算ロジック、DB 操作、API 実装は Claude Code 専任
- `gameStore.ts` 系のコア state は Manus 触れない

### Claude Code 指示テンプレ
```
【実装依頼】カード市場 Phase X

## 目標
[Phase ごとの成功条件を引用]

## 対象ファイル
- client/src/pages/ShopPage.tsx (売却タブ追加)
- client/src/pages/ShopSellTabPage.tsx (新規)
- client/src/lib/marketService.ts (新規、RPC ラッパー)
- client/src/lib/knowledgeCards.ts (sellable リスト追加)
- client/src/lib/myDecks.ts (isCardInAnyDeck 追加)
- client/src/lib/gachaService.ts (source パラメータ対応)
- supabase/migrations/0029_card_market.sql (新規)
- scripts/init-market-prices.ts (新規)

## 実装制約
- 既存の Shop タブ構造を壊さない (avatar/bg/title/item は温存)
- 取引ロジックは必ず SECURITY DEFINER RPC 内で実行
- RPC 内で `SELECT ... FOR UPDATE` による排他ロック必須
- sellable フラグは knowledgeCards.ts のマスタのみに持つ (DB には持たない)
- auth.uid() を使わない (このプロジェクトは Supabase Auth 未導入)

## 工数見積
Phase 1: 25-30h
```

### マイグレーション番号
- **確定**: `0029_card_market.sql`
- 背景: 0021/0022 は欠番、0028 まで使用済み

---

## 🎓 教育的位置づけ

このカード市場機能は、単なるゲーム要素ではなく **TRAIL の探究学習教材** として機能する:

| 学習領域 | カード市場で学べること |
|---------|---------------------|
| **経済学** | 需要と供給、市場原理、価格決定メカニズム |
| **数学** | 変動率計算、統計 (平均、分散)、グラフ読解 |
| **社会** | 投機と投資の違い、市場の社会的機能 |
| **情報** | データ可視化、トレンド分析 |
| **道徳** | 衝動抑制、意思決定、自己管理 |

**探究テーマ案** (TRAIL 授業連携):
- 「なぜカードの価格は変わるのか?」(経済入門)
- 「市場の暴落を予測できるか?」(データ分析)
- 「運営はなぜマージンを取るのか?」(ビジネスモデル)
- 「プレイヤー間取引を禁止した理由は?」(法とルール)
- 「なぜ聖女ジャンヌは売れないのか?」(機能性と流動性のトレードオフ)

---

## 📌 Next Actions

1. ✅ **仕様書 v1.1 改訂完了** (本ドキュメント)
2. **kk 最終承認待ち**: v1.1 内容のレビュー
3. **Phase 1 着手判断**: kk の GO 判断後、`0029_card_market.sql` から実装開始
4. **並行タスク**:
   - 基準価格の微調整 (既存 ALT 経済との整合性最終確認)
   - Manus 画像発注 (売却タブのアイコン、ロック表示、デッキ警告アイコン)

---

**仕様書 v1.1 以上**
