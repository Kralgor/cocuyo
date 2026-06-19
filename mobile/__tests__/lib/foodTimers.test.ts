/**
 * Tests for the food timer lifecycle layer in mobile/lib/food.ts.
 * Covers:
 *   FOOD-03 — saved-zone outage starts a session for tracked/enabled foods only
 *   FOOD-04 — keep counting from best-known outage start (incl. stale/offline)
 *   D-04/05/06/07/08/15/16/18 — lifecycle decisions
 * Pure, offline, deterministic. MMKV mocked by jest.setup.js.
 */

import {
  acknowledgeFoodOutagePrompt,
  deriveFoodTimerSession,
  deriveOutageStart,
  dismissRestoredFoodReview,
  getFoodTimerProgress,
  idleFoodTimerSession,
  isFoodOutageStatus,
  readFoodTimerState,
  resetFoodTimerState,
  writeFoodTimerState,
  type FoodTimerSession,
  type TrackedFoodItem,
} from '../../lib/food';
import type { RegionEntry } from '../../lib/api';
import { STORAGE_KEYS, storage } from '../../lib/storage';

const NOW = '2026-06-19T12:00:00.000Z';

function minutesAfter(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}

function trackedItem(overrides: Partial<TrackedFoodItem> = {}): TrackedFoodItem {
  return {
    id: 'id-1',
    presetId: null,
    name: 'Leche',
    category: 'dairy',
    thresholdMinutes: 120,
    warningLeadMinutes: 30,
    enabled: true,
    createdAt: NOW,
    ...overrides,
  };
}

function region(overrides: Partial<RegionEntry> = {}): RegionEntry {
  return {
    display_name: 'Maracaibo',
    current_score: 0.9,
    prediction_score: null,
    status: 'no_power',
    signals: { internet: null, satellite: null, crowdsource: null, weather: null },
    crowd_reports_30min: 0,
    prediction_text: null,
    rationing_pattern: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetFoodTimerState();
});

// ── isFoodOutageStatus ──────────────────────────────────────────────────────────

describe('isFoodOutageStatus', () => {
  it('treats no_power and outage.type values as outage', () => {
    expect(isFoodOutageStatus('no_power')).toBe(true);
    expect(isFoodOutageStatus('confirmed_outage')).toBe(true);
    expect(isFoodOutageStatus('likely_outage')).toBe(true);
  });

  it('does not treat unstable/normal/power_back/no_data/null as a food outage', () => {
    ['unstable', 'normal', 'power_back', 'no_data', '', null, undefined].forEach((s) => {
      expect(isFoodOutageStatus(s)).toBe(false);
    });
  });
});

// ── deriveOutageStart (FOOD-04, D-18) ───────────────────────────────────────────

describe('deriveOutageStart', () => {
  it('prefers outage.started_at over elapsed_minutes', () => {
    const started = minutesAfter(NOW, -90);
    const r = region({
      outage: { started_at: started, elapsed_minutes: 30 } as RegionEntry['outage'],
    });
    const out = deriveOutageStart(r, NOW);
    expect(out.outageStartedAt).toBe(started);
    expect(out.source).toBe('status_outage_started_at');
  });

  it('derives an ISO outage start from elapsed_minutes when started_at absent', () => {
    const r = region({ outage: { elapsed_minutes: 45 } as RegionEntry['outage'] });
    const out = deriveOutageStart(r, NOW);
    expect(out.source).toBe('status_elapsed_minutes');
    expect(out.outageStartedAt).toBe(minutesAfter(NOW, -45));
  });

  it('falls back to local detection time when both are absent', () => {
    const out = deriveOutageStart(region({ outage: undefined }), NOW);
    expect(out.source).toBe('detected_at');
    expect(out.outageStartedAt).toBe(NOW);
  });
});

// ── deriveFoodTimerSession lifecycle ────────────────────────────────────────────

