export const ALT_REWARDS = {
  GAME_CLEAR: 10,
  HIGH_SCORE_BONUS: 5,
  FIRST_CLEAR_BONUS: 20,
  DAILY_LOGIN: [5, 5, 10, 10, 10, 10, 20],
  DAILY_CHALLENGE: 15,
  WEEKLY_MISSION: 50,
} as const;

export const GACHA_COSTS = {
  NORMAL: 100,
  PREMIUM: 300,
} as const;

export const GACHA_RATES: Record<number, number> = {
  1: 0.45,
  2: 0.25,
  3: 0.15,
  4: 0.10,
  5: 0.04,
  6: 0.01,
};

export const PITY_THRESHOLD = 50; // 50回で★5確定

export const GAME_CATEGORIES = [
  { id: 'math', label: 'ATドリル', emoji: '🔢', color: '#F59E0B' },
  { id: 'inquiry', label: '探究クイズ', emoji: '💡', color: '#8B5CF6' },
  { id: 'puzzle', label: '算数ゲーム', emoji: '🧩', color: '#10B981' },
  { id: 'japanese', label: 'ことわざドロップ', emoji: '📝', color: '#EC4899' },
  { id: 'social', label: '歴史カルタ', emoji: '🏯', color: '#EF4444' },
  { id: 'science', label: '編成チーム', emoji: '🔬', color: '#06B6D4' },
] as const;

export const CLASS_LIST = [
  { id: 'kids', label: '探究キッズ' },
  { id: 'starter', label: 'スターター' },
  { id: 'basic', label: 'ベーシック' },
  { id: 'advance', label: 'アドバンス' },
  { id: 'limitless', label: 'リミットレス' },
] as const;

export const RARITY_LABELS: Record<number, string> = {
  1: 'コモン',
  2: 'アンコモン',
  3: 'レア',
  4: 'スーパーレア',
  5: 'ウルトラレア',
  6: 'レジェンド',
};

export const RARITY_COLORS: Record<number, string> = {
  1: '#6B7280',
  2: '#10B981',
  3: '#3B82F6',
  4: '#8B5CF6',
  5: '#F59E0B',
  6: '#EF4444', // rainbow handled in CSS
};

export const RARITY_STARS: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6,
};

