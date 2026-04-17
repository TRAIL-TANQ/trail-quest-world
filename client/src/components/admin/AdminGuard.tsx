/**
 * AdminGuard — 管理者（isAdmin=true）以外をブロックしてホームに追い返す。
 *
 * 一般生徒が /admin/xxx を直打ちした場合もこのガードでリダイレクトされる。
 * ガードが true を返すのは PIN 9999 でログイン済みのユーザーのみ。
 */
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { isAdmin } from '@/lib/auth';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAdmin()) navigate('/');
  }, [navigate]);

  if (!isAdmin()) {
    return null;
  }
  return <>{children}</>;
}
