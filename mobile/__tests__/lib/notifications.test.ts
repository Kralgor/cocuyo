jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      supabaseUrl: 'https://supabase.example.test',
      supabaseAnonKey: 'anon-test-key',
      statusCdnUrl: 'https://cdn.example.test/status.json',
    },
  },
}));

import { registerToken } from '@/lib/api';

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