export const IMAGES = {
  HERO_BG: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/hero-bg-Jai9rWoV87K9FsELWG3mYQ.webp',
  CHARACTER_BOY: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/character-hero-2wmW6vBwJ7cPhsVHq3CSdA.webp',
  CHARACTER_GIRL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/character-girl-v3-jcALUy94SnauX8FTbRvkDt.webp',
  CHARACTER: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/character-hero-2wmW6vBwJ7cPhsVHq3CSdA.webp',
  GACHA_BG: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/gacha-bg-Pp24mzomoq9FjGHvfoCsAu.webp',
  GAME_CARDS_BG: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/game-cards-bg-6uhzSAYtMkLjYUaYta9RTU.webp',
  RANKING_BG: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/ranking-bg-fpZohFzoXmMqhoB9qk9n5d.webp',
  GACHA_NORMAL_BTN: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/gacha-normal-btn-3BCvKpijW2ZjZA6yoEFUHM.webp',
  GACHA_PREMIUM_BTN: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/gacha-premium-btn-Bsv8V5Xd8zZsurtLfxEmb7.webp',
  // Avatar icons (face closeup) - 8 characters
  AVATAR_SAMURAI_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-samurai_74e28c25.png',
  AVATAR_WITCH_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-witch_bf89c325.png',
  AVATAR_PIRATE_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-pirate_d697279b.png',
  AVATAR_ANGEL_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-angel_f3d82c5f.png',
  AVATAR_DRAGON_KNIGHT_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-dragon-knight_e781a588.png',
  AVATAR_NINJA_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-ninja_38ca734d.png',
  AVATAR_SCIENTIST_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-scientist_155708f5.png',
  AVATAR_PRINCESS_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-princess_b1903ac4.png',
  // Avatar full body - 8 characters
  AVATAR_SAMURAI_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-samurai-nobg_42048c67.png',
  AVATAR_WITCH_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-witch-nobg_7d85c46d.png',
  AVATAR_PIRATE_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-pirate-nobg_7407477e.png',
  AVATAR_ANGEL_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-angel-nobg_85372d44.png',
  AVATAR_DRAGON_KNIGHT_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dragon-knight-nobg_b360ce98.png',
  AVATAR_NINJA_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-ninja-nobg_aae34d0a.png',
  AVATAR_SCIENTIST_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-scientist-nobg_37a7e258.png',
  AVATAR_PRINCESS_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-princess-nobg_f41401e7.png',
  // New characters - icons (face crop from full body)
  AVATAR_NINJA_V2_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-ninja-v2-face-crop-5wUTPRPwdEbnsiFPpV2Azn.webp',
  // New characters - full body (user provided)
  AVATAR_NINJA_V2_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-ninja-v2-nobg_506df4a0.png',
  // Chibi (deformed) versions - princess, witch, angel
  AVATAR_PRINCESS_CHIBI_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-princess-chibi-DJZAVhMdtB93qzL8X3dGPT.webp',
  AVATAR_PRINCESS_CHIBI_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-princess-chibi-nobg_c4db9ba6.png',
  AVATAR_WITCH_CHIBI_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-witch-chibi-6jxsWBHGU8dL5RKxp4DXNQ.webp',
  AVATAR_WITCH_CHIBI_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-witch-chibi-nobg_d8795e50.png',
  AVATAR_ANGEL_CHIBI_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-angel-chibi-TzB6zpTHLshyCmuXYddQhp.webp',
  AVATAR_ANGEL_CHIBI_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/angel-chibi-clean_4a835ac9.png',
  // New female characters - fairy, mermaid, ice mage
  AVATAR_FAIRY_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-fairy-VrXdcWE9At3CuR2JzfGvGw.webp',
  AVATAR_FAIRY_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-fairy-hUy98q9t6PHW7L3sUEuGuX.png',
  AVATAR_MERMAID_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-mermaid-2cLTD6gmoUhe9gFQxmbAK9.webp',
  AVATAR_MERMAID_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-mermaid-W3eMXMAL535y4UpxxhGvGj.png',
  AVATAR_ICE_MAGE_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-ice-mage-62nnnV8WFVasd6sF59Phh3.webp',
  AVATAR_ICE_MAGE_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-ice-mage-7dMra5fnsoaoGesYrWpg62.png',
  // New male characters - demon king, archer, knight, alchemist, dark swordsman
  AVATAR_DEMON_KING_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-demon-king-v4-NAjwr7tf5zN6ro2RwjDJaD.webp',
  AVATAR_DEMON_KING_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-demon-king-v4-7K9CRzptizyp6odX97pZ2S.png',
  AVATAR_ARCHER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-archer-v4-5sfFfgg2iRWCCuRAzHBEP2.webp',
  AVATAR_ARCHER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-archer-v4-A5U7MXa9SXSAvABmkgELAf.png',
  AVATAR_KNIGHT_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-knight-v4-HESNKtGH7V6BTJmPFoqW68.webp',
  AVATAR_KNIGHT_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-knight-v4-8zTuxN8U6fyD5dZXNWEXMp.png',
  AVATAR_ALCHEMIST_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-alchemist-v4-a4sPBYdxVizt8mvBvdu7sj.webp',
  AVATAR_ALCHEMIST_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-alchemist-v4-fg2vQGvsSCxBj6k3zsU2UR.png',
  AVATAR_DARK_SWORDSMAN_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dark-swordsman-v4-HsscxwXsUeHE5aUVFHjD3W.webp',
  AVATAR_DARK_SWORDSMAN_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dark-swordsman-v4-UBWbGwubeyZeSZsg4Aqmgw.png',
  // New batch 2 - female characters
  AVATAR_MIKO_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-miko-v2-9HUBfzVvE9YmMSahkaURbA.webp',
  AVATAR_MIKO_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-miko-v2-FwSDuBz2DSkpWybyuracXk.png',
  AVATAR_VAMPIRE_GIRL_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-vampire-girl-FWsFrmGw57CdCpm9z2eW6G.webp',
  AVATAR_VAMPIRE_GIRL_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-vampire-girl-B7PygbpwNdfgbTe26e4GNQ.png',
  AVATAR_DANCER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dancer-RCw8sYHmKebSq34yi7Rhdj.webp',
  AVATAR_DANCER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dancer-mT9rG2mzjMURnSyNb8ikZe.png',
  AVATAR_FLOWER_SPIRIT_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-flower-spirit-29GuUH3sLqavMwtzayC3Vd.webp',
  AVATAR_FLOWER_SPIRIT_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-flower-spirit-TBMw74WqmbfhBwfP4ZFALV.png',
  AVATAR_CATGIRL_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-catgirl-o5XnLRYaRLAxZAMZzj3vSg.webp',
  AVATAR_CATGIRL_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-catgirl-gduMYXMoNGmwB5yPtRjzaj.png',
  // New batch 2 - male characters
  AVATAR_WEREWOLF_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-werewolf-AAy9yFVSioUgw2mCApVJf7.webp',
  AVATAR_WEREWOLF_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-werewolf-3SBiP8QFnfHQeiaRn5SDsd.png',
  AVATAR_PRIEST_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-priest-GZdnhUzgRTr6MK6JBXBJu9.webp',
  AVATAR_PRIEST_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-priest-mL3PwJ2kUtLPLv6rJSCsKU.png',
  AVATAR_ASSASSIN_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-assassin-XsTcfX3wxiR9wbYHBUGuPv.webp',
  AVATAR_ASSASSIN_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-assassin-e9aPKdyGggXx4sPZAGNm98.png',
  AVATAR_BEASTMAN_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-beastman-HQo2hyrKdFzzWyAADJQMQN.webp',
  AVATAR_BEASTMAN_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-beastman-5uczRLrudH2rzjckU2W82t.png',
  AVATAR_SAGE_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-sage-36UAEdBtdwBRcJ6BDEHomX.webp',
  AVATAR_SAGE_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-sage-7hfyG7z5GnP8Up4PcZrMhP.png',
  // Batch 3 - female characters
  AVATAR_DRAGON_RIDER_GIRL_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dragon-rider-girl-v2-cWWQdGtxcTSKrcBteqBKBq.webp',
  AVATAR_DRAGON_RIDER_GIRL_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-dragon-rider-girl-v2-EMsaPvM7Bs3FHxnyUuxHMG.png',
  AVATAR_ASTROLOGER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-astrologer-v2-jpgV3M2bY47RPyvatdaTy3.webp',
  AVATAR_ASTROLOGER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-astrologer-v2-WnmiocJAnFjWeddtfiLGUG.png',
  AVATAR_WIND_MAGE_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-wind-mage-v2-ZmZZaUVsXcGEZoa6tfz7Te.webp',
  AVATAR_WIND_MAGE_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-wind-mage-v2-GQ4dUJhvZbiFAsFokzQzea.png',
  AVATAR_PUPPETEER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-puppeteer-v2-4iYiBxYSX5xpKBMKFkppXj.webp',
  AVATAR_PUPPETEER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-puppeteer-v2-PxvSPuuqfk3o9wpD5VcWCq.png',
  AVATAR_FLAME_DANCER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-flame-dancer-v2-JKjgkffeirvGUEeGQY8R5C.webp',
  AVATAR_FLAME_DANCER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-flame-dancer-v2-PTjb7qFVgdyNJMqp7629f4.png',
  // Batch 3 - male characters
  AVATAR_PIRATE_PRINCE_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-pirate-prince-v2-9VDrYHjA9SHhCEUgtvsByQ.webp',
  AVATAR_PIRATE_PRINCE_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-pirate-prince-v2-VzARsnQLHhEqqHm2eByPxa.png',
  AVATAR_DESERT_TRAVELER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-desert-traveler-v2-hyBvfJjYDsWLC4RF8KxbdY.webp',
  AVATAR_DESERT_TRAVELER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-desert-traveler-v2-AVewvGQLNxU75jm4MQoV7Z.png',
  AVATAR_THUNDER_WARRIOR_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-thunder-warrior-v2-5jw3XiuW4CdwBNn47B9cKD.webp',
  AVATAR_THUNDER_WARRIOR_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-thunder-warrior-v2-7zngK3aKoA6UCdQJtoYAkc.png',
  AVATAR_SHADOW_MAGE_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-shadow-mage-v2-HMoe3FDRtgw55FTsbpYoiZ.webp',
  AVATAR_SHADOW_MAGE_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-shadow-mage-v2-Yw95nG8LeGikNqsKNsHtQZ.png',
  AVATAR_BLACKSMITH_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-blacksmith-v2-KjTD6ydHSFh54EThBZKA6W.webp',
  AVATAR_BLACKSMITH_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-blacksmith-v2-f8avX4EpsHXE3TBvWHU4nE.png',
  // Batch 4 - female characters
  AVATAR_ASTRONOMER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-astronomer-mJGWCezLy7tjwVtjsWyZ8x.webp',
  AVATAR_ASTRONOMER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-astronomer-DEkkA99rZdQ8yYfFoUL53G.png',
  AVATAR_HERBALIST_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-herbalist-NTPpaCKe75NkT38NNheDrF.webp',
  AVATAR_HERBALIST_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-herbalist-7MQz96ybykfSGoWhhVAgis.png',
  AVATAR_SONGSTRESS_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-songstress-cQFH5u42ZMd6TLgjDceNcF.webp',
  AVATAR_SONGSTRESS_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-songstress-Z9aiGhZtLY9LV5Prh7xSxn.png',
  AVATAR_CLOCKMAKER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-clockmaker-9qTJ5HMzDpsUsD946gxNRm.webp',
  AVATAR_CLOCKMAKER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-clockmaker-go6eTrVXCws9nsb5FAbt4J.png',
  AVATAR_SNOW_RABBIT_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-snow-rabbit-8ZorYhKGpFXGXfMELwruHL.webp',
  AVATAR_SNOW_RABBIT_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-snow-rabbit-UeFMxm9BAb7FbRKMWHbirf.png',
  // Batch 4 - male characters
  AVATAR_HUNTER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-hunter_c473fd94.png',
  AVATAR_HUNTER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-hunter_c473fd94.png',
  AVATAR_NAVIGATOR_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-navigator_9f0fb90d.png',
  AVATAR_NAVIGATOR_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-navigator_9f0fb90d.png',
  AVATAR_BEAST_TAMER_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-beast-tamer_2009444c.png',
  AVATAR_BEAST_TAMER_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-beast-tamer_2009444c.png',
  AVATAR_STONEMASON_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-stonemason-B4Cd58MCtNo9ttgLXoquBB.webp',
  AVATAR_STONEMASON_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-stonemason-7s8e8KdTgvQH9SkpafvMG5.png',
  AVATAR_STAR_KNIGHT_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-star-knight-LwuD8ncLKwfzcWvhpy5Xvw.webp',
  AVATAR_STAR_KNIGHT_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-star-knight-6pgyoUJG7x4HjegxajAYH3.png',
} as const;

