/**
 * useGameTimer — プレイ時間計測用の共通フック
 *
 * 保護者ダッシュボードの「学習時間」集計のため、
 * KnowledgeChallenger / ALTゲームの開始〜終了の経過秒数を計測する。
 *
 * 使い方:
 *   const timer = useGameTimer();
 *   const onStart = () => { timer.start(); ... };
 *   const onFinish = () => {
 *     const durationSeconds = timer.getElapsedSeconds();
 *     await finalizeAltGame({ ..., durationSeconds });
 *   };
 *
 * - start() を呼ばずに getElapsedSeconds() した場合は 0 を返す（未計測扱い）。
 * - reset() は再プレイ前に明示的にクリアしたいときのみ使用（start() が
 *   上書きするので通常は不要）。
 */
import { useCallback, useRef } from 'react';

export interface GameTimer {
  start: () => void;
  getElapsedSeconds: () => number;
  reset: () => void;
}

export function useGameTimer(): GameTimer {
  const startRef = useRef<number>(0);

  const start = useCallback(() => {
    startRef.current = Date.now();
  }, []);

  const getElapsedSeconds = useCallback(() => {
    if (startRef.current === 0) return 0;
    return Math.floor((Date.now() - startRef.current) / 1000);
  }, []);

  const reset = useCallback(() => {
    startRef.current = 0;
  }, []);

  return { start, getElapsedSeconds, reset };
}
