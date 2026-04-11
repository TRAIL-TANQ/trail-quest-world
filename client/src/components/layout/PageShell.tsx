/*
 * PageShell: Mobile-first layout wrapper
 * Dark navy background, max 430px, RPG theme
 * Includes AltEarnEffect global overlay
 */
import { useEffect, type ReactNode } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import AltEarnEffect from '@/components/effects/AltEarnEffect';
import { useUserStore } from '@/lib/stores';
import { fetchEquippedItemId, fetchShopItems } from '@/lib/shopService';

export default function PageShell({ children }: { children: ReactNode }) {
  const userId = useUserStore((s) => s.user.id);
  const equipAvatar = useUserStore((s) => s.equipAvatar);

  // アプリ起動時に Supabase から装備中スキンを読み込んで local store に反映。
  // HomePage / MyPage のアバター描画が Supabase 側の状態と一致するようにする。
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
      </div>
    </div>
  );
}
