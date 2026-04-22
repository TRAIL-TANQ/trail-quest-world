/*
 * MarketPage (Commit G)
 *
 * マーケット独立タブの親ページ。
 * - 下ナビ「📈 マーケット」からアクセス (ルート /market)
 * - 3 サブタブ: 直販 / 売却 / 市場情報
 * - 既存の ShopBuyTabPage / ShopSellTabPage / ShopMarketInfoTabPage を
 *   そのままサブコンポーネントとして使い回す (Phase 1 の実装を温存)
 *
 * altBalance の扱い:
 *   ShopPage と同じパターンで、マウント時に fetchChildStatus で DB 同期し
 *   直販/売却タブへ渡す。Phase 2 で useAltBalance hook に共通化予定 (FOLLOW_UPS)。
 */
import { useEffect, useState } from 'react';

import { useUserStore } from '@/lib/stores';
import { fetchChildStatus } from '@/lib/quizService';
import { IMAGES } from '@/lib/constants';

import ShopBuyTabPage from '@/pages/ShopBuyTabPage';
import ShopSellTabPage from '@/pages/ShopSellTabPage';
import ShopMarketInfoTabPage from '@/pages/ShopMarketInfoTabPage';

const marketTabs = [
  { id: 'buy',  label: '直販',     emoji: '🏪', color: '#06b6d4' },
  { id: 'sell', label: '売却',     emoji: '💰', color: '#10b981' },
  { id: 'info', label: '市場情報', emoji: '📊', color: '#f59e0b' },
] as const;

type MarketTabId = (typeof marketTabs)[number]['id'];

export default function MarketPage() {
  const user = useUserStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<MarketTabId>('buy');
  const [altBalance, setAltBalance] = useState<number>(user.currentAlt);

  // マウント時に DB 同期。HomePage の store 同期経路と独立に再取得しておく
  // (市場機能は ALT 残高の正確性が重要なため二重保険)。
  useEffect(() => {
    let cancelled = false;
    fetchChildStatus(user.id).then((status) => {
      if (cancelled) return;
      if (status) setAltBalance(status.alt_points);
    }).catch(() => { /* offline: fallback to store value */ });
    return () => { cancelled = true; };
  }, [user.id]);

  return (
    <div className="relative min-h-full">
      {/* Background (ShopPage と統一感) */}
      <div className="absolute inset-0 z-0">
        <img
          src={IMAGES.GAME_CARDS_BG}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.2) saturate(0.6)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(11,17,40,0.7) 0%, rgba(11,17,40,0.95) 100%)',
          }}
        />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: '0 0 10px rgba(245,158,11,0.3)',
            }}
          >
            <span className="text-lg">📈</span>
          </div>
          <h1
            className="text-lg font-bold"
            style={{ color: '#f59e0b', textShadow: '0 0 10px rgba(245,158,11,0.2)' }}
          >
            マーケット
          </h1>
          <div className="ml-auto text-xs" style={{ color: '#fcd34d' }}>
            <span className="font-black text-sm">{altBalance.toLocaleString()}</span> ALT
          </div>
        </div>

        {/* Sub tabs */}
        <div className="flex gap-2 mb-4">
          {marketTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="tappable flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${tab.color}33, ${tab.color}11)`
                    : 'rgba(255,255,255,0.04)',
                  color: isActive ? tab.color : 'rgba(255,255,255,0.5)',
                  border: isActive
                    ? `1.5px solid ${tab.color}88`
                    : '1.5px solid rgba(255,255,255,0.1)',
                  boxShadow: isActive ? `0 0 10px ${tab.color}33` : 'none',
                }}
              >
                <span className="mr-1">{tab.emoji}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'buy' && (
          <ShopBuyTabPage altBalance={altBalance} onAltBalanceChange={setAltBalance} />
        )}
        {activeTab === 'sell' && (
          <ShopSellTabPage onAltBalanceChange={setAltBalance} />
        )}
        {activeTab === 'info' && <ShopMarketInfoTabPage />}
      </div>
    </div>
  );
}
