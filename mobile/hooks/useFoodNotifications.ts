import { useCallback, useMemo, useState } from 'react';

import type { FoodTimerSession, TrackedFoodItem } from '@/lib/food';
import {
  cancelAllFoodWarningNotifications,
  ensureFoodNotificationPermission,
  readFoodNotificationPrefs,
  rescheduleFoodWarningNotifications,
  writeFoodNotificationPrefs,
  type FoodPermissionStatus,
} from '@/lib/foodNotifications';

// ── useFoodNotifications (Phase 4 plan 04, NOTF-03) ─────────────────────────────
// Local-first food alert orchestration. Reads/writes prefs in MMKV, requests OS
// permission ONLY in enableFoodAlerts() (D-11) — never on mount. Schedules local
// Expo warnings for enabled tracked foods while a session is active (D-09, D-18),
// and cancels them on disable/restore/idle/reset (D-16). No push token, no
// Supabase, no identity for food state (D-10). Permission denial is non-fatal.

export interface UseFoodNotificationsResult {
  enabled: boolean;
  permissionStatus: FoodPermissionStatus;
  busy: boolean;
  error: string | null;
  enableFoodAlerts: () => Promise<boolean>;
  disableFoodAlerts: () => Promise<void>;
  syncFoodNotifications: (
    session: FoodTimerSession,
    items: TrackedFoodItem[],
  ) => Promise<void>;
}

export function useFoodNotifications(): UseFoodNotificationsResult {
  const [enabled, setEnabled] = useState<boolean>(() => readFoodNotificationPrefs().enabled);
  const [permissionStatus, setPermissionStatus] =
    useState<FoodPermissionStatus>('undetermined');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request permission ONLY here (point-of-use, D-11).
  const enableFoodAlerts = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const status = await ensureFoodNotificationPermission();
      setPermissionStatus(status);
      if (status !== 'granted') {
        // Non-fatal: surface as UI state, do not throw or crash the tab.
        setError('Permiso de notificaciones no concedido.');
        const prefs = readFoodNotificationPrefs();
        writeFoodNotificationPrefs({ ...prefs, enabled: false });
        setEnabled(false);
        return false;
      }
      const prefs = readFoodNotificationPrefs();
      writeFoodNotificationPrefs({ ...prefs, enabled: true });
      setEnabled(true);
      return true;
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'No se pudieron activar los avisos.');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const disableFoodAlerts = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const prefs = readFoodNotificationPrefs();
      writeFoodNotificationPrefs({ ...prefs, enabled: false });
      setEnabled(false);
      setError(null);
      await cancelAllFoodWarningNotifications();
    } finally {
      setBusy(false);
    }
  }, []);

  // Schedule when enabled + active; cancel otherwise. No permission request here.
  const syncFoodNotifications = useCallback(
    async (session: FoodTimerSession, items: TrackedFoodItem[]): Promise<void> => {
      const prefs = readFoodNotificationPrefs();
      if (!prefs.enabled) {
        await cancelAllFoodWarningNotifications();
        return;
      }
      if (session.status === 'active' && session.timerSessionId) {
        await rescheduleFoodWarningNotifications(session, items);
        return;
      }
      // disabled / restored / idle / reset → cancel active warnings (D-16).
      await cancelAllFoodWarningNotifications();
    },
    [],
  );

  return useMemo(
    () => ({
      enabled,
      permissionStatus,
      busy,
      error,
      enableFoodAlerts,
      disableFoodAlerts,
      syncFoodNotifications,
    }),
    [
      enabled,
      permissionStatus,
      busy,
      error,
      enableFoodAlerts,
      disableFoodAlerts,
      syncFoodNotifications,
    ],
  );
}
