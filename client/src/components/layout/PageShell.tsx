/*
 * PageShell: Header + Content + BottomNav wrapper
 * Dark navy background, gold accents, mobile-first (max-width 430px centered)
 */
import { ReactNode } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';

interface PageShellProps {
  children: ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <div className="w-full max-w-[430px] min-h-screen flex flex-col relative">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
