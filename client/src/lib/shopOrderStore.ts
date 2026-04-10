import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MOCK_SHOP_ITEMS } from './mockData';
import type { ShopItem } from './types';

interface ShopOrderState {
  avatarOrder: string[];
  setAvatarOrder: (order: string[]) => void;
}

// Default order from MOCK_SHOP_ITEMS
const defaultAvatarOrder = MOCK_SHOP_ITEMS
  .filter((item) => item.category === 'avatar')
  .map((item) => item.id);

export const useShopOrderStore = create<ShopOrderState>()(
  persist(
    (set) => ({
      avatarOrder: defaultAvatarOrder,
      setAvatarOrder: (order: string[]) => set({ avatarOrder: order }),
    }),
    {
      name: 'shop-avatar-order',
    }
  )
);

// Helper: get ordered avatar ShopItems from current store state
// Use this outside of React or in derived computations
export function getOrderedAvatarItems(avatarOrder: string[]): ShopItem[] {
  const avatarMap = new Map(
    MOCK_SHOP_ITEMS.filter((item) => item.category === 'avatar').map((item) => [item.id, item])
  );
  return avatarOrder
    .map((id) => avatarMap.get(id))
    .filter((item): item is ShopItem => item !== undefined);
}

// Default order export for reset functionality
export { defaultAvatarOrder };
