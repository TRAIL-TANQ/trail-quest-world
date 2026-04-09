/*
 * PageShell: Mobile-first layout wrapper
 * Dark navy background, max 430px, RPG theme
 * Includes AltEarnEffect global overlay
 */
import type { ReactNode } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import AltEarnEffect from '@/components/effects/AltEarnEffect';

export default function PageShell({ children }: { children: ReactNode }) {
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
