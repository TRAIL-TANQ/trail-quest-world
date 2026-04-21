# CARD_MARKET_SPEC.md レビュー

**対象**: `CARD_MARKET_SPEC.md` v1.0 (2026-04-21)
**レビュー日**: 2026-04-21
**レビュアー**: Claude (既存コードベース整合性調査)
**重要度**: 🔴 必須 / 🟡 推奨 / 🟢 参考

---

## 🚨 エグゼクティブサマリ

仕様書は **機能設計としては完成度が高い** が、**既存コードベースとの整合性に重大な齟齬が3点** ある。Phase 1 着手前にスペック本体の改訂が必要。

| # | 重要度 | 齟齬 | 影響 |
|---|-------|-----|-----|
| 1 | 🔴 | **Supabase Auth を使っていない** (PIN認証のみ) → `auth.uid()` が常に NULL | 仕様書のRLSポリシーはそのままでは機能しない |
| 2 | 🔴 | ALT更新に競合制御がない (楽観ロックもバージョンもない) | 同時取引で残高整合性が崩れる |
| 3 | 🔴 | `child_card_acquisitions` は既存 `card_collection` (0007) および `gacha_pulls` (0002) と役割が重複 | 三重管理になる、カード所持の正本が不明瞭になる |

加えて、カード側にも「**売却禁止リストが仕様書に存在しない**」という🔴漏れがある (進化専用カード/進化トリガーを売ると進化不可能になる)。

---

## 📋 1. 既存コード現状サマリ

### 1-1. 認証方式

- Supabase Auth は **未導入**。認証は `pin_codes` テーブルによるPIN照合のみ
- `child_id` の実体は多様:
  - 新規登録: `crypto.randomUUID()` または `child-{timestamp}-{random}`
  - 手動登録 (実運用): `スターター_はるか` のような日本語文字列 (例: `generate-weekly-report/index.ts` L139-161 の `STUDENT_DISPLAY` マップ)
- `auth.uid()` は全コードで**1箇所も使われていない**

### 1-2. 既存テーブルの `child_id` 型と RLS

全既存テーブルで `child_id TEXT` に統一済み。RLSは以下の3パターンに分かれる:

| RLS状態 | 該当テーブル |
|---------|-------------|
| **DISABLED** (大多数) | `pin_codes`, `user_profile`, `card_collection`, `stage_progress`, `user_decks`, `gacha_pulls`, `gacha_pity`, `hall_of_fame`, `quiz_history`, `alt_game_scores`, `battle_history`, `shop_items`, `owned_skins`, `equipped_skin`, `tournaments` 等 |
| **ENABLED + `USING(TRUE)`** (実質全開) | `quest_progress` |
| **ENABLED + `anon 全拒否`** (SECURITY DEFINER RPC 経由のみ) | `parent_invite_codes`, `parent_child_links`, `weekly_reports` |

**SERVICE_ROLE 書き込み経路**: `supabase/functions/generate-weekly-report/index.ts` の1箇所のみ (`weekly_reports` UPSERT)。

### 1-3. ALT 更新の現状

| 関数 | ファイル:行 | 処理 |
|------|-----------|-----|
| `updateChildStatus(childId, altDelta, xpDelta)` | `quizService.ts:241-294` | `child_status.alt_points` を単純 UPDATE |
| `spendAltForGacha(childId, cost)` | `gachaService.ts:83-91` | 残高確認 → `updateChildStatus(childId, -cost, 0)` |
| `finalizeAltGame(...)` | `altGameService.ts:78-129` | ALT獲得を `updateChildStatus` 経由で加算 |
| `purchaseSkin(...)` | `shopService.ts` | 同様に `updateChildStatus(-price_alt)` で減算 |

- **競合制御なし**: バージョンカラムも `FOR UPDATE` もない → 同時書き込みは Last Write Wins
- **トランザクション境界**: クライアント側の `try/catch` のみ。複数操作の原子性保証なし
- **唯一の例外**: `consume_invite_code` (0020) が `SELECT ... FOR UPDATE` で排他ロック → これが既存の参考パターン