describe('deriveFoodTimerSession (FOOD-03 start conditions)', () => {
  it('starts an active session when the saved zone enters an outage with an enabled item', () => {
    const next = deriveFoodTimerSession({
      previous: idleFoodTimerSession(),
      selectedZone: 'maracaibo',
      region: region({ status: 'no_power', outage: { started_at: minutesAfter(NOW, -60) } as RegionEntry['outage'] }),
      trackedItems: [trackedItem({ enabled: true })],
      now: NOW,
    });
    expect(next.status).toBe('active');
    expect(next.zone).toBe('maracaibo');
    expect(next.outageStartedAt).toBe(minutesAfter(NOW, -60));
    expect(next.needsOutageReviewPrompt).toBe(true); // D-15
  });

  it('does not start when there are no enabled tracked foods (D-05)', () => {
    const next = deriveFoodTimerSession({
      previous: idleFoodTimerSession(),
      selectedZone: 'maracaibo',
      region: region({ status: 'no_power' }),
      trackedItems: [trackedItem({ enabled: false })],
      now: NOW,
    });
    expect(next.status).toBe('idle');
  });

  it('does not start when there is no selected zone', () => {
    const next = deriveFoodTimerSession({
      previous: idleFoodTimerSession(),
      selectedZone: null,
      region: region({ status: 'no_power' }),
      trackedItems: [trackedItem({ enabled: true })],
      now: NOW,
    });
    expect(next.status).toBe('idle');
  });

  it('does not start on non-outage status (e.g. unstable)', () => {
    const next = deriveFoodTimerSession({
      previous: idleFoodTimerSession(),
      selectedZone: 'maracaibo',
      region: region({ status: 'unstable', outage: undefined }),
      trackedItems: [trackedItem({ enabled: true })],
      now: NOW,
    });
    expect(next.status).toBe('idle');
  });

  it('does not flag a prompt again while the same outage stays active', () => {
    const active = deriveFoodTimerSession({
      previous: idleFoodTimerSession(),
      selectedZone: 'maracaibo',
      region: region({ outage: { started_at: minutesAfter(NOW, -30) } as RegionEntry['outage'] }),
      trackedItems: [trackedItem()],
      now: NOW,
    });
    const acknowledged = acknowledgeFoodOutagePrompt(active, NOW);
    const next = deriveFoodTimerSession({
      previous: acknowledged,
      selectedZone: 'maracaibo',
      region: region({ outage: { started_at: minutesAfter(NOW, -30) } as RegionEntry['outage'] }),
      trackedItems: [trackedItem()],
      now: minutesAfter(NOW, 10),
    });
    expect(next.status).toBe('active');
    expect(next.needsOutageReviewPrompt).toBe(false);
    expect(next.outageStartedAt).toBe(minutesAfter(NOW, -30)); // same start preserved
  });
});

describe('deriveFoodTimerSession (FOOD-04 stale/offline, D-08, D-18)', () => {
  const baseActive: FoodTimerSession = {
    status: 'active',
    zone: 'maracaibo',
    timerSessionId: 'maracaibo|x',
    outageStartedAt: minutesAfter(NOW, -90),
    source: 'status_outage_started_at',
    startedAtLocal: NOW,
  };

  it('keeps counting from the previous start while offline', () => {
    const next = deriveFoodTimerSession({
      previous: baseActive,
      selectedZone: 'maracaibo',
      region: null,
      isOffline: true,
      trackedItems: [trackedItem()],
      now: minutesAfter(NOW, 30),
    });
    expect(next.status).toBe('active');
    expect(next.outageStartedAt).toBe(baseActive.outageStartedAt);
    expect(next.isOffline).toBe(true);
  });

  it('keeps counting from the previous start while status is stale', () => {
    const next = deriveFoodTimerSession({
      previous: baseActive,
      selectedZone: 'maracaibo',
      region: region({ status: 'no_data' }),
      isStatusStale: true,
      trackedItems: [trackedItem()],
      now: minutesAfter(NOW, 30),
    });
    expect(next.status).toBe('active');
    expect(next.outageStartedAt).toBe(baseActive.outageStartedAt);
    expect(next.isStatusStale).toBe(true);
  });
});

describe('deriveFoodTimerSession (restoration, D-07, D-16)', () => {
  const baseActive: FoodTimerSession = {
    status: 'active',
    zone: 'maracaibo',
    timerSessionId: 'maracaibo|x',
    outageStartedAt: minutesAfter(NOW, -90),
    source: 'status_outage_started_at',
    startedAtLocal: NOW,
  };

  it('enters restored_review and clears active counting without declaring food safe', () => {
    const next = deriveFoodTimerSession({
      previous: baseActive,
      selectedZone: 'maracaibo',
      region: region({ status: 'power_back', outage: undefined }),
      trackedItems: [trackedItem()],
      now: minutesAfter(NOW, 100),
    });
    expect(next.status).toBe('restored_review');
    expect(next.restoredAt).toBe(minutesAfter(NOW, 100));
    // no "safe" declaration: restored_review is the only safety-related signal
    expect(next.status).not.toBe('idle');
    expect(JSON.stringify(next)).not.toContain('safe');
  });

  it('dismissRestoredFoodReview returns to idle and persists', () => {
    writeFoodTimerState({ ...baseActive, status: 'restored_review', restoredAt: NOW });
    const idle = dismissRestoredFoodReview();
    expect(idle.status).toBe('idle');
    expect(readFoodTimerState().status).toBe('idle');
  });
});

