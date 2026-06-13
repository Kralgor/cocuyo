import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useMMKVBoolean, useMMKVString } from 'react-native-mmkv';

import { registerToken } from '@/lib/api';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { storage, STORAGE_KEYS } from '@/lib/storage';

type PreferenceKey = 'notifyOutage' | 'notifyRestoration' | 'notifyNeighbor';

export interface NotificationPreferences {
  notifyOutage: boolean;
  notifyRestoration: boolean;
  notifyNeighbor: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  notifyOutage: true,
  notifyRestoration: true,
  notifyNeighbor: true,
};

function readPrefs(): NotificationPreferences {
  return {
    notifyOutage: storage.getBoolean(STORAGE_KEYS.notifyOutage) ?? DEFAULT_PREFS.notifyOutage,
    notifyRestoration:
      storage.getBoolean(STORAGE_KEYS.notifyRestoration) ?? DEFAULT_PREFS.notifyRestoration,
    notifyNeighbor: storage.getBoolean(STORAGE_KEYS.notifyNeighbor) ?? DEFAULT_PREFS.notifyNeighbor,
  };
}

export function useNotifications() {
  const [selectedZone] = useMMKVString(STORAGE_KEYS.selectedZone, storage);
  const [token, setToken] = useMMKVString(STORAGE_KEYS.pushToken, storage);
  const [permissionGranted, setPermissionGranted] = useMMKVBoolean(
    STORAGE_KEYS.pushPermissionGranted,
    storage
  );
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => readPrefs());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncToken = useCallback(
    async (nextToken: string, nextPrefs: NotificationPreferences) => {
      if (!selectedZone) {
        setError('Elige una zona antes de activar las notificaciones.');
        return false;
      }

      const result = await registerToken({
        expo_token: nextToken,
        zone: selectedZone,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        notify_outage: nextPrefs.notifyOutage,
        notify_restoration: nextPrefs.notifyRestoration,
        notify_neighbor: nextPrefs.notifyNeighbor,
      });

      if (!result.ok) {
        setError(
          result.offline
            ? 'Sin conexión. Guardamos tu preferencia y reintentaremos luego.'
            : 'No se pudo sincronizar la suscripción.'
        );
        return false;
      }

      setError(null);
      return true;
    },
    [selectedZone]
  );

  const enableNotifications = useCallback(async () => {
    if (!selectedZone) {
      setError('Elige una zona antes de activar las notificaciones.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      storage.set(STORAGE_KEYS.notifyOutage, DEFAULT_PREFS.notifyOutage);
      storage.set(STORAGE_KEYS.notifyRestoration, DEFAULT_PREFS.notifyRestoration);
      storage.set(STORAGE_KEYS.notifyNeighbor, DEFAULT_PREFS.notifyNeighbor);
      setPrefs(DEFAULT_PREFS);

      const nextToken = await registerForPushNotificationsAsync();
      if (!nextToken) {
        setPermissionGranted(false);
        setError('Permiso no concedido o dispositivo no compatible.');
        return;
      }

      setToken(nextToken);
      setPermissionGranted(true);
      await syncToken(nextToken, DEFAULT_PREFS);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'No se pudieron activar las notificaciones.');
    } finally {
      setBusy(false);
    }
  }, [selectedZone, setPermissionGranted, setToken, syncToken]);

  const setPreference = useCallback(
    async (key: PreferenceKey, value: boolean) => {
      const nextPrefs = { ...prefs, [key]: value };
      storage.set(STORAGE_KEYS[key], value);
      setPrefs(nextPrefs);
      if (token) {
        setBusy(true);
        try {
          await syncToken(token, nextPrefs);
        } finally {
          setBusy(false);
        }
      }
    },
    [prefs, syncToken, token]
  );

  useEffect(() => {
    if (!token || !permissionGranted || !selectedZone) return;
    void syncToken(token, prefs);
  }, [permissionGranted, prefs, selectedZone, syncToken, token]);

  return useMemo(
    () => ({
      selectedZone: selectedZone ?? null,
      token: token ?? null,
      permissionGranted: Boolean(permissionGranted),
      prefs,
      busy,
      error,
      enableNotifications,
      setPreference,
    }),
    [busy, enableNotifications, error, permissionGranted, prefs, selectedZone, setPreference, token]
  );
}