### 1-4. カード所持モデル

カード所持は **3源泉の合成** で計算される (`myDecks.ts:131-182` `computeOwnership()`):

1. **解放済みデッキのカード**: localStorage の `questProgress` で判定 (beginner 以上クリア)
2. **SSR**: legend クリア済みデッキの SSR カード (`DECK_SSR_CARDS` より)
3. **ガチャ**: `gacha_pulls` から `distinct card_id` で取得

| テーブル | 役割 | 重複表現 |
|---------|-----|---------|
| `gacha_pulls` (0002) | ガチャ履歴、所持の正本 | 同一 `card_id` の**行数** = 所持枚数 |
| `card_collection` (0007) | コレクション達成記録 | 不明 (schema を確認要) |
| `user_decks` (0009) | デッキ編成 | `cards: {card_id, count}[]` で枚数管理 |

### 1-5. ガチャ実装

- UI: `ShopPage.tsx` (タブ構成: `avatar` / `bg` / `title` / `item`)
- ガチャ関連: `gachaService.ts` + `GachaPage.tsx` (別ページ)
- 天井カウンタ: `gacha_pity` に upsert
- ガチャ結果: `gacha_pulls` に INSERT (同一カードは複数行で重複表現)

### 1-6. カードID体系の不統一

- Collection 標準: `card-001` 〜 `card-213` (ハイフン+連番)
- Nuclear boss deck: `little-boy`, `fat-man`, `oppenheimer-new` (ケバブケース)
- 進化カードは進化前後で**別ID** (例: `card-057` ジャンヌ → `card-202` 聖女ジャンヌ)

### 1-7. マイグレーション番号の現状

| 範囲 | 状態 |
|-----|-----|
| 0001〜0020 | 使用済み |
| 0021, 0022 | **欠番** (Supabase管理画面直接実行の痕跡?) |
| 0023〜0028 | 使用済み |
| **次の空き番号** | `0029_` |

0001 は `0001_shop_tables.sql` と `0001_shop_seed.sql` の **重複あり** (実害はないが記録として)。

### 1-8. レアリティ分布 (全290枚)

| レアリティ | 枚数 | 割合 | ガチャ確率 |
|---------|-----|-----|----------|
| N | 83 | 28.6% | 60% |
| R | 122 | 42.1% | 30% |
| SR | 70 | 24.1% | 9% |
| SSR | 15 | 5.2% | 1% |

SSR内訳: 進化専用7枚、歴史イベント1枚、核兵器3枚、理論系3枚、デッキ象徴1枚。

---

## 🔴 2. 必須指摘事項

### 🔴-1. RLSポリシーの認証方式が既存プロジェクトと非互換

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L210-216):

```sql
CREATE POLICY "Users can view own transactions"
  ON card_transactions FOR SELECT
  USING (auth.uid()::text = child_id);
```

**問題**: このプロジェクトは Supabase Auth を使っていない。`auth.uid()` は常に `NULL` を返すため、**このポリシーは誰も読み取れない状態**になる (または `NULL = '何か'` が NULL 評価されて暗黙的に全拒否)。

**修正案A** (推奨): SECURITY DEFINER RPC 経由でのみアクセス、RLS は anon 全拒否

```sql
-- card_transactions は RLS 有効、anon 全拒否
alter table public.card_transactions enable row level security;
create policy "deny_anon_card_transactions"
  on public.card_transactions for all
  to anon using (false);

-- 読み取り専用RPC (既存の weekly_reports パターンを踏襲)
create or replace function public.fetch_card_transactions(
  p_child_id text,
  p_limit int default 50
) returns setof card_transactions
security definer
language sql
stable
as $$
  select * from public.card_transactions
  where child_id = p_child_id
  order by created_at desc
  limit p_limit;
$$;
grant execute on function public.fetch_card_transactions(text, int) to anon;
```