// ── MMKV state helpers (D-06, T-04-02-01) ───────────────────────────────────────

describe('food timer state persistence', () => {
  it('returns idle when nothing stored', () => {
    expect(readFoodTimerState()).toEqual(idleFoodTimerSession());
  });

  it('returns idle on invalid stored JSON without throwing', () => {
    storage.set(STORAGE_KEYS.foodTimerState, '{ not valid json ');
    expect(() => readFoodTimerState()).not.toThrow();
    expect(readFoodTimerState().status).toBe('idle');
  });

  it('returns idle when stored object lacks a valid status', () => {
    storage.set(STORAGE_KEYS.foodTimerState, JSON.stringify({ zone: 'maracaibo' }));
    expect(readFoodTimerState().status).toBe('idle');
  });

  it('round-trips a written session and normalizes missing fields', () => {
    const session: FoodTimerSession = {
      status: 'active',
      zone: 'maracaibo',
      timerSessionId: 'maracaibo|x',
      outageStartedAt: NOW,
      source: 'detected_at',
      startedAtLocal: NOW,
      needsOutageReviewPrompt: true,
    };
    writeFoodTimerState(session);
    const read = readFoodTimerState();
    expect(read.status).toBe('active');
    expect(read.needsOutageReviewPrompt).toBe(true);
  });

  it('acknowledgeFoodOutagePrompt clears the prompt and records the time', () => {
    const acked = acknowledgeFoodOutagePrompt(
      { ...idleFoodTimerSession(), status: 'active', needsOutageReviewPrompt: true },
      NOW,
    );
    expect(acked.needsOutageReviewPrompt).toBe(false);
    expect(acked.acknowledgedOutagePromptAt).toBe(NOW);
  });
});

// ── UI-adjacent state (plan 03) ──────────────────────────────────────────────────
// These mirror what the Food screen renders without a brittle screen render test.

describe('food timer UI-adjacent state (plan 03)', () => {
  it('outage prompt can be acknowledged so the in-app banner stops showing', () => {
    const active = deriveFoodTimerSession({
      previous: idleFoodTimerSession(),
      selectedZone: 'maracaibo',
      region: region({ outage: { started_at: minutesAfter(NOW, -30) } as RegionEntry['outage'] }),
      trackedItems: [trackedItem()],
      now: NOW,
    });
    expect(active.needsOutageReviewPrompt).toBe(true);
    const acked = acknowledgeFoodOutagePrompt(active, NOW);
    expect(acked.needsOutageReviewPrompt).toBe(false);
  });

  it('restored review can be dismissed back to idle', () => {
    writeFoodTimerState({
      ...idleFoodTimerSession(),
      status: 'restored_review',
      restoredAt: NOW,
    });
    expect(dismissRestoredFoodReview().status).toBe('idle');
  });

  it('active timer card data exposes elapsed, remaining, and warning level', () => {
    const card = getFoodTimerProgress(
      trackedItem({ thresholdMinutes: 120, warningLeadMinutes: 30 }),
      NOW,
      minutesAfter(NOW, 100),
    );
    expect(card.elapsedMinutes).toBeCloseTo(100);
    expect(card.remainingMinutes).toBeCloseTo(20);
    expect(card.level).toBe('warning');
  });

  it('stale and offline flags remain visible on the derived active session', () => {
    const baseActive: FoodTimerSession = {
      status: 'active',
      zone: 'maracaibo',
      timerSessionId: 'maracaibo|x',
      outageStartedAt: minutesAfter(NOW, -90),
      source: 'status_outage_started_at',
      startedAtLocal: NOW,
    };
    const next = deriveFoodTimerSession({
      previous: baseActive,
      selectedZone: 'maracaibo',
      region: null,
      isOffline: true,
      isStatusStale: true,
      trackedItems: [trackedItem()],
      now: minutesAfter(NOW, 30),
    });
    expect(next.status).toBe('active');
    expect(next.isOffline).toBe(true);
    expect(next.isStatusStale).toBe(true);
  });
});
