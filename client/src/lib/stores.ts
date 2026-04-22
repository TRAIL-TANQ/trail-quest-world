import { create } from 'zustand';
import type { User, GameResult, AvatarType, CollectionCard } from './types';
import { MOCK_USER, MOCK_DAILY_MISSIONS } from './mockData';
import { getAuth } from './auth';

// User Store
interface UserState {
  user: User;
  setUser: (user: User) => void;
  setNickname: (nickname: string) => void;
  setAvatarType: (avatarType: AvatarType) => void;
  updateAlt: (amount: number) => void;
  addTotalAlt: (amount: number) => void;
  purchaseAvatar: (avatarId: string, price: number) => boolean;
  equipAvatar: (avatarId: string | null) => void;
}

const _auth = getAuth();
// Guests start fresh every session: ALT=0, streak=0, level=1, no purchased avatars.
// Registered users も ALT/totalAlt は 0 スタート。ログイン時と HomePage マウント時に
// fetchChildStatus で DB から alt_points を同期注入する (2026-04-22)。
// 以前は MOCK_USER.currentAlt=1240 のダミー値が表示に残り続ける不具合があった。
const _initialUser = _auth.isGuest
  ? {
      ...MOCK_USER,
      id: _auth.childId,
      nickname: _auth.childName,
      totalAlt: 0,
      currentAlt: 0,
      streakDays: 0,
      level: 1,
      purchasedAvatarIds: [],
      equippedAvatarId: null,
    }
  : {
      ...MOCK_USER,
      id: _auth.childId,
      nickname: _auth.childName,
      totalAlt: 0,
      currentAlt: 0,
    };

export const useUserStore = create<UserState>((set, get) => ({
  user: _initialUser,
  setUser: (user) => set({ user }),
  setNickname: (nickname) =>
    set((state) => ({ user: { ...state.user, nickname } })),
  setAvatarType: (avatarType) =>
    set((state) => ({ user: { ...state.user, avatarType } })),
  updateAlt: (amount) =>
    set((state) => ({
      user: {
        ...state.user,
        currentAlt: Math.max(0, state.user.currentAlt + amount),
      },
    })),
  addTotalAlt: (amount) =>
    set((state) => ({
      user: {
        ...state.user,
        totalAlt: state.user.totalAlt + amount,
        currentAlt: state.user.currentAlt + amount,
      },
    })),
  purchaseAvatar: (avatarId: string, price: number) => {
    const { user } = get();
    if (user.currentAlt < price) return false;
    if (user.purchasedAvatarIds.includes(avatarId)) return false;
    set({
      user: {
        ...user,
        currentAlt: user.currentAlt - price,
        purchasedAvatarIds: [...user.purchasedAvatarIds, avatarId],
      },
    });
    return true;
  },
  equipAvatar: (avatarId: string | null) =>
    set((state) => ({ user: { ...state.user, equippedAvatarId: avatarId } })),
}));

// ALT Effect Store
interface AltEffectState {
  showEarnEffect: boolean;
  earnedAmount: number;
  triggerEarnEffect: (amount: number) => void;
  clearEarnEffect: () => void;
}

export const useAltStore = create<AltEffectState>((set) => ({
  showEarnEffect: false,
  earnedAmount: 0,
  triggerEarnEffect: (amount) => set({ showEarnEffect: true, earnedAmount: amount }),
  clearEarnEffect: () => set({ showEarnEffect: false, earnedAmount: 0 }),
}));

// Game Store
interface GameState {
  currentGameId: string | null;
  isPlaying: boolean;
  lastResult: GameResult | null;
  showResult: boolean;
  setCurrentGame: (gameId: string | null) => void;
  setPlaying: (playing: boolean) => void;
  setLastResult: (result: GameResult | null) => void;
  setShowResult: (show: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentGameId: null,
  isPlaying: false,
  lastResult: null,
  showResult: false,
  setCurrentGame: (currentGameId) => set({ currentGameId }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setLastResult: (lastResult) => set({ lastResult }),
  setShowResult: (showResult) => set({ showResult }),
}));