**修正案B** (非推奨): 既存の `quest_progress` 方式 (RLS `USING (TRUE)` で実質全開) に揃える。整合性は取れるが、市場取引の監査ログが全員に丸見えになるのは教育アプリとして望ましくない。

**対応必要箇所**: 仕様書 L210-216 全体を書き換え。4テーブル全てに適用。

---

### 🔴-2. ALT 更新の競合制御が存在しない

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L256-258):
> **価格計算の競合**: 同時複数取引で価格が不整合になる可能性
>   → 対策: Supabase トランザクション + 楽観ロック

**問題**: 既存コードベースに「楽観ロック」の仕組みが**存在しない**。`child_status` テーブルに `version` カラムはなく、`updateChildStatus()` は単純 UPDATE なので、以下のシナリオが起こる:

```
時刻t=0: buyer 残高 = 1000
時刻t=1: Tab A で 500ALT カード購入開始 (読み取り: 1000)
時刻t=2: Tab B で 600ALT カード購入開始 (読み取り: 1000)
時刻t=3: Tab A 書き込み: 500
時刻t=4: Tab B 書き込み: 400  ← 本来は400-600=-200でエラーのはず
結果: 残高400、カード2枚入手 (実質100ALTの損失)
```

同様のリスクは**既存のガチャ/ショップ購入でも既に存在**しているが、市場取引は頻度が高いため顕在化しやすい。

**修正案**: SECURITY DEFINER RPC 内で `FOR UPDATE` 排他ロック。既存の `consume_invite_code` (0020) が参考パターン。

```sql
create or replace function public.market_sell_card(
  p_child_id text,
  p_card_id text
) returns jsonb
security definer
language plpgsql
as $$
declare
  v_current_alt int;
  v_sell_price int;
  v_acquired_at timestamptz;
  v_daily_sell_count int;
begin
  -- 1. 残高を排他ロック取得
  select alt_points into v_current_alt
    from public.child_status
    where child_id = p_child_id
    for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'child_not_found');
  end if;

  -- 2. カード所持確認 + クールダウン判定
  select acquired_at into v_acquired_at
    from public.child_card_acquisitions
    where child_id = p_child_id
      and card_id = p_card_id
    order by acquired_at desc
    limit 1
    for update;

  if v_acquired_at > now() - interval '24 hours' then
    return jsonb_build_object('success', false, 'reason', 'cooldown');
  end if;

  -- 3. 1日売却上限判定
  select count(*) into v_daily_sell_count
    from public.card_transactions
    where child_id = p_child_id
      and transaction_type = 'sell'
      and created_at > now() - interval '24 hours';

  if v_daily_sell_count >= 50 then
    return jsonb_build_object('success', false, 'reason', 'daily_limit');
  end if;

  -- 4. 売却価格を排他ロック取得
  select current_sell_price into v_sell_price
    from public.card_market_prices
    where card_id = p_card_id
    for update;

  -- 5. ALT加算 + 取引記録 + 価格更新 (全てトランザクション内)
  update public.child_status
    set alt_points = alt_points + v_sell_price
    where child_id = p_child_id;

  insert into public.card_transactions (child_id, card_id, transaction_type, price, alt_balance_after)
    values (p_child_id, p_card_id, 'sell', v_sell_price, v_current_alt + v_sell_price);

  -- 所持削除 (最古のacquisition行を削除)
  delete from public.child_card_acquisitions
    where id = (
      select id from public.child_card_acquisitions
      where child_id = p_child_id and card_id = p_card_id
      order by acquired_at asc limit 1
    );

  -- 価格マスタ更新 (売却数+1 → 次回の価格再計算のトリガー)
  update public.card_market_prices
    set total_sales = total_sales + 1,
        last_updated = now()
    where card_id = p_card_id;

  return jsonb_build_object(
    'success', true,
    'sell_price', v_sell_price,
    'alt_balance_after', v_current_alt + v_sell_price
  );
end;
$$;
grant execute on function public.market_sell_card(text, text) to anon;
```

