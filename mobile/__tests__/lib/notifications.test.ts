jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      supabaseUrl: 'https://supabase.example.test',
      supabaseAnonKey: 'anon-test-key',
      statusCdnUrl: 'https://cdn.example.test/status.json',
      eas: { projectId: '53f480cb-b4e4-420e-8be7-c36e78bc914c' },
    },
  },
}));

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerToken } from '@/lib/api';
import { registerForPushNotificationsAsync } from '@/lib/notifications';

describe('registerToken', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const payload = {
    expo_token: 'ExponentPushToken[test123]',
    zone: 'caracas',
    platform: 'android' as const,
    notify_outage: true,
    notify_restoration: true,
    notify_neighbor: true,
  };

  it('returns {ok:true, offline:false} on 201', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 201 });

    await expect(registerToken(payload)).resolves.toEqual({ ok: true, offline: false });
  });

  it('returns {ok:false, offline:false} on non-OK response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 409 });

    await expect(registerToken(payload)).resolves.toEqual({ ok: false, offline: false });
  });

  it('returns {ok:false, offline:true} on network throw', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(registerToken(payload)).resolves.toEqual({ ok: false, offline: true });
  });

  it('POSTs to /rest/v1/push_tokens with Prefer merge-duplicates header', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 201 });

    await registerToken(payload);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/push_tokens'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Prefer: expect.stringContaining('resolution=merge-duplicates'),
        }),
      })
    );
  });
});

describe('registerForPushNotificationsAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    (Device as typeof Device & { isDevice: boolean }).isDevice = true;
  });

  it('creates the Android channel before requesting a token', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
      data: 'ExponentPushToken[test123]',
    });

    await registerForPushNotificationsAsync();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'outages',
      expect.objectContaining({
        name: 'Apagones',
        importance: Notifications.AndroidImportance.HIGH,
      })
    );
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: '53f480cb-b4e4-420e-8be7-c36e78bc914c',
    });
  });

  it('returns null when permission is denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

    await expect(registerForPushNotificationsAsync()).resolves.toBeNull();
  });

  it('returns the mocked Expo token when permission is granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
      data: 'ExponentPushToken[test456]',
    });

    await expect(registerForPushNotificationsAsync()).resolves.toBe('ExponentPushToken[test456]');
  });
});