// Avatar items for shop - maps avatar IDs to their image URLs
export const AVATAR_ITEMS: Record<string, { icon: string; full: string }> = {
  'avatar-princess-chibi': { icon: IMAGES.AVATAR_PRINCESS_CHIBI_ICON, full: IMAGES.AVATAR_PRINCESS_CHIBI_FULL },
  'avatar-witch-chibi': { icon: IMAGES.AVATAR_WITCH_CHIBI_ICON, full: IMAGES.AVATAR_WITCH_CHIBI_FULL },
  'avatar-angel-chibi': { icon: IMAGES.AVATAR_ANGEL_CHIBI_ICON, full: IMAGES.AVATAR_ANGEL_CHIBI_FULL },
  'avatar-fairy': { icon: IMAGES.AVATAR_FAIRY_ICON, full: IMAGES.AVATAR_FAIRY_FULL },
  'avatar-mermaid': { icon: IMAGES.AVATAR_MERMAID_ICON, full: IMAGES.AVATAR_MERMAID_FULL },
  'avatar-ice-mage': { icon: IMAGES.AVATAR_ICE_MAGE_ICON, full: IMAGES.AVATAR_ICE_MAGE_FULL },
  'avatar-demon-king': { icon: IMAGES.AVATAR_DEMON_KING_ICON, full: IMAGES.AVATAR_DEMON_KING_FULL },
  'avatar-archer': { icon: IMAGES.AVATAR_ARCHER_ICON, full: IMAGES.AVATAR_ARCHER_FULL },
  'avatar-knight': { icon: IMAGES.AVATAR_KNIGHT_ICON, full: IMAGES.AVATAR_KNIGHT_FULL },
  'avatar-alchemist': { icon: IMAGES.AVATAR_ALCHEMIST_ICON, full: IMAGES.AVATAR_ALCHEMIST_FULL },
  'avatar-dark-swordsman': { icon: IMAGES.AVATAR_DARK_SWORDSMAN_ICON, full: IMAGES.AVATAR_DARK_SWORDSMAN_FULL },
  'avatar-miko': { icon: IMAGES.AVATAR_MIKO_ICON, full: IMAGES.AVATAR_MIKO_FULL },
  'avatar-vampire-girl': { icon: IMAGES.AVATAR_VAMPIRE_GIRL_ICON, full: IMAGES.AVATAR_VAMPIRE_GIRL_FULL },
  'avatar-dancer': { icon: IMAGES.AVATAR_DANCER_ICON, full: IMAGES.AVATAR_DANCER_FULL },
  'avatar-flower-spirit': { icon: IMAGES.AVATAR_FLOWER_SPIRIT_ICON, full: IMAGES.AVATAR_FLOWER_SPIRIT_FULL },
  'avatar-catgirl': { icon: IMAGES.AVATAR_CATGIRL_ICON, full: IMAGES.AVATAR_CATGIRL_FULL },
  'avatar-werewolf': { icon: IMAGES.AVATAR_WEREWOLF_ICON, full: IMAGES.AVATAR_WEREWOLF_FULL },
  'avatar-priest': { icon: IMAGES.AVATAR_PRIEST_ICON, full: IMAGES.AVATAR_PRIEST_FULL },
  'avatar-assassin': { icon: IMAGES.AVATAR_ASSASSIN_ICON, full: IMAGES.AVATAR_ASSASSIN_FULL },
  'avatar-beastman': { icon: IMAGES.AVATAR_BEASTMAN_ICON, full: IMAGES.AVATAR_BEASTMAN_FULL },
  'avatar-sage': { icon: IMAGES.AVATAR_SAGE_ICON, full: IMAGES.AVATAR_SAGE_FULL },
  'avatar-dragon-rider-girl': { icon: IMAGES.AVATAR_DRAGON_RIDER_GIRL_ICON, full: IMAGES.AVATAR_DRAGON_RIDER_GIRL_FULL },
  'avatar-astrologer': { icon: IMAGES.AVATAR_ASTROLOGER_ICON, full: IMAGES.AVATAR_ASTROLOGER_FULL },
  'avatar-wind-mage': { icon: IMAGES.AVATAR_WIND_MAGE_ICON, full: IMAGES.AVATAR_WIND_MAGE_FULL },
  'avatar-puppeteer': { icon: IMAGES.AVATAR_PUPPETEER_ICON, full: IMAGES.AVATAR_PUPPETEER_FULL },
  'avatar-flame-dancer': { icon: IMAGES.AVATAR_FLAME_DANCER_ICON, full: IMAGES.AVATAR_FLAME_DANCER_FULL },
  'avatar-pirate-prince': { icon: IMAGES.AVATAR_PIRATE_PRINCE_ICON, full: IMAGES.AVATAR_PIRATE_PRINCE_FULL },
  'avatar-desert-traveler': { icon: IMAGES.AVATAR_DESERT_TRAVELER_ICON, full: IMAGES.AVATAR_DESERT_TRAVELER_FULL },
  'avatar-thunder-warrior': { icon: IMAGES.AVATAR_THUNDER_WARRIOR_ICON, full: IMAGES.AVATAR_THUNDER_WARRIOR_FULL },
  'avatar-shadow-mage': { icon: IMAGES.AVATAR_SHADOW_MAGE_ICON, full: IMAGES.AVATAR_SHADOW_MAGE_FULL },
  'avatar-blacksmith': { icon: IMAGES.AVATAR_BLACKSMITH_ICON, full: IMAGES.AVATAR_BLACKSMITH_FULL },
  'avatar-astronomer': { icon: IMAGES.AVATAR_ASTRONOMER_ICON, full: IMAGES.AVATAR_ASTRONOMER_FULL },
  'avatar-herbalist': { icon: IMAGES.AVATAR_HERBALIST_ICON, full: IMAGES.AVATAR_HERBALIST_FULL },
  'avatar-songstress': { icon: IMAGES.AVATAR_SONGSTRESS_ICON, full: IMAGES.AVATAR_SONGSTRESS_FULL },
  'avatar-clockmaker': { icon: IMAGES.AVATAR_CLOCKMAKER_ICON, full: IMAGES.AVATAR_CLOCKMAKER_FULL },
  'avatar-snow-rabbit': { icon: IMAGES.AVATAR_SNOW_RABBIT_ICON, full: IMAGES.AVATAR_SNOW_RABBIT_FULL },
  'avatar-hunter': { icon: IMAGES.AVATAR_HUNTER_ICON, full: IMAGES.AVATAR_HUNTER_FULL },
  'avatar-navigator': { icon: IMAGES.AVATAR_NAVIGATOR_ICON, full: IMAGES.AVATAR_NAVIGATOR_FULL },
  'avatar-beast-tamer': { icon: IMAGES.AVATAR_BEAST_TAMER_ICON, full: IMAGES.AVATAR_BEAST_TAMER_FULL },
  'avatar-stonemason': { icon: IMAGES.AVATAR_STONEMASON_ICON, full: IMAGES.AVATAR_STONEMASON_FULL },
  'avatar-star-knight': { icon: IMAGES.AVATAR_STAR_KNIGHT_ICON, full: IMAGES.AVATAR_STAR_KNIGHT_FULL },
};

