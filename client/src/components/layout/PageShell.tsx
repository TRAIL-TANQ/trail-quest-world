/*
 * PageShell: Mobile-first layout wrapper
 * Dark navy background, max 430px, RPG theme
 * Includes AltEarnEffect and LevelUpModal global overlays.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import AltEarnEffect from '@/components/effects/AltEarnEffect';
import LevelUpModal from '@/components/effects/LevelUpModal';
import { useUserStore } from '@/lib/stores';
import { fetchEquippedItemId, fetchShopItems } from '@/lib/shopService';
import { calculateLevel } from '@/lib/level';

export default function PageShell({ children }: { children: ReactNode }) {
  const userId = useUserStore((s) => s.user.id);
  const equipAvatar = useUserStore((s) => s.equipAvatar);
  const totalAlt = useUserStore((s) => s.user.totalAlt);

  // ===== Level-up detection (変更15) =====
  // totalAlt 変動時に前後のレベルを比較し、上がった瞬間にモーダルを出す。
  // 初回マウント時の level は比較用ベースラインとして記録し、演出は発火しない。
  const prevLevelRef = useRef<number | null>(null);
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string } | null>(null);

  useEffect(() => {
    const info = calculateLevel(totalAlt);
    const prev = prevLevelRef.current;
    if (prev === null) {
      prevLevelRef.current = info.level;
      return;
    }
    if (info.level > prev) {
      setLevelUpData({ level: info.level, title: info.title });
    }
    prevLevelRef.current = info.level;
  }, [totalAlt]);

  // ===== Equipped skin sync (変更16) =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const equippedId = await fetchEquippedItemId(userId);
      if (!equippedId || cancelled) return;
      const items = await fetchShopItems();
      if (cancelled) return;
      const key = items.find((i) => i.id === equippedId)?.skin_key ?? null;
      if (key) equipAvatar(key);
    })();
    return () => { cancelled = true; };
  }, [userId, equipAvatar]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <div className="w-full max-w-[430px] min-h-screen flex flex-col relative"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #0e142d 100%)' }}
      >
        <Header />
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>
        <BottomNav />
        <AltEarnEffect />
        <LevelUpModal
          isOpen={levelUpData !== null}
          onClose={() => setLevelUpData(null)}
          newLevel={levelUpData?.level ?? 1}
          title={levelUpData?.title ?? ''}
        />
      </div>
    </div>
  );
}
