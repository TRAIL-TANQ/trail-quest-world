import { create } from 'zustand';
import type { User, GameResult, AvatarType } from './types';
import { MOCK_USER } from './mockData';

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

export const useUserStore = create<UserState>((set, get) => ({
  user: MOCK_USER,
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
  addCard: (cardId: string) => void;
  addCards: (cardIds: string[]) => void;
  hasCard: (cardId: string) => boolean;
  ownedCount: () => number;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  // デモ用: 最初の5枚を初期所持
  ownedCardIds: new Set(['card-001', 'card-002', 'card-003', 'card-011', 'card-016']),
  addCard: (cardId) =>
    set((state) => ({ ownedCardIds: new Set(Array.from(state.ownedCardIds).concat(cardId)) })),
  addCards: (cardIds) =>
    set((state) => ({ ownedCardIds: new Set(Array.from(state.ownedCardIds).concat(cardIds)) })),
  hasCard: (cardId) => get().ownedCardIds.has(cardId),
  ownedCount: () => get().ownedCardIds.size,
}));

// Gacha Store
interface GachaState {
  isAnimating: boolean;
  lastPulledCard: string | null;
  pityCount: number;
  setAnimating: (animating: boolean) => void;
  setLastPulledCard: (cardId: string | null) => void;
  incrementPity: () => void;
  resetPity: () => void;
}

export const useGachaStore = create<GachaState>((set) => ({
  isAnimating: false,
  lastPulledCard: null,
  pityCount: 0,
  setAnimating: (isAnimating) => set({ isAnimating }),
  setLastPulledCard: (lastPulledCard) => set({ lastPulledCard }),
  incrementPity: () => set((s) => ({ pityCount: s.pityCount + 1 })),
  resetPity: () => set({ pityCount: 0 }),
}));
