-- =====================================================================
-- 変更16: ショップ（アバタースキン）スキーマ
--
-- Supabase Table Editor または SQL Editor でこのファイルを丸ごと実行してください。
-- 既存の child_status / quiz_attempts と同じ DB に追加されます。
--
-- 3 tables:
--   shop_items     : 販売中のアバタースキン（管理者が追加・価格変更・ON/OFF）
--   owned_skins    : 各ユーザーが購入済みのスキン
--   equipped_skin  : 各ユーザーが現在装備しているスキン（1行=1ユーザー）
--
-- 注意:
--   - child_id は text 型。既存の child_status.child_id と揃えるため。
--     （MOCK_USER.id = 'user-001' のような非UUID文字列を許容）
--   - shop_items に skin_key (text unique) を追加。
--     フロントエンドの AVATAR_ITEMS マッピングと接続するためのキー。
--     spec の id:uuid はそのまま主キーとして使用、skin_key は補助カラム。
--   - RLS は明示的に無効化。現状の anon key + 認証なしモデルに合わせた暫定措置。
--     本番導入前に RLS + Auth ポリシー設計を必ず行ってください。
-- =====================================================================

-- ---------- shop_items ----------
create table if not exists public.shop_items (
  id               uuid primary key default gen_random_uuid(),
  skin_key         text unique not null,
  name             text not null,
  description      text,
  price_alt        integer not null default 0 check (price_alt >= 0),
  unlock_level     integer not null default 0 check (unlock_level >= 0),
  unlock_condition text,
  image_url        text not null,
  category         text not null default 'basic'
                     check (category in ('basic', 'limited', 'event')),
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists idx_shop_items_active_sort
  on public.shop_items (is_active, sort_order);

alter table public.shop_items disable row level security;

-- ---------- owned_skins ----------
create table if not exists public.owned_skins (
  id            uuid primary key default gen_random_uuid(),
  child_id      text not null,
  item_id       uuid not null references public.shop_items(id) on delete cascade,
  purchased_at  timestamptz not null default now(),
  unique (child_id, item_id)
);

create index if not exists idx_owned_skins_child
  on public.owned_skins (child_id);

alter table public.owned_skins disable row level security;

-- ---------- equipped_skin ----------
create table if not exists public.equipped_skin (
  child_id  text primary key,
  item_id   uuid references public.shop_items(id) on delete set null
);

alter table public.equipped_skin disable row level security;


-- =====================================================================
-- Seed: 41体のアバタースキン
-- skin_key は既存フロント constants.ts の AVATAR_ITEMS キーと一致。
-- unlock_level は価格ティアで設定:
--   ~500 ALT : Lv0 (制限なし)
--   550-600  : Lv3
--   650      : Lv5
--   700      : Lv7
-- ON CONFLICT (skin_key) で再実行安全。
-- =====================================================================

insert into public.shop_items
  (skin_key, name, description, price_alt, unlock_level, image_url, category, sort_order)
values
  ('avatar-angel-chibi', '天使', 'キュートな天使のアバター', 450, 0,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/angel-chibi-clean_4a835ac9.png',
   'basic', 10),
  ('avatar-catgirl', '猫耳少女', 'すばしっこい猫耳冒険者のアバター', 500, 0,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-catgirl-gduMYXMoNGmwB5yPtRjzaj.png',
   'basic', 20),
  ('avatar-snow-rabbit', '雪うさぎ', '雪と氷の魔法を使ううさぎ耳の少女のアバター', 500, 0,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-snow-rabbit-UeFMxm9BAb7FbRKMWHbirf.png',
   'basic', 30),
  ('avatar-wind-mage', '風の使い', '風を操る自由な精霊使いのアバター', 500, 0,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-wind-mage-v2-GQ4dUJhvZbiFAsFokzQzea.png',
   'basic', 40),
  ('avatar-dancer', '踊り子', '華麗な舞で味方を鼓舞する踊り子のアバター', 500, 0,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dancer-mT9rG2mzjMURnSyNb8ikZe.png',
   'basic', 50),
  ('avatar-archer', '弓使い', '森のエルフ風弓使いのアバター', 500, 0,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-archer-v4-A5U7MXa9SXSAvABmkgELAf.png',
   'basic', 60),
  ('avatar-witch-chibi', '魔女', 'キュートな魔女のアバター', 500, 0,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-witch-chibi-nobg_d8795e50.png',
   'basic', 70),
  ('avatar-blacksmith', '鍛冶師', '伝説の武器を鋳造する鍛冶師のアバター', 500, 0,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-blacksmith-v2-f8avX4EpsHXE3TBvWHU4nE.png',
   'basic', 80),
  ('avatar-flower-spirit', '花の精霊', '花と蔓の力を操る精霊のアバター', 550, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-flower-spirit-TBMw74WqmbfhBwfP4ZFALV.png',
   'basic', 90),
  ('avatar-desert-traveler', '砂漠の旅人', '砂漠を渡る孤高の旅人のアバター', 550, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-desert-traveler-v2-AVewvGQLNxU75jm4MQoV7Z.png',
   'basic', 100),
  ('avatar-astrologer', '星術師', '星と月の力を読み解く星術師のアバター', 550, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-astrologer-v2-WnmiocJAnFjWeddtfiLGUG.png',
   'basic', 110),
  ('avatar-alchemist', '錬金術師', '薬品と発明の錬金術師のアバター', 550, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-alchemist-v4-fg2vQGvsSCxBj6k3zsU2UR.png',
   'basic', 120),
  ('avatar-herbalist', '薬草師', '癒しの薬草を操る薬草師のアバター', 550, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-herbalist-7MQz96ybykfSGoWhhVAgis.png',
   'basic', 130),
  ('avatar-stonemason', '石工', '岩と大地の魔法を操る石工のアバター', 550, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-stonemason-7s8e8KdTgvQH9SkpafvMG5.png',
   'basic', 140),
  ('avatar-hunter', '狩人', '森を駆ける罠と弓の使い手のアバター', 550, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-hunter_c473fd94.png',
   'basic', 150),
  ('avatar-priest', '僧侶', '聖なる光で仲間を癒す僧侶のアバター', 550, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-priest-mL3PwJ2kUtLPLv6rJSCsKU.png',
   'basic', 160),
  ('avatar-miko', '巫女', '神聖な力で邪を祓う巫女のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-miko-v2-FwSDuBz2DSkpWybyuracXk.png',
   'basic', 170),
  ('avatar-navigator', '操舵士', '空飛ぶ船を操る操舵士のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-navigator_9f0fb90d.png',
   'basic', 180),
  ('avatar-fairy', '妖精', '花と蝶の妖精のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-fairy-hUy98q9t6PHW7L3sUEuGuX.png',
   'basic', 190),
  ('avatar-dragon-rider-girl', '竜騎士', '竜と共に空を駆ける少女のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dragon-rider-girl-v2-EMsaPvM7Bs3FHxnyUuxHMG.png',
   'basic', 200),
  ('avatar-astronomer', '天文学者', '星と宇宙の神秘を読み解く天文学者のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-astronomer-DEkkA99rZdQ8yYfFoUL53G.png',
   'basic', 210),
  ('avatar-clockmaker', '時計師', '時間の魔法を操る神秘の時計師のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-clockmaker-go6eTrVXCws9nsb5FAbt4J.png',
   'basic', 220),
  ('avatar-beastman', '獣人', '虎の力を持つ格闘家のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-beastman-5uczRLrudH2rzjckU2W82t.png',
   'basic', 230),
  ('avatar-thunder-warrior', '雷の戦士', '雷をまとう電撃の戦士のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-thunder-warrior-v2-7zngK3aKoA6UCdQJtoYAkc.png',
   'basic', 240),
  ('avatar-werewolf', '狼男', '月夜に力を増す狼戦士のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-werewolf-3SBiP8QFnfHQeiaRn5SDsd.png',
   'basic', 250),
  ('avatar-dark-swordsman', '魔剣士', '魔力を帯びた剣を操る魔剣士のアバター', 600, 3,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dark-swordsman-v4-UBWbGwubeyZeSZsg4Aqmgw.png',
   'basic', 260),
  ('avatar-songstress', '歌姫', '歌声で魔法を紡ぐ歌姫のアバター', 650, 5,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-songstress-Z9aiGhZtLY9LV5Prh7xSxn.png',
   'basic', 270),
  ('avatar-mermaid', '人魚', '海の人魚姫のアバター', 650, 5,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-mermaid-W3eMXMAL535y4UpxxhGvGj.png',
   'basic', 280),
  ('avatar-beast-tamer', '魔獣使い', '魔獣を手懐ける勇敢な魔獣使いのアバター', 650, 5,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-beast-tamer_2009444c.png',
   'basic', 290),
  ('avatar-puppeteer', '人形師', '魔法の糸で人形を操る人形師のアバター', 650, 5,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-puppeteer-v2-PxvSPuuqfk3o9wpD5VcWCq.png',
   'basic', 300),
  ('avatar-knight', '騎士', '聖剣を掲げる騎士のアバター', 650, 5,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-knight-v4-8zTuxN8U6fyD5dZXNWEXMp.png',
   'basic', 310),
  ('avatar-vampire-girl', '吸血鬼', '夜を支配する美しき吸血鬼のアバター', 650, 5,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-vampire-girl-B7PygbpwNdfgbTe26e4GNQ.png',
   'basic', 320),
  ('avatar-pirate-prince', '海賊王子', '海を支配する若き海賊王子のアバター', 650, 5,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-pirate-prince-v2-VzARsnQLHhEqqHm2eByPxa.png',
   'basic', 330),
  ('avatar-assassin', '暗殺者', '闇に潜む二刀流の暗殺者のアバター', 650, 5,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-assassin-e9aPKdyGggXx4sPZAGNm98.png',
   'basic', 340),
  ('avatar-flame-dancer', '炎の舞姫', '炎をまとい舞う情熱の舞姫のアバター', 700, 7,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-flame-dancer-v2-PTjb7qFVgdyNJMqp7629f4.png',
   'basic', 350),
  ('avatar-ice-mage', '氷の魔法使い', '氷の結晶を操る魔法使いのアバター', 700, 7,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-ice-mage-7dMra5fnsoaoGesYrWpg62.png',
   'basic', 360),
  ('avatar-princess-chibi', '姫', 'キュートな姫のアバター', 700, 7,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-princess-chibi-nobg_c4db9ba6.png',
   'basic', 370),
  ('avatar-sage', '賢者', '古の知識を操る賢者のアバター', 700, 7,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-sage-7hfyG7z5GnP8Up4PcZrMhP.png',
   'basic', 380),
  ('avatar-shadow-mage', '影の魔導士', '闇の魔法を操る神秘の魔導士のアバター', 700, 7,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-shadow-mage-v2-Yw95nG8LeGikNqsKNsHtQZ.png',
   'basic', 390),
  ('avatar-star-knight', '星の騎士', '星の力を纏う天空の騎士のアバター', 700, 7,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-star-knight-6pgyoUJG7x4HjegxajAYH3.png',
   'basic', 400),
  ('avatar-demon-king', '魔王', '闇のオーラをまとう魔王のアバター', 700, 7,
   'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-demon-king-v4-7K9CRzptizyp6odX97pZ2S.png',
   'basic', 410)
on conflict (skin_key) do update set
  name = excluded.name,
  description = excluded.description,
  price_alt = excluded.price_alt,
  unlock_level = excluded.unlock_level,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order;
