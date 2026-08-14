/**
 * Tests for mobile/lib/history.ts
 * Covers: STAT-04 — fetchRegionHistory() CDN contract + useHistory hook wiring
 *
 * @testing-library/react-native is not installed — hooks are exercised via
 * react-test-renderer with a QueryClientProvider wrapper (amoled.test.ts pattern).
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── mock expo-constants ────────────────────────────────────────────────────────
// NOTE: babel.config.js uses babel-preset-expo WITHOUT the jest preset, so
// jest.mock calls are NOT hoisted. The mock must be declared before the module
// under test is loaded — hence require() below instead of a top-level import.
// __esModule: true is REQUIRED — without it babel's _interopRequireDefault
// double-wraps the mock and Constants.expoConfig is undefined (fallback URL used).
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        historyCdnUrl: 'https://cdn.cocuyo.app/history',
      },
    },
  },
}));

const { fetchRegionHistory, useHistory } = require('../../lib/history');
import type { RegionHistory } from '../../lib/history';

// ── fetch mock setup ───────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── helpers ────────────────────────────────────────────────────────────────────
function makeMockHistory(): RegionHistory {
  return {
    region:         'maracaibo',
    display_name:   'Maracaibo (Zulia)',
    generated_at:   '2026-06-23T00:00:00Z',
    days_included:  30,
    days:           [{ date: '2026-06-22', outages: [{ start_hour: 14, duration_h: 3, type: 'no_power' }] }],
    stats_30d:      { total_hours: 12, count: 4, avg_duration_h: 3, longest_h: 6 },
    stats_90d:      { total_hours: 40, count: 12, avg_duration_h: 3.33, longest_h: 10 },
    pattern:        { detected: true, description: 'Apagones típicos en la tarde', frequency: 'semanal', typical_days: [2, 4], typical_start_hour: 14, typical_duration_h: 3, confidence: 0.8 },
    forecast_48h:   [{ half_hour: 0, hour: 14, risk: 0.7 }],
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

// ── waitFor ────────────────────────────────────────────────────────────────────
// Without @testing-library, flush React Query's async settle deterministically:
// poll inside act() with real-timer macrotask flushes.
async function waitFor(fn: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor timeout: ${fn.toString().slice(0, 80)}`);
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
  }
}

// ── tests: fetchRegionHistory ──────────────────────────────────────────────────

describe('fetchRegionHistory', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns null when the CDN responds non-OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchRegionHistory('maracaibo');

    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const result = await fetchRegionHistory('maracaibo');

    expect(result).toBeNull();
  });

  it('returns a typed RegionHistory when the CDN returns valid JSON', async () => {
    const mockData = makeMockHistory();
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: jest.fn().mockResolvedValueOnce(mockData),
    });

    const result = await fetchRegionHistory('maracaibo');

    expect(result).not.toBeNull();
    expect(result?.region).toBe('maracaibo');
    expect(result?.days).toHaveLength(1);
    expect(result?.stats_30d.count).toBe(4);
    expect(result?.pattern.detected).toBe(true);
  });

  it('fetches from the `${base}/${regionKey}.json` URL pattern', async () => {
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: jest.fn().mockResolvedValueOnce(makeMockHistory()),
    });

    await fetchRegionHistory('caracas');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://cdn.cocuyo.app/history/caracas.json');
  });
});

// ── tests: useHistory ──────────────────────────────────────────────────────────

describe('useHistory', () => {
  const renderers: TestRenderer.ReactTestRenderer[] = [];

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    act(() => {
      renderers.forEach(r => r.unmount());
    });
    renderers.length = 0;
  });

  it('returns { data: null } when regionKey is null without making a network call', async () => {
    let state: ReturnType<typeof useHistory> | undefined;

    function Probe() {
      state = useHistory(null);
      return null;
    }

    await act(async () => {
      renderers.push(
        TestRenderer.create(
          React.createElement(
            QueryClientProvider,
            { client: makeClient() },
            React.createElement(Probe),
          ),
        ),
      );
      await Promise.resolve();
    });

    expect(state?.data).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches history for the region key and exposes it as data', async () => {
    const mockData = makeMockHistory();
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: jest.fn().mockResolvedValueOnce(mockData),
    });

    let state: ReturnType<typeof useHistory> | undefined;

    function Probe() {
      state = useHistory('maracaibo');
      return null;
    }

    await act(async () => {
      renderers.push(
        TestRenderer.create(
          React.createElement(
            QueryClientProvider,
            { client: makeClient() },
            React.createElement(Probe),
          ),
        ),
      );
    });

    await waitFor(() => state?.data?.region === 'maracaibo');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(state?.data?.region).toBe('maracaibo');
  });

  it('uses queryKey [\'history\', regionKey] with staleTime 6h and gcTime 24h', async () => {
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: jest.fn().mockResolvedValueOnce(makeMockHistory()),
    });

    const client = makeClient();

    function Probe() {
      useHistory('maracaibo');
      return null;
    }

    await act(async () => {
      renderers.push(
        TestRenderer.create(
          React.createElement(
            QueryClientProvider,
            { client },
            React.createElement(Probe),
          ),
        ),
      );
    });

    await waitFor(() => client.getQueryCache().findAll({ queryKey: ['history', 'maracaibo'] }).length > 0);

    const queries = client.getQueryCache().findAll({ queryKey: ['history', 'maracaibo'] });
    expect(queries).toHaveLength(1);
    expect(queries[0].options.staleTime).toBe(1000 * 60 * 60 * 6);
    expect(queries[0].options.gcTime).toBe(1000 * 60 * 60 * 24);
    expect(queries[0].options.enabled).toBe(true);
  });
});
