import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMMKVString } from 'react-native-mmkv';

import {
  acknowledgeFoodOutagePrompt,
  createCustomTrackedFood,
  createTrackedFoodFromPreset,
  deriveFoodTimerSession,
  dismissRestoredFoodReview,
  getFoodTimerProgress,
  idleFoodTimerSession,
  readFoodTimerState,
  readTrackedFoodItems,
  removeTrackedFoodItem,
  resetFoodTimerState,
  upsertTrackedFoodItem,
  writeFoodTimerState,
  type CustomFoodInput,
  type FoodPresetId,
  type FoodTimerProgress,
  type FoodTimerSession,
  type TrackedFoodItem,
} from '@/lib/food';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { useOffline } from './useOffline';
import { useStatus } from './useStatus';

// ── useFoodTimers (FOOD-03, FOOD-04, Phase 4 plan 02) ───────────────────────────
// Connects the saved-zone outage status to local tracked foods. Pure derivation
// lives in lib/food.ts; this hook only wires inputs, persists the derived
// session, and exposes UI-ready data. Local/offline only — no background polling
// (threat T-04-02-03): it updates on render and on a modest interval while the
// Food tab keeps the hook mounted.

const TICK_INTERVAL_MS = 30_000;

export interface FoodTimerCard {
  item: TrackedFoodItem;
  progress: FoodTimerProgress;
}

export interface UseFoodTimersResult {
  selectedZone: string | null;
  trackedItems: TrackedFoodItem[];
  enabledTrackedItems: TrackedFoodItem[];
  session: FoodTimerSession;
  timerCards: FoodTimerCard[];
  isOffline: boolean;
  isStatusStale: boolean;
  acknowledgeOutagePrompt: () => void;
  dismissRestoredReview: () => void;
  addPreset: (presetId: FoodPresetId) => TrackedFoodItem;
  addCustomItem: (input: CustomFoodInput) => TrackedFoodItem;
  removeItem: (id: string) => void;
  setItemEnabled: (id: string, enabled: boolean) => void;
  resetAllFoodTimers: () => void;
}

export function useFoodTimers(): UseFoodTimersResult {
  const [selectedZone] = useMMKVString(STORAGE_KEYS.selectedZone, storage);
  const { data } = useStatus();
  const { isOffline, isStale } = useOffline();

  const [trackedItems, setTrackedItems] = useState<TrackedFoodItem[]>(() => readTrackedFoodItems());
  const [session, setSession] = useState<FoodTimerSession>(() => readFoodTimerState());
  const [tick, setTick] = useState<number>(() => Date.now());

  // Modest interval so elapsed/level recompute while the tab is mounted; no
  // background polling — interval is torn down on unmount (T-04-02-03).
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const zone = selectedZone ?? null;
  const region = zone && data ? data.regions[zone] ?? null : null;
  const statusUpdatedAt = data?.updated_at;

  // ── derive + persist the next session ─────────────────────────────────────────
  useEffect(() => {
    const now = new Date(tick).toISOString();
    const next = deriveFoodTimerSession({
      previous: session,
      selectedZone: zone,
      region,
      statusUpdatedAt,
      isStatusStale: isStale,
      isOffline,
      trackedItems,
      now,
    });
    if (JSON.stringify(next) !== JSON.stringify(session)) {
      writeFoodTimerState(next);
      setSession(next);
    }
    // session intentionally omitted: it is the value being reconciled, comparing
    // by serialized equality above prevents an update loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, region, statusUpdatedAt, isStale, isOffline, trackedItems, tick]);

  const enabledTrackedItems = useMemo(
    () => trackedItems.filter((it) => it.enabled),
    [trackedItems],
  );

  const timerCards = useMemo<FoodTimerCard[]>(() => {
    if (session.status !== 'active' || !session.outageStartedAt) {
      return [];
    }
    const now = new Date(tick).toISOString();
    const outageStart = session.outageStartedAt;
    return enabledTrackedItems.map((item) => ({
      item,
      progress: getFoodTimerProgress(item, outageStart, now),
    }));
  }, [session.status, session.outageStartedAt, enabledTrackedItems, tick]);

  // ── tracked item mutations ────────────────────────────────────────────────────
  const addPreset = useCallback((presetId: FoodPresetId): TrackedFoodItem => {
    const created = createTrackedFoodFromPreset(presetId, new Date().toISOString());
    setTrackedItems(upsertTrackedFoodItem(created));
    return created;
  }, []);

  const addCustomItem = useCallback((input: CustomFoodInput): TrackedFoodItem => {
    const created = createCustomTrackedFood(input, new Date().toISOString());
    setTrackedItems(upsertTrackedFoodItem(created));
    return created;
  }, []);

  const removeItem = useCallback((id: string): void => {
    setTrackedItems(removeTrackedFoodItem(id));
  }, []);

  const setItemEnabled = useCallback(
    (id: string, enabled: boolean): void => {
      const current = trackedItems.find((it) => it.id === id);
      if (!current) {
        return;
      }
      setTrackedItems(upsertTrackedFoodItem({ ...current, enabled }));
    },
    [trackedItems],
  );

  // ── session actions ───────────────────────────────────────────────────────────
  const acknowledgeOutagePrompt = useCallback(() => {
    setSession((prev) => {
      const next = acknowledgeFoodOutagePrompt(prev, new Date().toISOString());
      writeFoodTimerState(next);
      return next;
    });
  }, []);

  const dismissRestoredReview = useCallback(() => {
    const next = dismissRestoredFoodReview();
    setSession(next);
  }, []);

  const resetAllFoodTimers = useCallback(() => {
    resetFoodTimerState();
    setSession(idleFoodTimerSession());
  }, []);

  return {
    selectedZone: zone,
    trackedItems,
    enabledTrackedItems,
    session,
    timerCards,
    isOffline,
    isStatusStale: isStale,
    acknowledgeOutagePrompt,
    dismissRestoredReview,
    addPreset,
    addCustomItem,
    removeItem,
    setItemEnabled,
    resetAllFoodTimers,
  };
}