**注**: `calculatePrice()` による動的価格再計算は Phase 2 で別 RPC として実装。MVP では `card_market_prices.current_sell_price` を直接参照するだけで十分。

**対応必要箇所**: 仕様書 §「不正対策・安全装置」§「API設計」全体を RPC 前提に書き換え。

---

### 🔴-3. `child_card_acquisitions` は既存テーブルと役割重複

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L197-203):

```sql
CREATE TABLE child_card_acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT NOT NULL -- 'gacha', 'shop_buy', 'quest_reward' など
);
```

**問題**: 既存に以下の2テーブルがあり、役割がかぶる:

- `gacha_pulls` (0002): ガチャ由来のカード履歴 (行数 = 所持枚数)
- `card_collection` (0007): コレクション達成記録 (構造要確認)

現行の `computeOwnership()` は `gacha_pulls` を参照してカード所持を判定している。新テーブルを追加すると、**カード所持の正本が3箇所に分散**する:

1. `gacha_pulls` (ガチャ由来)
2. `card_collection` (既存、コレクション達成)
3. `child_card_acquisitions` (新規、クールダウン判定用)

**修正案A** (推奨): `gacha_pulls` を廃止/名称変更し、**全ての所持を `child_card_acquisitions` に統一**

- 新 `0029_unify_card_acquisitions.sql` で `child_card_acquisitions` 作成 + `gacha_pulls` の既存データを移行
- `computeOwnership()` を新テーブル参照に書き換え
- `source` カラムで 'gacha' / 'quest_clear' / 'ssr_unlock' / 'shop_buy' を区別
- **クールダウン判定とカード所持判定を同じテーブルで実現** (一本化の利点)

**修正案B** (軽量): `gacha_pulls` を正本のまま残し、`source` と `acquired_at` カラムを追加 (または `gacha_pulls` を拡張)

- 影響範囲は最小だが、カード取得源泉が「ガチャ」に偏った名前のまま残る
- 将来の「市場購入」を `gacha_pulls` に INSERT することになり、命名が歪む

**kk 判断ポイント**: データ移行コストを許容できれば A 推奨。できなければ B で凌いで後日リファクタ。

**対応必要箇所**: 仕様書 L197-203 の新規テーブル設計を再検討。既存の `gacha_pulls` と `card_collection` の schema を調査した上でマージ戦略を決める。

---

### 🔴-4. 売却禁止リストが仕様書に存在しない

**仕様書の該当箇所**: 言及なし (🔴 設計漏れ)

**問題**: `cardData.ts` には以下の「売ると進化不可能になるカード」が存在するが、仕様書には保護ロジックがない:

| 分類 | 枚数 | 例 |
|-----|-----|---|
| 進化元カード | 8 | ジャンヌ・ダルク (card-057), アナコンダ (card-116), ダ・ヴィンチ (card-001), 信長, オオカミ, ガリレオ |
| 進化専用カード | 7 | 聖女ジャンヌ (card-202), 大蛇 (card-165), 万能の天才 (card-206), 明智光秀, 愛宕百韻, 天王山, 三日天下 |
| 進化トリガーカード | 3 | 火刑 (ジャンヌ進化), 本能寺の変 (信長ルート), 焚書坑儒 |
| デッキ固有武器 | 15+ | 鉄砲 (信長), 聖剣 (ジャンヌ), グライダー (ライト兄弟), 設計図 (ダ・ヴィンチ) |

加えて、**メインデッキの最後の1枚** (そのカードを売るとデッキが15枚未満になる) も保護すべき。

**修正案**: `card_market_prices` に `sellable BOOLEAN NOT NULL DEFAULT true` カラムを追加し、進化専用/トリガーカードは `false` に設定。加えて、売却RPC内で「デッキ組み込み状態」を確認:

```sql
-- 0029_card_market.sql への追加
alter table public.card_market_prices
  add column sellable boolean not null default true;

-- 初期化スクリプトで進化専用/トリガーを sellable=false に
update public.card_market_prices
  set sellable = false
  where card_id in (
    'card-202', 'card-165', 'card-206', -- 進化専用
    'card-163', 'card-187',              -- 進化トリガー (焚書坑儒, 本能寺の変)
    -- 残りは kk 要確認
  );
```

