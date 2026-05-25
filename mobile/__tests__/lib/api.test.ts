/**
 * Tests for mobile/lib/api.ts
 * Covers: STAT-01 — fetchStatus() returns StatusJson from CDN, or offline flag on error
 */

import { fetchStatus } from '../../lib/api';

// ── fetch mock setup ───────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── mock expo-constants ────────────────────────────────────────────────────────
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        statusCdnUrl: 'https://cdn.cocuyo.app/status.json',
      },
    },
  },
}));

// ── helpers ────────────────────────────────────────────────────────────────────
function makeMockStatusJson() {
  return {
    updated_at:         '2026-05-25T12:00:00Z',
    phase:              1,
    scheduler:          'github-actions',
    next_update_approx: '2026-05-25T12:10:00Z',
    collector_errors:   0,
    regions: {
      maracaibo: {
        display_name:        'Maracaibo (Zulia)',
        current_score:       0.8,
        prediction_score:    null,
        status:              'no_power',
        signals:             { internet: null, satellite: null, crowdsource: 0.8, weather: null },
        crowd_reports_30min: 5,
        prediction_text:     null,
        rationing_pattern:   null,
      },
    },
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('fetchStatus', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('returns { data: StatusJson, offline: false } on a 200 response', async () => {
    const mockData = makeMockStatusJson();
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: jest.fn().mockResolvedValueOnce(mockData),
    });

    const result = await fetchStatus();

    expect(result.offline).toBe(false);
    expect(result.data).not.toBeNull();
    expect(result.data?.updated_at).toBe('2026-05-25T12:00:00Z');
    expect(result.data?.regions.maracaibo.status).toBe('no_power');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns { data: null, offline: false } on a non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    const result = await fetchStatus();

    expect(result.data).toBeNull();
    expect(result.offline).toBe(false);
  });

  it('returns { data: null, offline: true } when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const result = await fetchStatus();

    expect(result.data).toBeNull();
    expect(result.offline).toBe(true);
  });

  it('never throws — caller always receives a result object', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(fetchStatus()).resolves.toMatchObject({
      data:    null,
      offline: true,
    });
  });
});