export const CATEGORY_TABS = [
  { id: 'all', label: '全て', emoji: '🎯' },
  { id: 'math', label: '算数', emoji: '🔢' },
  { id: 'japanese', label: '国語', emoji: '📝' },
  { id: 'science', label: '理科', emoji: '🔬' },
  { id: 'social', label: '社会', emoji: '🌍' },
  { id: 'inquiry', label: '探究', emoji: '💡' },
  { id: 'puzzle', label: 'パズル', emoji: '🧩' },
] as const;

// Card collection categories and rarity types
export const CARD_CATEGORIES = {
  GREAT_PEOPLE: 'great_people',
  CREATURES: 'creatures',
  WORLD_HERITAGE: 'world_heritage',
  INVENTIONS: 'inventions',
  DISCOVERY: 'discovery',
} as const;

export const CARD_RARITY = {
  N: 'N',
  R: 'R',
  SR: 'SR',
  SSR: 'SSR',
} as const;

// Card rarity colors for display
export const CARD_RARITY_COLORS: Record<string, string> = {
  N: '#9CA3AF',    // Gray
  R: '#3B82F6',    // Blue
  SR: '#F59E0B',   // Gold
  SSR: '#A855F7',  // Purple/Rainbow
};

// Card rarity representative images (used for all cards of same rarity)
export const CARD_RARITY_IMAGES: Record<string, string> = {
  N: '/images/frames/frame-n.png',
  R: '/images/frames/frame-r.png',
  SR: '/images/frames/frame-sr.png',
  SSR: '/images/frames/frame-ssr.png',
};

// Card category display info (representative images per category - deprecated, use CARD_RARITY_IMAGES instead)
export const CARD_CATEGORY_IMAGES: Record<string, string> = {
  great_people: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/card-rep-sr-LMx2AHbGgNtTL85NAiybHj.webp',
  creatures: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/card-rep-sr-LMx2AHbGgNtTL85NAiybHj.webp',
  world_heritage: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/card-rep-sr-LMx2AHbGgNtTL85NAiybHj.webp',
  inventions: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/card-rep-n-HvgDEr3VJJJWWzEB9mtuRQ.webp',
  discovery: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/card-rep-ssr-aFRkQBrpWBfRMaXSxKo9Lj.webp',
};

export const CARD_CATEGORY_INFO: Record<string, { label: string; emoji: string }> = {
  great_people: { label: '偉人', emoji: '👤' },
  creatures: { label: '生き物', emoji: '🦖' },
  world_heritage: { label: '世界遺産', emoji: '🏛️' },
  inventions: { label: '発明', emoji: '💡' },
  discovery: { label: '探究', emoji: '🔭' },
};