売却RPC内で:

```sql
-- 売却可能判定
if not v_sellable then
  return jsonb_build_object('success', false, 'reason', 'not_sellable');
end if;

-- デッキ編成チェック (user_decks.cards の JSON 走査)
if exists (
  select 1 from public.user_decks
  where child_id = p_child_id
    and cards @> jsonb_build_array(jsonb_build_object('card_id', p_card_id))
) then
  -- 所持枚数がデッキ使用枚数以下なら売却不可
  ...
end if;
```

**対応必要箇所**: 仕様書に新セクション「保護カードポリシー」を追加。進化チェーンと相互作用を考慮した sellable 判定ロジックを明記。

---

### 🔴-5. カードID 体系の非統一を DB 主キー制約で担保

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L184):

```sql
CREATE TABLE card_market_prices (
  card_id TEXT PRIMARY KEY,
  ...
);
```

**問題**: `TEXT PRIMARY KEY` 自体は OK だが、`cardData.ts` には2種類のID形式が混在:

- `card-001` 〜 `card-213` (連番)
- `little-boy`, `fat-man`, `oppenheimer-new` (ケバブケース)

Phase 1 実装時に`card_market_prices` を初期化する際、**両形式を網羅する必要がある**。後から片方を忘れると、その種類のカードが売買できない。

**修正案**: 初期化スクリプトで `ALL_BATTLE_CARDS` (`knowledgeCards.ts` 由来) と `COLLECTION_CARDS` (`cardData.ts`) の**和集合**を使い、重複を排除して INSERT する。TypeScript スクリプトで生成する方が安全:

```typescript
// scripts/init-market-prices.ts
import { COLLECTION_CARDS } from '../client/src/lib/cardData';
import { ALL_BATTLE_CARDS } from '../client/src/lib/knowledgeCards';
import { EVOLUTION_ONLY_CARDS, EVOLUTION_TRIGGERS } from '../client/src/lib/...';

const basePriceMap = { N: 50, R: 200, SR: 1000, SSR: 5000 };
const allCards = new Map<string, { rarity: string; sellable: boolean }>();

for (const card of [...COLLECTION_CARDS, ...ALL_BATTLE_CARDS]) {
  allCards.set(card.id, {
    rarity: card.rarity,
    sellable: !EVOLUTION_ONLY_CARDS.includes(card.id)
           && !EVOLUTION_TRIGGERS.includes(card.id),
  });
}

// SQL 生成
const sqlLines = [];
for (const [id, { rarity, sellable }] of allCards) {
  const base = basePriceMap[rarity];
  sqlLines.push(
    `('${id}', ${base}, ${base}, ${Math.round(base * 0.6)}, ${sellable}),`
  );
}
// file に書き出し
```

**対応必要箇所**: Phase 1 タスクに「基準価格マスタ初期化スクリプト」を追加 (仕様書 L280 にすでにあるが、ID不統一への対処が明記されていない)。

---

## 🟡 3. 推奨指摘事項

### 🟡-1. `card_market_prices` / `card_price_history` の RLS 設計を明示

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L180-195): RLS の記載なし

**問題**: 価格は全ユーザーが読み取るべき公開情報だが、**書き込みは運営のみ**に制限すべき。仕様書には RLS が明記されていない。

**修正案**:

```sql
-- 読み取りは全員、書き込みはサーバー (RPC) 経由のみ
alter table public.card_market_prices enable row level security;
create policy "public_read_card_market_prices"
  on public.card_market_prices for select
  using (true);
-- INSERT/UPDATE/DELETE は anon 全拒否 (SECURITY DEFINER RPC 経由のみ書き込む)

alter table public.card_price_history enable row level security;
create policy "public_read_card_price_history"
  on public.card_price_history for select
  using (true);
```

---

