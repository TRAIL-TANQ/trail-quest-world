/*
 * ShopPage: Avatar/Title/Item shop tabs
 * Fantasy merchant shop style with gold pricing, ornate item cards
 */
import { useState } from 'react';
import { MOCK_SHOP_ITEMS } from '@/lib/mockData';
import { useUserStore } from '@/lib/stores';
import { IMAGES } from '@/lib/constants';
import { toast } from 'sonner';

const shopTabs = [
  { id: 'avatar', label: 'アバター', emoji: '👤', color: '#a855f7' },
  { id: 'title', label: '称号', emoji: '🏷️', color: '#f59e0b' },
  { id: 'item', label: 'アイテム', emoji: '🎒', color: '#22c55e' },
];

const avatarEmojis = ['🧙‍♂️', '⚔️', '🥷', '🐉', '🧚', '🗡️'];
const titleEmojis = ['👑', '📚', '🌟'];
const itemEmojis = ['💡', '⏰', '✨'];

export default function ShopPage() {
  const [activeTab, setActiveTab] = useState('avatar');
  const user = useUserStore((s) => s.user);
  const updateAlt = useUserStore((s) => s.updateAlt);

  const filteredItems = MOCK_SHOP_ITEMS.filter((item) => item.category === activeTab);
  const activeTabData = shopTabs.find(t => t.id === activeTab);

  const handlePurchase = (item: typeof MOCK_SHOP_ITEMS[0]) => {
    if (item.owned) {
      toast.info('すでに所持しています');
      return;
    }
    if (user.currentAlt < item.price) {
      toast.error('ALTが足りません');
      return;
    }
    updateAlt(-item.price);
    toast.success(`${item.name} を購入しました！`);
  };

  return (
    <div className="relative min-h-full">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.GAME_CARDS_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.2) saturate(0.6)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.7) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #ffd700, #f0a500)',
              boxShadow: '0 0 10px rgba(255,215,0,0.3)',
            }}
          >
            <span className="text-lg">🛒</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>
            ショップ
          </h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
          {/* ALT balance */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}
          >
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
              style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}
            >A</div>
            <span className="text-xs font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>
              {user.currentAlt.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,215,0,0.12)' }}
        >
          {shopTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
              style={activeTab === tab.id ? {
                background: `linear-gradient(135deg, ${tab.color}33, ${tab.color}18)`,
                color: tab.color,
                border: `1px solid ${tab.color}44`,
                boxShadow: `0 0 8px ${tab.color}15`,
              } : {
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Login streak bonus */}
        <div className="mb-4 rounded-xl p-2.5 flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,215,0,0.02))',
            border: '1px solid rgba(255,215,0,0.12)',
          }}
        >
          <span className="text-sm">🔥</span>
          <span className="text-[11px] text-amber-200/50">
            {user.streakDays}日連続ログイン中！ショップ割引は近日実装予定
          </span>
        </div>

        {/* Shop Grid */}
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((item, i) => {
            const emojiList = activeTab === 'avatar' ? avatarEmojis : activeTab === 'title' ? titleEmojis : itemEmojis;
            const emoji = emojiList[i % emojiList.length];
            const tabColor = activeTabData?.color || '#ffd700';

            return (
              <div
                key={item.id}
                className="rounded-xl overflow-hidden transition-all duration-200 animate-slide-up card-shine relative"
                style={{
                  animationDelay: `${i * 60}ms`,
                  background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                  border: item.owned ? '1.5px solid rgba(34,197,94,0.3)' : `1.5px solid ${tabColor}22`,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                }}
              >
                {/* Item image */}
                <div className="aspect-square flex items-center justify-center relative"
                  style={{
                    background: `radial-gradient(circle, ${tabColor}08, transparent)`,
                  }}
                >
                  <span className="text-4xl">{emoji}</span>
                  {item.owned && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                      style={{
                        background: 'rgba(34,197,94,0.15)',
                        color: '#22c55e',
                        border: '1px solid rgba(34,197,94,0.25)',
                      }}
                    >
                      所持中
                    </div>
                  )}
                  {/* Price tag */}
                  {!item.owned && (
                    <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded"
                      style={{
                        background: 'rgba(255,215,0,0.1)',
                        border: '1px solid rgba(255,215,0,0.2)',
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[6px] font-bold"
                        style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}
                      >A</div>
                      <span className="text-[9px] font-bold" style={{ color: '#ffd700' }}>{item.price}</span>
                    </div>
                  )}
                </div>

                {/* Item info */}
                <div className="p-2.5"
                  style={{ borderTop: `1px solid ${item.owned ? 'rgba(34,197,94,0.15)' : tabColor + '15'}` }}
                >
                  <p className="text-xs font-bold text-amber-100 mb-1 truncate">{item.name}</p>
                  <p className="text-[10px] text-amber-200/35 mb-2 line-clamp-1">{item.description}</p>

                  <button
                    onClick={() => handlePurchase(item)}
                    disabled={item.owned}
                    className="w-full py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50"
                    style={item.owned ? {
                      background: 'rgba(34,197,94,0.08)',
                      color: 'rgba(34,197,94,0.5)',
                      border: '1px solid rgba(34,197,94,0.15)',
                    } : {
                      background: `linear-gradient(135deg, ${tabColor}20, ${tabColor}0a)`,
                      color: tabColor,
                      border: `1px solid ${tabColor}35`,
                    }}
                  >
                    {item.owned ? '所持済み' : '購入する'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
