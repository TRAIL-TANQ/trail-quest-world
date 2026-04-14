/**
 * Auth utilities - PIN login / guest mode
 *
 * Stores auth state in localStorage. Guest users get a random ID prefixed
 * with "guest-" and all Supabase writes are skipped for them.
 */

const STORAGE_KEY = 'trail_quest_auth';

export interface AuthData {
  childId: string;
  childName: string;
  isGuest: boolean;
  isAdmin?: boolean;
}

export function getAuth(): AuthData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.childId) return data;
    }
  } catch {
    // corrupted storage — fall through to guest
  }
  return createGuestAuth();
}

export function createGuestAuth(): AuthData {
  const id = 'guest-' + Math.random().toString(36).slice(2, 10);
  const data: AuthData = { childId: id, childName: 'ゲスト', isGuest: true };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export function saveAuth(childId: string, childName: string, admin = false): void {
  const data: AuthData = { childId, childName, isGuest: false, isAdmin: admin };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function isAdmin(): boolean {
  return getAuth().isAdmin === true;
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isGuest(): boolean {
  return getAuth().isGuest;
}

export function getChildId(): string {
  return getAuth().childId;
}
