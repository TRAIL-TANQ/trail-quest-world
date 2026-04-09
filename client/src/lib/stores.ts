import { create } from 'zustand';
import type { User, GameResult } from './types';
import { MOCK_USER } from './mockData';

// User Store
interface UserState {
  user: User;
  setUser: (user: User) => void;
  setNickname: (nickname: string) => void;
  updateAlt: (amount: number) => void;
  addTotalAlt: (amount: number) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: MOCK_USER,
  setUser: (user) => set({ user }),
  setNickname: (nickname) =>
    set((state) => ({ user: { ...state.user, nickname } })),
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
