-- =====================================================================
-- 変更16: ショップ（アバタースキン） — 41 アバターの Seed
--
-- 前提: 0001_shop_tables.sql を先に実行して shop_items テーブルが存在すること。
--
-- name / description は英語（ASCII のみ）。日本語表示はフロントエンドで
-- skin_key をキーに i18n マップから引く。
--
-- unlock_level: ~500 ALT=Lv0 / 550-600=Lv3 / 650=Lv5 / 700=Lv7
-- ON CONFLICT (skin_key) で再実行安全。
-- =====================================================================

set client_encoding = 'UTF8';

insert into public.shop_items (skin_key, name, description, price_alt, unlock_level, image_url, category, sort_order) values
('avatar-angel-chibi', 'Angel', 'A cute angel avatar', 450, 0, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/angel-chibi-clean_4a835ac9.png', 'basic', 10),
('avatar-catgirl', 'Cat Girl', 'A nimble cat-eared adventurer avatar', 500, 0, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-catgirl-gduMYXMoNGmwB5yPtRjzaj.png', 'basic', 20),
('avatar-snow-rabbit', 'Snow Rabbit', 'A rabbit-eared girl who wields snow and ice magic', 500, 0, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-snow-rabbit-UeFMxm9BAb7FbRKMWHbirf.png', 'basic', 30),
('avatar-wind-mage', 'Wind Whisperer', 'A free-spirited elementalist who commands the wind', 500, 0, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-wind-mage-v2-GQ4dUJhvZbiFAsFokzQzea.png', 'basic', 40),
('avatar-dancer', 'Dancer', 'A dancer who inspires allies with graceful moves', 500, 0, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dancer-mT9rG2mzjMURnSyNb8ikZe.png', 'basic', 50),
('avatar-archer', 'Archer', 'A forest elf-style archer avatar', 500, 0, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-archer-v4-A5U7MXa9SXSAvABmkgELAf.png', 'basic', 60),
('avatar-witch-chibi', 'Witch', 'A cute witch avatar', 500, 0, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-witch-chibi-nobg_d8795e50.png', 'basic', 70),
('avatar-blacksmith', 'Blacksmith', 'A blacksmith who forges legendary weapons', 500, 0, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-blacksmith-v2-f8avX4EpsHXE3TBvWHU4nE.png', 'basic', 80),
('avatar-flower-spirit', 'Flower Spirit', 'A spirit who commands flowers and vines', 550, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-flower-spirit-TBMw74WqmbfhBwfP4ZFALV.png', 'basic', 90),
('avatar-desert-traveler', 'Desert Traveler', 'A lone wanderer crossing the desert', 550, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-desert-traveler-v2-AVewvGQLNxU75jm4MQoV7Z.png', 'basic', 100),
('avatar-astrologer', 'Astrologer', 'An astrologer who reads the power of stars and moon', 550, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-astrologer-v2-WnmiocJAnFjWeddtfiLGUG.png', 'basic', 110),
('avatar-alchemist', 'Alchemist', 'An alchemist of potions and inventions', 550, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-alchemist-v4-fg2vQGvsSCxBj6k3zsU2UR.png', 'basic', 120),
('avatar-herbalist', 'Herbalist', 'An herbalist who wields healing herbs', 550, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-herbalist-7MQz96ybykfSGoWhhVAgis.png', 'basic', 130),
('avatar-stonemason', 'Stonemason', 'A stonemason who commands earth and stone magic', 550, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-stonemason-7s8e8KdTgvQH9SkpafvMG5.png', 'basic', 140),
('avatar-hunter', 'Hunter', 'A forest hunter skilled with traps and bow', 550, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-hunter_c473fd94.png', 'basic', 150),
('avatar-priest', 'Priest', 'A priest who heals allies with holy light', 550, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-priest-mL3PwJ2kUtLPLv6rJSCsKU.png', 'basic', 160),
('avatar-miko', 'Shrine Maiden', 'A shrine maiden who purifies evil with sacred power', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-miko-v2-FwSDuBz2DSkpWybyuracXk.png', 'basic', 170),
('avatar-navigator', 'Navigator', 'A navigator who pilots flying ships', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-navigator_9f0fb90d.png', 'basic', 180),
('avatar-fairy', 'Fairy', 'A fairy of flowers and butterflies', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-fairy-hUy98q9t6PHW7L3sUEuGuX.png', 'basic', 190),
('avatar-dragon-rider-girl', 'Dragon Rider', 'A girl who soars the skies with her dragon', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dragon-rider-girl-v2-EMsaPvM7Bs3FHxnyUuxHMG.png', 'basic', 200),
('avatar-astronomer', 'Astronomer', 'An astronomer who unravels the mysteries of stars and space', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-astronomer-DEkkA99rZdQ8yYfFoUL53G.png', 'basic', 210),
('avatar-clockmaker', 'Clockmaker', 'A mystic clockmaker who commands time magic', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-clockmaker-go6eTrVXCws9nsb5FAbt4J.png', 'basic', 220),
('avatar-beastman', 'Beastman', 'A martial artist with the strength of a tiger', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-beastman-5uczRLrudH2rzjckU2W82t.png', 'basic', 230),
('avatar-thunder-warrior', 'Thunder Warrior', 'A warrior cloaked in lightning', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-thunder-warrior-v2-7zngK3aKoA6UCdQJtoYAkc.png', 'basic', 240),
('avatar-werewolf', 'Werewolf', 'A wolf warrior empowered by the moonlit night', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-werewolf-3SBiP8QFnfHQeiaRn5SDsd.png', 'basic', 250),
('avatar-dark-swordsman', 'Dark Swordsman', 'A swordsman who wields a blade imbued with dark magic', 600, 3, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dark-swordsman-v4-UBWbGwubeyZeSZsg4Aqmgw.png', 'basic', 260),
('avatar-songstress', 'Songstress', 'A songstress who weaves magic through her voice', 650, 5, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-songstress-Z9aiGhZtLY9LV5Prh7xSxn.png', 'basic', 270),
('avatar-mermaid', 'Mermaid', 'A mermaid princess of the sea', 650, 5, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-mermaid-W3eMXMAL535y4UpxxhGvGj.png', 'basic', 280),
('avatar-beast-tamer', 'Beast Tamer', 'A brave tamer of magical beasts', 650, 5, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-beast-tamer_2009444c.png', 'basic', 290),
('avatar-puppeteer', 'Puppeteer', 'A puppeteer who manipulates dolls with magical strings', 650, 5, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-puppeteer-v2-PxvSPuuqfk3o9wpD5VcWCq.png', 'basic', 300),
('avatar-knight', 'Knight', 'A knight wielding a holy sword', 650, 5, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-knight-v4-8zTuxN8U6fyD5dZXNWEXMp.png', 'basic', 310),
('avatar-vampire-girl', 'Vampire', 'A beautiful vampire who rules the night', 650, 5, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-vampire-girl-B7PygbpwNdfgbTe26e4GNQ.png', 'basic', 320),
('avatar-pirate-prince', 'Pirate Prince', 'A young pirate prince who rules the seas', 650, 5, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-pirate-prince-v2-VzARsnQLHhEqqHm2eByPxa.png', 'basic', 330),
('avatar-assassin', 'Assassin', 'A dual-blade assassin lurking in the shadows', 650, 5, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-assassin-e9aPKdyGggXx4sPZAGNm98.png', 'basic', 340),
('avatar-flame-dancer', 'Flame Dancer', 'A passionate dancer cloaked in flames', 700, 7, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-flame-dancer-v2-PTjb7qFVgdyNJMqp7629f4.png', 'basic', 350),
('avatar-ice-mage', 'Ice Mage', 'A mage who commands crystals of ice', 700, 7, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-ice-mage-7dMra5fnsoaoGesYrWpg62.png', 'basic', 360),
('avatar-princess-chibi', 'Princess', 'A cute princess avatar', 700, 7, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-princess-chibi-nobg_c4db9ba6.png', 'basic', 370),
('avatar-sage', 'Sage', 'A sage who commands ancient knowledge', 700, 7, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-sage-7hfyG7z5GnP8Up4PcZrMhP.png', 'basic', 380),
('avatar-shadow-mage', 'Shadow Mage', 'A mystic mage who commands shadow magic', 700, 7, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-shadow-mage-v2-Yw95nG8LeGikNqsKNsHtQZ.png', 'basic', 390),
('avatar-star-knight', 'Star Knight', 'A celestial knight clad in starlight', 700, 7, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-star-knight-6pgyoUJG7x4HjegxajAYH3.png', 'basic', 400),
('avatar-demon-king', 'Demon King', 'A demon king cloaked in dark aura', 700, 7, 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-demon-king-v4-7K9CRzptizyp6odX97pZ2S.png', 'basic', 410)
on conflict (skin_key) do update set
  name = excluded.name,
  description = excluded.description,
  price_alt = excluded.price_alt,
  unlock_level = excluded.unlock_level,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order;
