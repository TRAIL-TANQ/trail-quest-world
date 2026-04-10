import { create } from 'zustand';
import { MOCK_SHOP_ITEMS } from './mockData';
import type { ShopItem } from './types';

interface ShopOrderState {
  avatarOrder: string[]; // ordered array of avatar item IDs
  getOrderedAvatars: () => ShopItem[];
  reorderAvatars: (fromIndex: number, toIndex: number) => void;
  setAvatarOrder: (order: string[]) => void;
}

// Initialize with the default order from MOCK_SHOP_ITEMS
const defaultAvatarOrder = MOCK_SHOP_ITEMS
  .filter((item) => item.category === 'avatar')
  .map((item) => item.id);

export const useShopOrderStore = create<ShopOrderState>((set, get) => ({
  avatarOrder: defaultAvatarOrder,

  getOrderedAvatars: () => {
    const { avatarOrder } = get();
    const avatarMap = new Map(
      MOCK_SHOP_ITEMS.filter((item) => item.category === 'avatar').map((item) => [item.id, item])
    );
    return avatarOrder
      .map((id) => avatarMap.get(id))
      .filter((item): item is ShopItem => item !== undefined);
  },

  reorderAvatars: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newOrder = [...state.avatarOrder];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      return { avatarOrder: newOrder };
    });
  },

  setAvatarOrder: (order: string[]) => set({ avatarOrder: order }),
}));
