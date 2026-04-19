import type { ComponentType } from 'react';

// Game types
export type GameCategory = 'math' | 'japanese' | 'science' | 'social' | 'inquiry' | 'puzzle';

export interface GameDefinition {
  id: string;
  title: string;
  description: string;
  category: GameCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  thumbnail: string;
  altReward: number;
  estimatedMinutes: number;
  emoji: string;
  component?: React.LazyExoticComponent<ComponentType<GameProps>>;
}

export interface GameProps {
  onComplete: (result: GameResult) => void;
  onExit: () => void;
  userId: string;
  bestScore?: number;
}

export interface GameResult {
  score: number;
  maxScore: number;
  timeSeconds: number;
  accuracy?: number;
  isBestScore?: boolean;
  /**
   * 画面上の score ラベル（kk 2026-04-19）。
   * KC（カードバトル）では 'FAN'、他ゲームは未設定で既定の 'PT'。
   */
  label?: string;
  /**
   * true の時、ResultPage は addTotalAlt() をスキップする（既に配布済み）。
   * KC の「受け取る」ボタン経由で ALT を加算したケースで立てる。
   */
  altAlreadyGranted?: boolean;
  metadata?: Record<string, unknown>;
}

// User types
export type ClassId = 'kids' | 'starter' | 'basic' | 'advance' | 'limitless';

export type AvatarType = 'boy' | 'girl';

export interface User {
  id: string;
  nickname: string;
  classId: ClassId;
  avatarUrl: string;
  avatarType: AvatarType;
  equippedAvatarId: string | null;
  purchasedAvatarIds: string[];
  titleId?: string;
  level: number;
  totalAlt: number;
  currentAlt: number;
  streakDays: number;
  lastLogin: string;
  createdAt: string;
}

// ALT types
export type AltTransactionType = 'game_clear' | 'login_bonus' | 'mission' | 'level_up' | 'gacha' | 'purchase';

export interface AltTransaction {
  id: string;
  userId: string;
  amount: number;
  type: AltTransactionType;
  referenceId?: string;
  balanceAfter: number;
  createdAt: string;
}

// Gacha types
export type CardCategory = 'great_person' | 'creature' | 'heritage' | 'invention' | 'trail';
export type CardRarity = 1 | 2 | 3 | 4 | 5 | 6;

// Collection card types
export type CollectionCategory = 'great_people' | 'creatures' | 'world_heritage' | 'inventions' | 'discovery';
export type CollectionRarity = 'N' | 'R' | 'SR' | 'SSR';

export interface CollectionCard {
  id: string;
  name: string;
  category: CollectionCategory;
  rarity: CollectionRarity;
  description: string;
  imageUrl: string;
}

export interface GachaCard {
  id: string;
  name: string;
  category: CardCategory;
  rarity: CardRarity;
  description: string;
  imageUrl: string;
  era?: string;
}

export interface UserCard {
  id: string;
  userId: string;
  cardId: string;
  count: number;
  obtainedAt: string;
}

// Ranking types
export interface RankingEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string;
  score: number;
  level: number;
}

// Shop types
export type ShopCategory = 'avatar' | 'title' | 'item';

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  price: number;
  imageUrl: string;
  description: string;
  owned: boolean;
}
