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
  CHARACTER_GIRL: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/character-girl-v2-7UHbtA6xZMJeCz4ZL8uDAx.webp',
  CHARACTER: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/character-hero-2wmW6vBwJ7cPhsVHq3CSdA.webp',
  GACHA_BG: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/gacha-bg-Pp24mzomoq9FjGHvfoCsAu.webp',
  GAME_CARDS_BG: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/game-cards-bg-6uhzSAYtMkLjYUaYta9RTU.webp',
  RANKING_BG: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663286960690/CC7Nszgn2u4nYzHuXnVPTK/ranking-bg-fpZohFzoXmMqhoB9qk9n5d.webp',
} as const;

export const CATEGORY_TABS = [
  { id: 'all', label: '全て', emoji: '🎯' },
  { id: 'math', label: '算数', emoji: '🔢' },
  { id: 'japanese', label: '国語', emoji: '📝' },
  { id: 'science', label: '理科', emoji: '🔬' },
  { id: 'social', label: '社会', emoji: '🌍' },
  { id: 'inquiry', label: '探究', emoji: '💡' },
  { id: 'puzzle', label: 'パズル', emoji: '🧩' },
] as const;