### 🟡-2. マイグレーション番号を 0029 に

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L164): `supabase/migrations/XXXX_market.sql`

**問題**: 現在 0021・0022 が欠番、0028 まで使用済み。次は 0029。

**修正案**: `0029_card_market.sql` とする。仕様書 L164 に明記。

---

### 🟡-3. ガチャ/直販の統合方針を明示

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L101-106, 観点D): タブ構成に `ガチャ | 直販 | 売却 | 市場情報` とあるが、既存ガチャとの関係が不明

**問題**:
- 既存ガチャは `GachaPage.tsx` (別ページ) で動作、`gacha_pulls` に結果INSERT
- 仕様書の「直販」は「ガチャ以外の固定カード購入」の想定と思われる
- タブ構成を変えると既存 ShopPage の `avatar/bg/title/item` タブとの関係が崩れる

**確認事項**:
1. 既存ガチャを Shop タブに統合するのか (= `GachaPage.tsx` 廃止)
2. それとも「直販」は新設で、ガチャは別ページのまま残すのか
3. 既存 `avatar/bg/title/item` タブと市場タブの階層関係

**修正案**: 仕様書に「既存ガチャページとの関係」セクションを追加。推奨:

- **既存**: `GachaPage.tsx` (別ページ、導線は HomePage から)
- **新規**: ShopPage に `売却` / `市場情報` の2タブを追加 (既存の `avatar/bg/title/item` と並列)
- **直販タブは Phase 1 では不要**: ガチャが既存で機能しているため、固定価格直販は Phase 2 以降の検討

---

### 🟡-4. 1日の価格変動±30%ガードの実装方式を具体化

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L175-178):
> 1日の価格変動幅は ±30% まで (日次スナップショット基準)

**問題**: 「日次スナップショット基準」が曖昧。以下のどれを指すのか:

- A案: 昨日00:00時点の価格から±30%
- B案: 今日00:00時点の価格 (日次バッチで確定) から±30%
- C案: 今日の初取引時点の価格から±30%

A案/B案は日次バッチが必要、C案は RPC 内の処理で完結。

**修正案**: B案を推奨。`card_price_history` テーブルの `snapshot_date = CURRENT_DATE` を参照し、バッチ失敗時は前日スナップショット + 警告。

---

### 🟡-5. 取引履歴の `alt_balance_after` は監査情報であり正本ではない

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L190):

```sql
alt_balance_after INT NOT NULL,
```

**問題**: ALT残高の正本は `child_status.alt_points`。取引履歴の `alt_balance_after` は監査用のスナップショットであり、正本との乖離が起きた場合の判定ルールが不明。

**修正案**: カラムコメントを追加し「監査用スナップショット、正本ではない」と明記。乖離時は `child_status.alt_points` を正本とする方針を仕様書に追記。

```sql
comment on column public.card_transactions.alt_balance_after is
  '取引後のALT残高 (監査用スナップショット、正本は child_status.alt_points)';
```

---

### 🟡-6. Phase 1 の工数見積が既存コードベース修正を考慮していない

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L281-287): Phase 1 は15-20h

**問題**: 以下の既存コード修正が Phase 1 のタスクに含まれていない:

- `computeOwnership()` の修正 (新テーブル参照 or `gacha_pulls` 拡張)
- `ShopPage.tsx` への「売却」タブ追加 (既存4タブとの整合)
- ID体系不統一への対処 (初期化スクリプトでの和集合処理)
- 売却禁止リストの構築 (進化カード 18+枚の棚卸し)

**修正案**: Phase 1 工数を **25-30h** に修正。または Phase 0 (既存コード整理) を前段に追加。

---

## 🟢 4. 参考指摘事項

### 🟢-1. SSR 基準価格 5000 ALT の妥当性

**仕様書の該当箇所** (`CARD_MARKET_SPEC.md` L38-43)

実装SSR枚数 15枚のうち 7枚が「進化専用 (売却禁止推奨)」なので、実際に市場流通するSSRは約8枚。供給過多リスクは低いが、**ガチャSSR排出率1%** との組み合わせで「ガチャより市場購入が期待値的に有利」にならないか要確認。

