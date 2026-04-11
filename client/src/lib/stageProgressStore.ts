/**
 * ステージ進行ストア - localStorage バックエンド (変更9)
 *
 * ・どのステージをクリア済みか
 * ・各ステージのクリア報酬を既に受け取ったか
 *
 * Supabase には持たず、クライアント側の zustand + localStorage 永続化で
 * 管理する（再インストールやデバイス変更でリセットしてもゲームプレイに影響しない）。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StageProgressState {
  clearedIds: Set<number>;
  rewardedIds: Set<number>;   // 既にクリア報酬を配布済み（再配布防止）
  markCleared: (stageId: number) => void;
  isCleared: (stageId: number) => boolean;
  markRewarded: (stageId: number) => void;
  isRewarded: (stageId: number) => boolean;
  highestClearedStage: () => number;
  reset: () => void;
}

// Set は JSON 化できないので Array <-> Set で手動変換する persist 設定
export const useStageProgressStore = create<StageProgressState>()(
  persist(
    (set, get) => ({
      clearedIds: new Set<number>(),
      rewardedIds: new Set<number>(),
      markCleared: (stageId) =>
        set((s) => {
          const next = new Set(s.clearedIds);
          next.add(stageId);
          return { clearedIds: next };
        }),
      isCleared: (stageId) => get().clearedIds.has(stageId),
      markRewarded: (stageId) =>
        set((s) => {
          const next = new Set(s.rewardedIds);
          next.add(stageId);
          return { rewardedIds: next };
        }),
      isRewarded: (stageId) => get().rewardedIds.has(stageId),
      highestClearedStage: () => {
        const ids = Array.from(get().clearedIds);
        return ids.length === 0 ? 0 : Math.max(...ids);
      },
      reset: () => set({ clearedIds: new Set(), rewardedIds: new Set() }),
    }),
    {
      name: 'trail-quest-stage-progress',
      // Set をシリアライズ可能な配列に変換
      partialize: (state) => ({
        clearedIds: Array.from(state.clearedIds),
        rewardedIds: Array.from(state.rewardedIds),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // partialize で保存した配列を Set に戻す
          const anyState = state as unknown as { clearedIds: number[] | Set<number>; rewardedIds: number[] | Set<number> };
          anyState.clearedIds = new Set(Array.from(anyState.clearedIds ?? []));
          anyState.rewardedIds = new Set(Array.from(anyState.rewardedIds ?? []));
        }
      },
    },
  ),
);
