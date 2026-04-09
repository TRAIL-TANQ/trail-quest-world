import { ReactNode } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import AltEarnEffect from '@/components/effects/AltEarnEffect';

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center" style={{ background: '#0F172A' }}>
      <div className="w-full max-w-[430px] relative flex flex-col min-h-screen" style={{ background: '#0F172A' }}>
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
