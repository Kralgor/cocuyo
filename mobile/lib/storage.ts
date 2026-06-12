import { createMMKV } from 'react-native-mmkv';

// ── MMKV instance ──────────────────────────────────────────────────────────────
// Single instance — created once at module level via createMMKV() (MMKV v4 API).
// SAFE: module-level createMMKV() instantiation is allowed (bridge is ready by import time).
// NOT SAFE: calling storage.getBoolean() at module level — only call inside components/hooks.
// Source: RESEARCH.md Pitfall 1
//
// ADR-007: Only SUPABASE_ANON_KEY in client apps. Phase 1 uses no Supabase at all.
// SUPABASE_ANON_KEY added in Phase 2 for report submission only.
// NEVER store SUPABASE_SERVICE_ROLE_KEY here — only anon key is permitted (ADR-007).
export const storage = createMMKV({ id: 'cocuyo' });

// ── storage keys ───────────────────────────────────────────────────────────────
// Single source of truth for all MMKV key names.
// Use these constants everywhere — never hardcode key strings across files.
export const STORAGE_KEYS = {
  hasSeenOnboarding: 'hasSeenOnboarding',          // boolean — trust screen shown once (D-08)
  selectedZone:      'selectedZone',               // string  — canonical region key from regions.ts
  themeOverride:     'themeOverride',              // 'light' | 'dark' | 'amoled' | null (missing = follow system)
  cacheTimestamp:    'statusCacheTimestamp',       // number  — epoch ms of last successful fetchStatus()
  reportQueue:       'reportQueue',                // JSON-serialized QueuedReport[]
  lastReportTime:    'lastReportTime',             // epoch ms of last enqueue for 30-min dedup
} as const;
