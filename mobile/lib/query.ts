import { createMMKV } from 'react-native-mmkv';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';

// ── MMKV adapter for React Query persister ─────────────────────────────────────
// Separate MMKV instance from the app storage instance (id: 'react-query-cache').
// This keeps React Query's dehydrated cache isolated from user preference keys.
// Source: RESEARCH.md Pattern 1 + github.com/mrousavy/react-native-mmkv WRAPPER_REACT_QUERY.md
//
// Offline-first rationale: networkMode 'offlineFirst' serves the persisted cache
// immediately on cold launch without waiting for the network — critical for Venezuela
// where connectivity is unreliable. NEVER use 'online' (default): it blocks offline cache.
// Source: RESEARCH.md Pitfall 6 + Anti-Patterns section
const mmkvPersistStore = createMMKV({ id: 'react-query-cache' });

// ── storage adapter ────────────────────────────────────────────────────────────
// Wraps MMKV's synchronous API to match the SyncStorage interface expected by
// createSyncStoragePersister. MMKV must be used here (not AsyncStorage) because
// the sync persister requires synchronous read/write operations.
const clientStorage = {
  setItem:    (key: string, value: string): void => { mmkvPersistStore.set(key, value); },
  getItem:    (key: string): string | null       => mmkvPersistStore.getString(key) ?? null,
  removeItem: (key: string): void               => { mmkvPersistStore.remove(key); },
  // Note: MMKV v4 uses remove() not delete() — updated from RESEARCH.md Pattern 1
};

// ── persister ──────────────────────────────────────────────────────────────────
export const persister = createSyncStoragePersister({ storage: clientStorage });

// ── QueryClient ────────────────────────────────────────────────────────────────
// gcTime (24h) MUST be greater than staleTime (9min) — if gcTime < staleTime,
// React Query evicts the cache before MMKV saves it, breaking cold-launch restoration.
// Source: RESEARCH.md Anti-Patterns + Pitfall 6
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime:      1000 * 60 * 60 * 24, // 24h — keep cache alive across sessions
      staleTime:   1000 * 60 * 9,        // 9 min — slightly under 10-min pipeline cycle
      networkMode: 'offlineFirst',        // serve cache without waiting for network (STAT-03)
      retry:       3,
    },
  },
});
