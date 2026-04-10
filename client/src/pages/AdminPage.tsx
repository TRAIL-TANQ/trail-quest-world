/*
 * AdminPage: Admin dashboard with avatar drag-and-drop reorder
 * Dark navy + gold theme consistent with the rest of the app
 * Uses @dnd-kit for accessible, performant drag-and-drop
 */
import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useShopOrderStore, defaultAvatarOrder } from '@/lib/shopOrderStore';
import { AVATAR_ITEMS, IMAGES } from '@/lib/constants';
import { MOCK_SHOP_ITEMS } from '@/lib/mockData';
import { toast } from 'sonner';

// Sortable avatar row component
function SortableAvatarRow({ id, index, avatar, avatarImages }: {
  id: string;
  index: number;
  avatar: { id: string; name: string; price: number; description: string };
  avatarImages: { full: string; thumbnail?: string } | undefined;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
      {...attributes}
      {...listeners}
    >
      {/* Drag handle + index */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="cursor-grab active:cursor-grabbing text-amber-200/30 hover:text-amber-200/60 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
        <span className="text-[11px] font-bold w-6 text-center"
          style={{ color: 'rgba(255,215,0,0.4)' }}>
          {index + 1}
        </span>
      </div>

      {/* Avatar thumbnail */}
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.08), transparent)',
          border: '1px solid rgba(255,215,0,0.12)',
        }}>
        {avatarImages ? (
          <img src={avatarImages.full} alt={avatar.name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-lg">👤</span>
        )}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-100 truncate">{avatar.name}</p>
        <p className="text-[10px] text-amber-200/35 truncate">{avatar.description}</p>
      </div>

      {/* Price */}
      <div className="flex items-center gap-0.5 px-2 py-1 rounded shrink-0"
        style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)' }}>
        <div className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[6px] font-bold"
          style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
        <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>{avatar.price}</span>
      </div>
    </div>
  );
}

// Overlay item (shown while dragging)
function DragOverlayItem({ avatar, avatarImages }: {
  avatar: { id: string; name: string; price: number; description: string };
  avatarImages: { full: string; thumbnail?: string } | undefined;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
        border: '1.5px solid rgba(255,215,0,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(255,215,0,0.15)',
      }}>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-amber-200/60">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
        <span className="text-[11px] font-bold w-6 text-center" style={{ color: 'rgba(255,215,0,0.4)' }}>⋮</span>
      </div>
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.08), transparent)',
          border: '1px solid rgba(255,215,0,0.2)',
        }}>
        {avatarImages ? (
          <img src={avatarImages.full} alt={avatar.name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-lg">👤</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-100 truncate">{avatar.name}</p>
        <p className="text-[10px] text-amber-200/35 truncate">{avatar.description}</p>
      </div>
      <div className="flex items-center gap-0.5 px-2 py-1 rounded shrink-0"
        style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)' }}>
        <div className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[6px] font-bold"
          style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
        <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>{avatar.price}</span>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const avatarOrder = useShopOrderStore((s) => s.avatarOrder);
  const setAvatarOrder = useShopOrderStore((s) => s.setAvatarOrder);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Build avatar lookup map
  const avatarMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; price: number; description: string }>();
    MOCK_SHOP_ITEMS.filter((item) => item.category === 'avatar').forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, []);

  // Get ordered avatars
  const orderedAvatars = useMemo(() => {
    return avatarOrder
      .map((id) => avatarMap.get(id))
      .filter((item): item is { id: string; name: string; price: number; description: string } => item !== undefined);
  }, [avatarOrder, avatarMap]);

  // Active dragging item
  const activeAvatar = activeId ? avatarMap.get(activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = avatarOrder.indexOf(active.id as string);
    const newIndex = avatarOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(avatarOrder, oldIndex, newIndex);
    setAvatarOrder(newOrder);
    setHasChanges(true);
  };

  const handleSave = () => {
    // persist middleware auto-saves to localStorage on every setAvatarOrder call
    // This button confirms to the user that the order is saved
    setHasChanges(false);
    toast.success('並び順を保存しました！ショップに即座に反映されます。');
  };

  const handleReset = () => {
    setAvatarOrder(defaultAvatarOrder);
    setHasChanges(false);
    toast.info('並び順をデフォルトに戻しました');
  };

  return (
    <div className="relative min-h-full">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.GAME_CARDS_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.15) saturate(0.5)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.8) 0%, rgba(11,17,40,0.97) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 10px rgba(245,158,11,0.3)' }}>
            <span className="text-lg">⚙️</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>管理者ダッシュボード</h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
        </div>

        {/* Section: Avatar Order */}
        <div className="rounded-xl overflow-hidden mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: '1px solid rgba(255,215,0,0.15)',
          }}>
          {/* Section header */}
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,215,0,0.1)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">🔀</span>
              <h2 className="text-sm font-bold text-amber-100">アバター並び順</h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}>
                {orderedAvatars.length}体
              </span>
            </div>
            {hasChanges && (
              <span className="text-[10px] px-1.5 py-0.5 rounded animate-pulse"
                style={{ background: 'rgba(255,215,0,0.1)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)' }}>
                未保存の変更あり
              </span>
            )}
          </div>

          {/* Instructions */}
          <div className="px-4 py-2" style={{ background: 'rgba(255,215,0,0.03)' }}>
            <p className="text-[10px] text-amber-200/40">
              ドラッグ＆ドロップでアバターの表示順を変更できます。変更後「保存」を押すとショップに即座に反映されます。
            </p>
          </div>

          {/* Sortable list */}
          <div className="py-1 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,215,0,0.15) transparent' }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={avatarOrder} strategy={verticalListSortingStrategy}>
                {orderedAvatars.map((avatar, index) => (
                  <SortableAvatarRow
                    key={avatar.id}
                    id={avatar.id}
                    index={index}
                    avatar={avatar}
                    avatarImages={AVATAR_ITEMS[avatar.id]}
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {activeAvatar ? (
                  <DragOverlayItem
                    avatar={activeAvatar}
                    avatarImages={AVATAR_ITEMS[activeAvatar.id]}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>

        {/* Action buttons - fixed at bottom */}
        <div className="fixed bottom-16 left-0 right-0 z-20 px-4 pb-2">
          <div className="max-w-lg mx-auto flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
              リセット
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex-[2] py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: hasChanges
                  ? 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,215,0,0.1))'
                  : 'rgba(255,215,0,0.05)',
                color: '#ffd700',
                border: hasChanges
                  ? '1px solid rgba(255,215,0,0.5)'
                  : '1px solid rgba(255,215,0,0.15)',
                boxShadow: hasChanges ? '0 0 12px rgba(255,215,0,0.15)' : 'none',
              }}>
              {hasChanges ? '💾 保存してショップに反映' : '変更なし'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
