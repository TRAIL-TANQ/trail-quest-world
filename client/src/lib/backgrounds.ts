/**
 * Shop 背景アイテム（14枚）
 * - ダーク系8枚 + 明るめ系6枚
 * - localStorage で所持・装備管理（MVP）
 */
import { getAuth } from './auth';

export interface BgItem {
  key: string;
  name: string;
  price: number;
  image: string;
  /** 画像が未到着の場合のフォールバックグラデーション */
  fallbackGradient: string;
  category: 'dark' | 'bright';
}

export const BACKGROUNDS: BgItem[] = [
  // ダーク系（8）
  { key: 'ruins',    name: '古代遺跡',    price: 0,    image: '/images/bg/bg-ruins.png',    fallbackGradient: 'linear-gradient(180deg, #3a2e20, #1a1410)', category: 'dark' },
  { key: 'volcano',  name: '火山',        price: 300,  image: '/images/bg/bg-volcano.png',  fallbackGradient: 'linear-gradient(180deg, #5a1a0a, #2a0a05)', category: 'dark' },
  { key: 'ocean',    name: '深海',        price: 300,  image: '/images/bg/bg-ocean.png',    fallbackGradient: 'linear-gradient(180deg, #0a2a5a, #050a2a)', category: 'dark' },
  { key: 'forest',   name: '魔法の森',    price: 500,  image: '/images/bg/bg-forest.png',   fallbackGradient: 'linear-gradient(180deg, #1a3a1a, #0a1a0a)', category: 'dark' },
  { key: 'castle',   name: '闇の城',      price: 500,  image: '/images/bg/bg-castle.png',   fallbackGradient: 'linear-gradient(180deg, #2a1a3a, #0a0515)', category: 'dark' },
  { key: 'space',    name: '宇宙',        price: 800,  image: '/images/bg/bg-space.png',    fallbackGradient: 'linear-gradient(180deg, #0a0a2a, #000010)', category: 'dark' },
  { key: 'dragon',   name: '竜の巣',      price: 800,  image: '/images/bg/bg-dragon.png',   fallbackGradient: 'linear-gradient(180deg, #4a1a1a, #1a0505)', category: 'dark' },
  { key: 'heaven',   name: '天空の神殿',  price: 1000, image: '/images/bg/bg-heaven.png',   fallbackGradient: 'linear-gradient(180deg, #3a3a5a, #1a1a3a)', category: 'dark' },
  // 明るめ系（6）
  { key: 'sakura',   name: '桜の庭園',          price: 500,  image: '/images/bg/bg-sakura.png',   fallbackGradient: 'linear-gradient(180deg, #ffc0cb, #f5a6b5)', category: 'bright' },
  { key: 'sunset',   name: '夕焼けの草原',      price: 300,  image: '/images/bg/bg-sunset.png',   fallbackGradient: 'linear-gradient(180deg, #ff9a5a, #ff6b3a)', category: 'bright' },
  { key: 'snow',     name: '雪の王国',          price: 500,  image: '/images/bg/bg-snow.png',     fallbackGradient: 'linear-gradient(180deg, #e0f0ff, #b0d0ff)', category: 'bright' },
  { key: 'tropical', name: 'トロピカルビーチ',  price: 300,  image: '/images/bg/bg-tropical.png', fallbackGradient: 'linear-gradient(180deg, #5ad0e0, #30a0c0)', category: 'bright' },
  { key: 'sky',      name: '天空の浮島',        price: 800,  image: '/images/bg/bg-sky.png',      fallbackGradient: 'linear-gradient(180deg, #87ceeb, #5ab0e5)', category: 'bright' },
  { key: 'rainbow',  name: '虹の架け橋',        price: 1000, image: '/images/bg/bg-rainbow.png',  fallbackGradient: 'linear-gradient(180deg, #ff9a9e, #fad0c4, #a1c4fd)', category: 'bright' },
];

// ===== localStorage I/O =====

const LS_OWNED = 'kc_bg_owned_';
const LS_EQUIPPED = 'kc_bg_equipped_';

function userId(): string {
  return getAuth().childId ?? 'guest';
}

export function loadOwnedBgs(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_OWNED + userId());
    const arr = raw ? JSON.parse(raw) : [];
    const set = new Set<string>(Array.isArray(arr) ? arr : []);
    set.add('ruins'); // デフォルト所持（無料）
    return set;
  } catch {
    return new Set(['ruins']);
  }
}

export function saveOwnedBgs(owned: Set<string>): void {
  try {
    localStorage.setItem(LS_OWNED + userId(), JSON.stringify(Array.from(owned)));
  } catch { /* ignore */ }
}

export function loadEquippedBg(): string {
  try {
    return localStorage.getItem(LS_EQUIPPED + userId()) ?? 'ruins';
  } catch {
    return 'ruins';
  }
}

export function saveEquippedBg(key: string): void {
  try {
    localStorage.setItem(LS_EQUIPPED + userId(), key);
  } catch { /* ignore */ }
}

export function getBg(key: string): BgItem | undefined {
  return BACKGROUNDS.find((b) => b.key === key);
}
