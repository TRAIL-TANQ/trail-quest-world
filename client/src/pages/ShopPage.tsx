/*
 * ShopPage: Dark UI × Neon - Avatar/Title/Item tabs with shop items
 */
import { useState } from 'react';
import { MOCK_SHOP_ITEMS } from '@/lib/mockData';
import { useUserStore } from '@/lib/stores';
import { Coins, Check } from 'lucide-react';
import { toast } from 'sonner';

const SHOP_TABS = [
  { id: 'avatar', label: 'アバター', emoji: '👤' },
  { id: 'title', label: '称号', emoji: '🏷️' },
  { id: 'item', label: 'アイテム', emoji: '🎁' },
];

export default function ShopPage() {
  const [activeTab, setActiveTab] = useState('avatar');
  const user = useUserStore((s) => s.user);
  const updateAlt = useUserStore((s) => s.updateAlt);

  const filteredItems = MOCK_SHOP_ITEMS.filter((item) => item.category === activeTab);

  const handlePurchase = (item: typeof MOCK_SHOP_ITEMS[0]) => {
    if (item.owned) { toast.info('すでに所持しています'); return; }
    if (user.currentAlt < item.price) { toast.error('ALTが足りません'); return; }
    updateAlt(-item.price);
    toast.success(`${item.name} を購入しました！`);
  };

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold" style={{ color: '#F8FAFC' }}>ショップ</h1>
        <div className="flex items-center gap-1 px-3 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Coins className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
          <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>{user.currentAlt.toLocaleString()}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {SHOP_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
              style={{
                background: isActive ? '#4F46E5' : 'transparent',
                color: isActive ? '#F8FAFC' : '#94A3B8',
                boxShadow: isActive ? '0 0 12px rgba(79,70,229,0.3)' : 'none',
              }}
            >
              <span>{tab.emoji}</span> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Shop Items Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredItems.map((item, i) => (
          <div
            key={item.id}
            className="rounded-xl overflow-hidden"
            style={{
              background: '#1E293B',
              border: item.owned ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.06)',
              animation: `slide-up 0.3s ${i * 50}ms ease-out both`,
            }}
          >
            <div className="h-28 flex items-center justify-center relative" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-4xl">{activeTab === 'avatar' ? '🧑‍🎓' : activeTab === 'title' ? '🏷️' : '🎁'}</span>
              {item.owned && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#10B981' }}>
                  <Check className="w-3 h-3" style={{ color: '#F8FAFC' }} />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-xs font-bold mb-1 truncate" style={{ color: '#F8FAFC' }}>{item.name}</p>
              <p className="text-[10px] mb-2 line-clamp-2" style={{ color: '#94A3B8' }}>{item.description}</p>
              <button
                onClick={() => handlePurchase(item)}
                disabled={item.owned}
                className="w-full py-2 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                style={item.owned ? {
                  background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)',
                } : {
                  background: 'linear-gradient(135deg, #4F46E5, #6366F1)', color: '#F8FAFC', boxShadow: '0 2px 8px rgba(79,70,229,0.3)',
                }}
              >
                {item.owned ? (<><Check className="w-3 h-3" /> 所持済み</>) : (<><Coins className="w-3 h-3" style={{ color: '#F59E0B' }} /> <span style={{ color: '#F59E0B' }}>{item.price}</span> ALT</>)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
