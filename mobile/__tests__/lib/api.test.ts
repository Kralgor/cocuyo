/**
 * Tests for mobile/lib/api.ts
 * Covers: STAT-01 — fetchStatus() returns StatusJson from CDN, or offline flag on error
 */

// ── mock expo-constants ────────────────────────────────────────────────────────
// NOTE: babel.config.js uses babel-preset-expo WITHOUT the jest preset, so
// jest.mock calls are NOT hoisted — the mock must be declared before the module
// under test loads (hence require() below instead of a top-level import).
// __esModule: true is REQUIRED — without it babel's _interopRequireDefault
// double-wraps the mock and STATUS_CDN_URL falls back to the production URL.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        statusCdnUrl: 'https://cdn.cocuyo.app/status.json',
      },
    },
  },
}));

const { fetchStatus } = require('../../lib/api');

// ── fetch mock setup ───────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

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

  it('fetches from the statusCdnUrl configured in app.json extra', async () => {
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: jest.fn().mockResolvedValueOnce(makeMockStatusJson()),
    });

    await fetchStatus();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://cdn.cocuyo.app/status.json');
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
