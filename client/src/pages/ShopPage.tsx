/*
 * ShopPage (変更16): Supabase shop_items テーブルから動的ロード。
 * - DB の name / description は英語。skin_key をキーに MOCK_SHOP_ITEMS から
 *   日本語名/説明をローカルでルックアップして表示。フォールバックは英語。
 * - レベル制限: unlock_level > currentLevel は silhouette + 「Lv○で解放」
 * - 購入確認ダイアログ
 * - 購入成功キラキラ演出
 * - 既存のタイトル/アイテムタブは MOCK_SHOP_ITEMS から引き続き暫定表示
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { MOCK_SHOP_ITEMS } from '@/lib/mockData';

// skin_key (avatar-id) → 日本語表示名/説明 のローカルマップ。
// DB には英語、UI では日本語を出す i18n 層。
const JP_SKIN_I18N: Record<string, { name: string; description: string }> = (() => {
  const map: Record<string, { name: string; description: string }> = {};
  for (const it of MOCK_SHOP_ITEMS) {
    if (it.category === 'avatar') {
      map[it.id] = { name: it.name, description: it.description };
    }
  }
  return map;
})();

function localizeItem(item: { skin_key: string; name: string; description: string | null }) {
  const jp = JP_SKIN_I18N[item.skin_key];
  return {
    name: jp?.name ?? item.name,
    description: jp?.description ?? item.description ?? '',
  };
}
import { useUserStore } from '@/lib/stores';
import { IMAGES } from '@/lib/constants';
import { calculateLevel } from '@/lib/level';
import {
  fetchShopItems,
  fetchOwnedSkinIds,
  fetchEquippedItemId,
  purchaseSkin,
  setEquippedSkin,
  type ShopItem,
} from '@/lib/shopService';
import { fetchChildStatus } from '@/lib/quizService';
import { toast } from 'sonner';

const shopTabs = [
  { id: 'avatar', label: 'アバター', emoji: '👤', color: '#a855f7' },
  { id: 'title', label: '称号', emoji: '🏷️', color: '#f59e0b' },
  { id: 'item', label: 'アイテム', emoji: '🎒', color: '#22c55e' },
];

const titleEmojis = ['👑', '📚', '🌟'];
const itemEmojis = ['💡', '⏰', '✨'];

export default function ShopPage() {
  const [activeTab, setActiveTab] = useState('avatar');
  const user = useUserStore((s) => s.user);
  const equipAvatar = useUserStore((s) => s.equipAvatar);
  const updateAlt = useUserStore((s) => s.updateAlt);

  // ===== Supabase-backed state =====
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equippedId, setEquippedId] = useState<string | null>(null);
  const [altBalance, setAltBalance] = useState<number>(user.currentAlt);
  const [loading, setLoading] = useState(true);

  // Confirm / sparkle
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [sparkleItemId, setSparkleItemId] = useState<string | null>(null);

  // レベルは totalAlt ベースで算出（既存ロジックと一致）
  const levelInfo = useMemo(() => calculateLevel(user.totalAlt), [user.totalAlt]);
  const currentLevel = levelInfo.level;

  // ===== Load from Supabase =====
  const loadShop = useCallback(async () => {
    setLoading(true);
    const [list, ownedIds, equipped, status] = await Promise.all([
      fetchShopItems(),
      fetchOwnedSkinIds(user.id),
      fetchEquippedItemId(user.id),
      fetchChildStatus(user.id),
    ]);
    setItems(list);
    setOwned(ownedIds);
    setEquippedId(equipped);
    if (status) setAltBalance(status.alt_points);
    else setAltBalance(user.currentAlt);
    // 装備状態をローカルストアにも反映（HomePage/MyPage のアバター描画のため）
    const equippedKey = equipped ? list.find((i) => i.id === equipped)?.skin_key ?? null : null;
    equipAvatar(equippedKey);
    setLoading(false);
  }, [user.id, user.currentAlt, equipAvatar]);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  // ===== Derived =====
  const isOwned = (item: ShopItem) => owned.has(item.id);
  const isEquipped = (item: ShopItem) => equippedId === item.id;
  const isLocked = (item: ShopItem) =>
    item.unlock_level > 0 && currentLevel < item.unlock_level;

  // ===== Purchase flow =====
  const requestPurchase = (item: ShopItem) => {
    if (isOwned(item)) {
      toast.info('すでに所持しています');
      return;
    }
    if (isLocked(item)) {
      toast.error(`Lv${item.unlock_level}で解放されます`);
      return;
    }
    if (altBalance < item.price_alt) {
      toast.error('ALTが足りません');
      return;
    }
    setConfirmItem(item);
  };

  const confirmPurchase = async () => {
    if (!confirmItem) return;
    setPurchasing(true);
    const result = await purchaseSkin({
      childId: user.id,
      item: confirmItem,
      currentLevel,
    });
    setPurchasing(false);
    if (!result.ok) {
      const msg: Record<string, string> = {
        insufficient_alt: 'ALTが足りません',
        already_owned: 'すでに所持しています',
        level_locked: `Lv${confirmItem.unlock_level}で解放されます`,
        condition_unmet: '解放条件を満たしていません',
        db_error: '購入に失敗しました。通信をご確認ください',
        not_active: 'この商品は現在販売停止中です',
      };
      toast.error(msg[result.reason ?? 'db_error'] ?? '購入に失敗しました');
      setConfirmItem(null);
      return;
    }
    // 成功: ローカル反映 + キラキラ演出
    setOwned((prev) => new Set(prev).add(confirmItem.id));
    if (typeof result.newAltBalance === 'number') {
      setAltBalance(result.newAltBalance);
      // ローカルストアにも反映（HomePage 等の currentAlt 表示同期）
      updateAlt(-confirmItem.price_alt);
    }
    setSparkleItemId(confirmItem.id);
    toast.success(`${localizeItem(confirmItem).name} を購入しました！`);
    setConfirmItem(null);
    window.setTimeout(() => setSparkleItemId(null), 1600);
  };

  const handleEquip = async (item: ShopItem) => {
    if (!isOwned(item)) return;
    const next = isEquipped(item) ? null : item.id;
    const ok = await setEquippedSkin(user.id, next);
    if (!ok) {
      toast.error('装備の変更に失敗しました');
      return;
    }
    setEquippedId(next);
    equipAvatar(next ? item.skin_key : null);
    toast.success(next ? 'アバターを装備しました！' : 'アバターを外しました');
  };

  // ===== Legacy title / item tabs (unchanged) =====
  const legacyItems = MOCK_SHOP_ITEMS.filter((it) => it.category === activeTab);
  const activeTabData = shopTabs.find((t) => t.id === activeTab);

  const handlePurchaseLegacy = (it: typeof MOCK_SHOP_ITEMS[0]) => {
    if (it.owned) { toast.info('すでに所持しています'); return; }
    if (user.currentAlt < it.price) { toast.error('ALTが足りません'); return; }
    updateAlt(-it.price);
    toast.success(`${it.name} を購入しました！`);
  };

  return (
    <div className="relative min-h-full">
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.GAME_CARDS_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.2) saturate(0.6)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.7) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', boxShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
            <span className="text-lg">🛒</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>ショップ</h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
              style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
            <span className="text-xs font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>{altBalance.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-1 mb-4 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,215,0,0.12)' }}>
          {shopTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
              style={activeTab === tab.id ? {
                background: `linear-gradient(135deg, ${tab.color}33, ${tab.color}18)`,
                color: tab.color, border: `1px solid ${tab.color}44`, boxShadow: `0 0 8px ${tab.color}15`,
              } : { color: 'rgba(255,255,255,0.35)' }}>
              <span>{tab.emoji}</span>{tab.label}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-xl p-2.5 flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,215,0,0.02))', border: '1px solid rgba(255,215,0,0.12)' }}>
          <span className="text-sm">⭐</span>
          <span className="text-[11px] text-amber-200/50">現在 Lv{currentLevel}・{levelInfo.title}</span>
        </div>

        {/* ========== Avatar Tab (Supabase-backed) ========== */}
        {activeTab === 'avatar' && (
          <>
            {loading ? (
              <div className="text-center text-amber-200/50 text-xs py-12">読み込み中…</div>
            ) : items.length === 0 ? (
              <div className="rounded-xl p-4 text-center text-[11px] text-amber-200/50"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                ショップアイテムが読み込めませんでした。
                <br />管理者は <code>supabase/migrations/0001_shop_tables.sql</code>
                <br />→ <code>0001_shop_seed.sql</code> の順に実行してください。
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {items.map((item, i) => {
                  const tabColor = activeTabData?.color || '#ffd700';
                  const owned_ = isOwned(item);
                  const equipped = isEquipped(item);
                  const locked = isLocked(item);
                  const cannotAfford = !owned_ && !locked && altBalance < item.price_alt;
                  const loc = localizeItem(item);
                  return (
                    <div key={item.id}
                      className="rounded-xl overflow-hidden transition-all duration-200 animate-slide-up card-shine relative"
                      style={{
                        animationDelay: `${i * 50}ms`,
                        background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                        border: equipped ? '1.5px solid rgba(255,215,0,0.5)'
                          : owned_ ? '1.5px solid rgba(34,197,94,0.3)'
                          : locked ? '1.5px solid rgba(120,120,140,0.2)'
                          : `1.5px solid ${tabColor}22`,
                        boxShadow: equipped ? '0 0 16px rgba(255,215,0,0.2), 0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.3)',
                      }}>
                      {/* Sparkle on purchase */}
                      {sparkleItemId === item.id && (
                        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-xl">
                          <div className="absolute inset-0 animate-pulse"
                            style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.4), transparent 70%)' }} />
                          {[...Array(12)].map((_, k) => (
                            <span key={k}
                              className="absolute text-yellow-300 text-lg"
                              style={{
                                left: `${10 + (k * 73) % 80}%`,
                                top: `${10 + (k * 41) % 80}%`,
                                animation: `sparkle-pop 1.4s ease-out ${k * 80}ms both`,
                                textShadow: '0 0 8px rgba(255,215,0,0.8)',
                              }}>✨</span>
                          ))}
                        </div>
                      )}
                      <div className="aspect-square flex items-center justify-center relative overflow-hidden"
                        style={{ background: `radial-gradient(circle, ${tabColor}08, transparent)` }}>
                        <img src={item.image_url} alt={loc.name}
                          className="w-full h-full object-contain transition-all"
                          style={{
                            filter: locked ? 'brightness(0) opacity(0.7)' : 'none',
                          }} />
                        {/* Locked overlay */}
                        {locked && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center"
                            style={{ background: 'rgba(11,17,40,0.55)' }}>
                            <span className="text-2xl mb-1">🔒</span>
                            <span className="text-[10px] font-bold text-amber-200/80">
                              Lv{item.unlock_level}で解放
                            </span>
                          </div>
                        )}
                        {equipped && !locked && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                            style={{ background: 'rgba(255,215,0,0.2)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.4)' }}>装備中</div>
                        )}
                        {owned_ && !equipped && !locked && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                            style={{ background: 'rgba(34,197,94,0.18)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)' }}>購入済み</div>
                        )}
                        {!owned_ && !locked && (
                          <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)' }}>
                            <div className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[6px] font-bold"
                              style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                            <span className="text-[9px] font-bold" style={{ color: '#ffd700' }}>{item.price_alt}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5"
                        style={{ borderTop: `1px solid ${equipped ? 'rgba(255,215,0,0.2)' : owned_ ? 'rgba(34,197,94,0.15)' : tabColor + '15'}` }}>
                        <p className="text-xs font-bold text-amber-100 mb-1 truncate">{loc.name}</p>
                        <p className="text-[10px] text-amber-200/35 mb-2 line-clamp-1">{loc.description}</p>
                        {locked ? (
                          <button disabled
                            className="w-full py-1.5 rounded-lg text-[11px] font-bold opacity-60"
                            style={{ background: 'rgba(120,120,140,0.12)', color: 'rgba(200,200,220,0.5)', border: '1px solid rgba(120,120,140,0.25)' }}>
                            🔒 Lv{item.unlock_level}で解放
                          </button>
                        ) : owned_ ? (
                          <button onClick={() => handleEquip(item)}
                            className="w-full py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                            style={equipped ? {
                              background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.08))',
                              color: '#ffd700',
                              border: '1px solid rgba(255,215,0,0.4)',
                              boxShadow: '0 0 8px rgba(255,215,0,0.15)',
                            } : {
                              background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)',
                            }}>
                            {equipped ? '装備中' : '装備する'}
                          </button>
                        ) : (
                          <button onClick={() => requestPurchase(item)} disabled={cannotAfford}
                            className="w-full py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50"
                            style={{
                              background: `linear-gradient(135deg, ${tabColor}20, ${tabColor}0a)`,
                              color: tabColor, border: `1px solid ${tabColor}35`,
                            }}>
                            {cannotAfford ? 'ALT不足' : '購入する'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ========== Legacy Title / Item tabs ========== */}
        {activeTab !== 'avatar' && (
          <div className="grid grid-cols-2 gap-3">
            {legacyItems.map((it, i) => {
              const emojiList = activeTab === 'title' ? titleEmojis : itemEmojis;
              const emoji = emojiList[i % emojiList.length];
              const tabColor = activeTabData?.color || '#ffd700';
              return (
                <div key={it.id} className="rounded-xl overflow-hidden transition-all duration-200 animate-slide-up card-shine relative"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                    border: it.owned ? '1.5px solid rgba(34,197,94,0.3)' : `1.5px solid ${tabColor}22`,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                  }}>
                  <div className="aspect-square flex items-center justify-center relative"
                    style={{ background: `radial-gradient(circle, ${tabColor}08, transparent)` }}>
                    <span className="text-4xl">{emoji}</span>
                    {it.owned && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>所持中</div>
                    )}
                    {!it.owned && (
                      <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)' }}>
                        <div className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[6px] font-bold"
                          style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                        <span className="text-[9px] font-bold" style={{ color: '#ffd700' }}>{it.price}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5" style={{ borderTop: `1px solid ${it.owned ? 'rgba(34,197,94,0.15)' : tabColor + '15'}` }}>
                    <p className="text-xs font-bold text-amber-100 mb-1 truncate">{it.name}</p>
                    <p className="text-[10px] text-amber-200/35 mb-2 line-clamp-1">{it.description}</p>
                    <button onClick={() => handlePurchaseLegacy(it)} disabled={it.owned}
                      className="w-full py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50"
                      style={it.owned ? {
                        background: 'rgba(34,197,94,0.08)', color: 'rgba(34,197,94,0.5)', border: '1px solid rgba(34,197,94,0.15)',
                      } : {
                        background: `linear-gradient(135deg, ${tabColor}20, ${tabColor}0a)`, color: tabColor, border: `1px solid ${tabColor}35`,
                      }}>
                      {it.owned ? '所持済み' : '購入する'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== Purchase Confirmation Dialog ========== */}
      {confirmItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => !purchasing && setConfirmItem(null)}>
          <div className="w-full max-w-xs rounded-2xl p-4 relative animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '1.5px solid rgba(255,215,0,0.35)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,215,0,0.15)',
            }}>
            <h3 className="text-center text-sm font-bold mb-3" style={{ color: '#ffd700' }}>購入確認</h3>
            <div className="aspect-square w-32 mx-auto mb-3 rounded-xl overflow-hidden"
              style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.15), transparent)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <img src={confirmItem.image_url} alt={localizeItem(confirmItem).name} className="w-full h-full object-contain" />
            </div>
            <p className="text-center text-base font-bold text-amber-100 mb-1">{localizeItem(confirmItem).name}</p>
            <p className="text-center text-[10px] text-amber-200/50 mb-3 px-2">{localizeItem(confirmItem).description}</p>
            <div className="flex items-center justify-center gap-1 mb-4">
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
              <span className="text-lg font-bold" style={{ color: '#ffd700' }}>{confirmItem.price_alt}</span>
              <span className="text-[10px] text-amber-200/40 ml-2">(残高 {altBalance - confirmItem.price_alt})</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmItem(null)} disabled={purchasing}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>
                キャンセル
              </button>
              <button onClick={confirmPurchase} disabled={purchasing}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                  color: '#0b1128', border: '1px solid rgba(255,215,0,0.6)',
                  boxShadow: '0 0 16px rgba(255,215,0,0.4)',
                }}>
                {purchasing ? '購入中…' : '購入する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sparkle-pop {
          0% { opacity: 0; transform: scale(0.4) rotate(0deg); }
          40% { opacity: 1; transform: scale(1.2) rotate(180deg); }
          100% { opacity: 0; transform: scale(0.6) rotate(360deg) translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
