/*
 * PvPBattlePage: 2人対戦バトル画面エントリ
 *
 * sessionStorage から PvP セッションを読み込み、そのまま KnowledgeChallenger
 * に props として渡す。KnowledgeChallenger 側で `pvpSession` が存在する時は
 * 2人対戦モードとして動作する（AI自動処理をP2手動入力に差し替え）。
 *
 * (A) フェーズでは props を通すだけで、実際の分岐は (B)(C)(D) で追加する。
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { loadPvPSession } from '@/lib/pvpSession';
import type { PvPSession } from '@/lib/pvpSession';
import KnowledgeChallenger from './KnowledgeChallenger';

export default function PvPBattlePage() {
  const [, navigate] = useLocation();
  const [session, setSession] = useState<PvPSession | null>(null);

  useEffect(() => {
    const s = loadPvPSession();
    if (!s) {
      navigate('/games/knowledge-challenger/pvp');
      return;
    }
    setSession(s);
  }, [navigate]);

  if (!session) return null;

  return <KnowledgeChallenger pvpSession={session} />;
}