// Collection Store
interface CollectionState {
  ownedCardIds: Set<string>;
  newCardIds: Set<string>;      // 未確認のNEWカード
  acquiredOrder: string[];      // 取得順リスト
  initialized: boolean;         // 初期化済みフラグ
  addCard: (cardId: string) => void;
  addCards: (cardIds: string[]) => void;
  /** 永続データから復元（NEWバッジなし） */
  initOwned: (cardIds: string[]) => void;
  hasCard: (cardId: string) => boolean;
  ownedCount: () => number;
  clearNew: (cardId: string) => void;
  clearAllNew: () => void;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  // 初期状態: 0枚（ガチャ・クエスト・プレゼントで入手）
  ownedCardIds: new Set<string>(),
  newCardIds: new Set<string>(),
  acquiredOrder: [],
  initialized: false,
  addCard: (cardId) =>
    set((state) => {
      const alreadyOwned = state.ownedCardIds.has(cardId);
      return {
        ownedCardIds: new Set(Array.from(state.ownedCardIds).concat(cardId)),
        newCardIds: alreadyOwned ? state.newCardIds : new Set(Array.from(state.newCardIds).concat(cardId)),
        acquiredOrder: alreadyOwned ? state.acquiredOrder : [...state.acquiredOrder, cardId],
      };
    }),
  addCards: (cardIds) =>
    set((state) => {
      const newIds: string[] = [];
      const newOrder: string[] = [];
      cardIds.forEach((id) => {
        if (!state.ownedCardIds.has(id)) {
          newIds.push(id);
          newOrder.push(id);
        }
      });
      return {
        ownedCardIds: new Set(Array.from(state.ownedCardIds).concat(cardIds)),
        newCardIds: new Set(Array.from(state.newCardIds).concat(newIds)),
        acquiredOrder: [...state.acquiredOrder, ...newOrder],
      };
    }),
  initOwned: (cardIds) =>
    set((state) => {
      if (state.initialized) return state; // 二重初期化防止
      // セッション中に addCard で追加されたカードも保持
      const merged = new Set([...cardIds, ...Array.from(state.ownedCardIds)]);
      const existingExtra = state.acquiredOrder.filter((id) => !new Set(cardIds).has(id));
      return {
        ownedCardIds: merged,
        acquiredOrder: [...cardIds, ...existingExtra],
        initialized: true,
      };
    }),
  hasCard: (cardId) => get().ownedCardIds.has(cardId),
  ownedCount: () => get().ownedCardIds.size,
  clearNew: (cardId) =>
    set((state) => {
      const next = new Set(Array.from(state.newCardIds));
      next.delete(cardId);
      return { newCardIds: next };
    }),
  clearAllNew: () => set({ newCardIds: new Set<string>() }),
}));

// Mission Store
export interface MissionEntry {
  id: string;
  title: string;
  description: string;
  reward: number;
  category: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  completedAt?: number;
}

interface MissionState {
  missions: MissionEntry[];
  completedHistory: MissionEntry[];
  updateProgress: (missionId: string, delta: number) => boolean; // returns true if newly completed
  claimReward: (missionId: string) => number; // returns reward amount
  resetDaily: () => void;
}

export const useMissionStore = create<MissionState>((set, get) => ({
  missions: MOCK_DAILY_MISSIONS.map((m) => ({ ...m, completed: false, claimed: false })),
  completedHistory: [],
  updateProgress: (missionId, delta) => {
    let newlyCompleted = false;
    set((state) => ({
      missions: state.missions.map((m) => {
        if (m.id !== missionId || m.completed) return m;
        const newProgress = Math.min(m.progress + delta, m.target);
        const justCompleted = newProgress >= m.target;
        if (justCompleted) newlyCompleted = true;
        return { ...m, progress: newProgress, completed: justCompleted, completedAt: justCompleted ? Date.now() : undefined };
      }),
    }));
    return newlyCompleted;
  },
  claimReward: (missionId) => {
    let reward = 0;
    set((state) => {
      const mission = state.missions.find((m) => m.id === missionId);
      if (!mission || !mission.completed || mission.claimed) return state;
      reward = mission.reward;
      return {
        missions: state.missions.map((m) => m.id === missionId ? { ...m, claimed: true } : m),
        completedHistory: [{ ...mission, claimed: true }, ...state.completedHistory].slice(0, 50),
      };
    });
    return reward;
  },
  resetDaily: () =>
    set({
      missions: MOCK_DAILY_MISSIONS.map((m) => ({ ...m, completed: false, claimed: false })),
    }),
}));

// Gacha History Entry
export interface GachaHistoryEntry {
  id: string;
  card: CollectionCard;
  gachaType: 'normal' | 'premium';
  timestamp: number;
  isDuplicate: boolean;
}

// Gacha Store
interface GachaState {
  isAnimating: boolean;
  lastPulledCard: string | null;
  pityCount: number;         // ノーマル用天井カウント
  premiumPityCount: number;  // プレミアム用天井カウント
  history: GachaHistoryEntry[];
  setAnimating: (animating: boolean) => void;
  setLastPulledCard: (cardId: string | null) => void;
  incrementPity: (premium: boolean) => void;
  resetPity: (premium: boolean) => void;
  addHistory: (entry: GachaHistoryEntry) => void;
}

export const useGachaStore = create<GachaState>((set) => ({
  isAnimating: false,
  lastPulledCard: null,
  pityCount: 0,
  premiumPityCount: 0,
  history: [],
  setAnimating: (isAnimating) => set({ isAnimating }),
  setLastPulledCard: (lastPulledCard) => set({ lastPulledCard }),
  incrementPity: (premium) => premium
    ? set((s) => ({ premiumPityCount: s.premiumPityCount + 1 }))
    : set((s) => ({ pityCount: s.pityCount + 1 })),
  resetPity: (premium) => premium
    ? set({ premiumPityCount: 0 })
    : set({ pityCount: 0 }),
  addHistory: (entry) => set((s) => ({ history: [entry, ...s.history].slice(0, 100) })),
}));
