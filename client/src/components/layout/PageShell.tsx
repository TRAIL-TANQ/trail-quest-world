/*
 * PageShell: Mobile-first layout wrapper
 * Dark navy background, max 430px, RPG theme
 * Includes AltEarnEffect and LevelUpModal global overlays.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import Header from './Header';
import BottomNav from './BottomNav';
import AltEarnEffect from '@/components/effects/AltEarnEffect';
import LevelUpModal from '@/components/effects/LevelUpModal';
import { useUserStore } from '@/lib/stores';
import { fetchEquippedItemId, fetchShopItems } from '@/lib/shopService';
import { fetchUserProfile } from '@/lib/userProfileService';
import { calculateLevel } from '@/lib/level';
import { isGuest } from '@/lib/auth';

export default function PageShell({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const userId = useUserStore((s) => s.user.id);
  const equipAvatar = useUserStore((s) => s.equipAvatar);
  const setNickname = useUserStore((s) => s.setNickname);
  const setAvatarType = useUserStore((s) => s.setAvatarType);
  const initialNickname = useUserStore((s) => s.user.nickname);
  const initialAvatarType = useUserStore((s) => s.user.avatarType);
  const totalAlt = useUserStore((s) => s.user.totalAlt);

  // 未ログイン（ゲスト）は /login へ誘導。
  // auth.ts の isGuest は localStorage を直接見るので、リロード後も安定して動く。
  useEffect(() => {
    if (isGuest()) {
      navigate('/login');
    }
  }, [navigate]);

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

  // ===== User profile sync (変更17) =====
  // 起動時に user_profile を読み込んで zustand ストアに反映。
  // 既存のローカル値をフォールバックに渡すので、新規ユーザーは MOCK_USER の値で作成される。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await fetchUserProfile(userId, {
        nickname: initialNickname,
        avatarType: initialAvatarType,
      });
      if (cancelled) return;
      if (profile.nickname && profile.nickname !== initialNickname) setNickname(profile.nickname);
      if (profile.avatar_type && profile.avatar_type !== initialAvatarType) setAvatarType(profile.avatar_type);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
