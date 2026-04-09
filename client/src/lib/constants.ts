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
  AVATAR_SAMURAI_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-samurai-full-v2-BF6VN29n4hjS5DmZhckyAw.png',
  AVATAR_WITCH_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-witch-full-7U6EYGx877ghQUxQSFGLhk.png',
  AVATAR_PIRATE_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-pirate-full-v2-Ff5HtkVQKoEk2axfEqKdzZ.png',
  AVATAR_ANGEL_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-angel-full-NvH3ghR8K9yCU5SDGSovtY.png',
  AVATAR_DRAGON_KNIGHT_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-dragon-knight-full-v2-CQ2tHTsozBKZCY3LWEsmMk.png',
  AVATAR_NINJA_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-ninja-full-6bBF8kQyFdQtWHKaxbUjzR.png',
  AVATAR_SCIENTIST_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-scientist-full-v2-3rZDZowSoAGab56fo47Svn.png',
  AVATAR_PRINCESS_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-avatar-princess-full-9Z7JE87nqzrVUrhrJVBMBn.png',
  // New characters - icons (face crop from full body)
  AVATAR_NINJA_V2_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-ninja-v2-face-crop-5wUTPRPwdEbnsiFPpV2Azn.webp',
  // New characters - full body (user provided)
  AVATAR_NINJA_V2_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/shop-ninja-v2-5wUTPRPwdEbnsiFPpV2Azn.webp',
  // Chibi (deformed) versions - princess, witch, angel
  AVATAR_PRINCESS_CHIBI_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-princess-chibi-DJZAVhMdtB93qzL8X3dGPT.webp',
  AVATAR_PRINCESS_CHIBI_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-princess-chibi-jmsgPqeSEiXQBb8SYDEPKB.png',
  AVATAR_WITCH_CHIBI_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-witch-chibi-6jxsWBHGU8dL5RKxp4DXNQ.webp',
  AVATAR_WITCH_CHIBI_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-witch-chibi-VAPCQR9CvdUKeTdkmnLLXB.png',
  AVATAR_ANGEL_CHIBI_ICON: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-angel-chibi-TzB6zpTHLshyCmuXYddQhp.webp',
  AVATAR_ANGEL_CHIBI_FULL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/avatar-angel-chibi-U32arQ8NJ76vHW4xSetBVe.png',
} as const;

// Avatar items for shop - maps avatar IDs to their image URLs
export const AVATAR_ITEMS: Record<string, { icon: string; full: string }> = {
  'avatar-samurai': { icon: IMAGES.AVATAR_SAMURAI_ICON, full: IMAGES.AVATAR_SAMURAI_FULL },
  'avatar-witch': { icon: IMAGES.AVATAR_WITCH_ICON, full: IMAGES.AVATAR_WITCH_FULL },
  'avatar-pirate': { icon: IMAGES.AVATAR_PIRATE_ICON, full: IMAGES.AVATAR_PIRATE_FULL },
  'avatar-angel': { icon: IMAGES.AVATAR_ANGEL_ICON, full: IMAGES.AVATAR_ANGEL_FULL },
  'avatar-dragon-knight': { icon: IMAGES.AVATAR_DRAGON_KNIGHT_ICON, full: IMAGES.AVATAR_DRAGON_KNIGHT_FULL },
  'avatar-ninja': { icon: IMAGES.AVATAR_NINJA_ICON, full: IMAGES.AVATAR_NINJA_FULL },
  'avatar-scientist': { icon: IMAGES.AVATAR_SCIENTIST_ICON, full: IMAGES.AVATAR_SCIENTIST_FULL },
  'avatar-princess': { icon: IMAGES.AVATAR_PRINCESS_ICON, full: IMAGES.AVATAR_PRINCESS_FULL },
  'avatar-ninja-v2': { icon: IMAGES.AVATAR_NINJA_V2_ICON, full: IMAGES.AVATAR_NINJA_V2_FULL },
  'avatar-princess-chibi': { icon: IMAGES.AVATAR_PRINCESS_CHIBI_ICON, full: IMAGES.AVATAR_PRINCESS_CHIBI_FULL },
  'avatar-witch-chibi': { icon: IMAGES.AVATAR_WITCH_CHIBI_ICON, full: IMAGES.AVATAR_WITCH_CHIBI_FULL },
  'avatar-angel-chibi': { icon: IMAGES.AVATAR_ANGEL_CHIBI_ICON, full: IMAGES.AVATAR_ANGEL_CHIBI_FULL },
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
  N: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/card-v2-n-kPu7ZFuWT2GeTf2MLdEJCw.webp',
  R: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/card-v2-r-mZgBL7gwn7vCxTHa746Sig.webp',
  SR: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/card-v2-sr-XySLx9ch4Rk6tDm6eDiAdS.webp',
  SSR: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/card-v2-ssr-na7Dp8Tm8JQba5nGvv2f3V.webp',
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