ガチャ1回コスト (不明、要調査) が SSR基準価格5000 × 100回 = 500000 ALT より安い場合、ガチャを引かずに市場で買う方が確実に得。

**アクション**: kk に「1回ガチャコストと期待値」の試算を依頼。

### 🟢-2. `quest_progress` のRLS `USING (TRUE)` は別イシュー

既存コードの問題だが、市場機能とは独立。本レビュー対象外だが、市場で同じ過ちを繰り返さないよう記録。

### 🟢-3. `child_status` テーブルの CREATE DDL 欠落

現状 migration ファイルに `CREATE TABLE child_status` が存在しない (0004で `ALTER TABLE` はある)。手動作成された可能性。**市場機能が `child_status` に依存するため、Phase 1 着手前に baseline migration を追加する**ことを推奨 (別イシュー)。

### 🟢-4. スタック可能カードの複数売却ルール未定義

`cardData.ts` にはスタック可能カード (ナポレオン法典、和歌、設計図、自由憲章等) があり、1デッキに複数枚保有できる。余剰枚数の売却可否が仕様書にない。

**修正案**: 仕様書に「スタック可能カードの余剰売却可否」を明記。デフォルトは可。

### 🟢-5. カード市場ニュース機能は Phase 4 で OK

`CARD_MARKET_SPEC.md` L137 の「今日の市場ニュース」は楽しい要素だが、Phase 1-3 のコア機能と独立。Phase 4 で十分。

---

## ✅ 5. 修正アクションサマリ

以下を `CARD_MARKET_SPEC.md` v1.1 に反映することを推奨:

| 章 | アクション |
|----|-----------|
| § DBスキーマ | RLS を `auth.uid()` 方式から RPC + anon全拒否 方式へ書き換え |
| § DBスキーマ | `child_card_acquisitions` の扱いを既存 `gacha_pulls` とのマージ方針を決めて再設計 |
| § DBスキーマ | `card_market_prices` に `sellable BOOLEAN` カラム追加 |
| § DBスキーマ | `card_market_prices` / `card_price_history` の公開読み取り RLS 追加 |
| § API設計 | REST API (`POST /api/market/sell`) から **SECURITY DEFINER RPC** 方式へ書き換え |
| § 不正対策 | 競合制御を「楽観ロック」から「`FOR UPDATE` 排他ロック」へ変更 |
| § 新セクション | 「保護カードポリシー」を追加 (進化専用・進化トリガー・デッキ必須カードの売却禁止) |
| § 新セクション | 「既存ガチャとの関係」を追加 (直販タブを Phase 2 以降へ) |
| § 実装フェーズ | Phase 1 を **25-30h** に修正、Phase 0 (既存コード整理) を前段追加検討 |
| § 開発時の注意 | マイグレーション番号を `0029_card_market.sql` に確定 |

---

## 📁 6. kk への確認事項

**着手前に必ず回答が必要**:

1. 🔴 `child_card_acquisitions` と既存 `gacha_pulls` / `card_collection` のマージ方針 → **修正案A (統一) か B (軽量拡張) か**
2. 🔴 売却禁止カードのリスト (進化専用7枚 + 進化トリガー3枚で確定か、さらに追加か)
3. 🔴 核ボスSSR (リトルボーイ等) は売却可能か、禁止か
4. 🟡 直販タブは Phase 2 以降に後回しで OK か (Phase 1 は「売却」のみに絞る)
5. 🟡 デッキ組み込み中のカードは売却不可にするか (仕様書に言及なし)
6. 🟢 1回ガチャコストの試算 (SSR基準価格とのバランス確認)
7. 🟢 `child_status` テーブルの baseline migration を先に整備するか (別作業)

**回答後に着手すること**:
- `CARD_MARKET_SPEC.md` v1.1 への反映
- Phase 1 の migration (`0029_card_market.sql`) 実装

---

**レビュー以上**
