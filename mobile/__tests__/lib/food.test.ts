/**
 * Tests for mobile/lib/food.ts
 * Covers:
 *   FOOD-01 — compact Spanish-first preset catalog
 *   FOOD-02 — lightweight custom food validation + creation
 *   FOOD-04 — pure timer warning classification + progress
 *   D-06/D-13 — MMKV persistence, upsert, remove, reset, defensive parsing
 * MMKV mock provided by jest.setup.js (in-memory). expo-crypto.randomUUID is
 * mocked to a fixed value, so id-sensitive tests assign ids explicitly.
 */

import {
  FOOD_PRESETS,
  classifyFoodTimer,
  createCustomTrackedFood,
  createTrackedFoodFromPreset,
  getFoodTimerProgress,
  readTrackedFoodItems,
  removeTrackedFoodItem,
  resetTrackedFoodItems,
  upsertTrackedFoodItem,
  validateCustomFood,
  writeTrackedFoodItems,
  type TrackedFoodItem,
} from '../../lib/food';
import { STORAGE_KEYS, storage } from '../../lib/storage';

const NOW = '2026-06-19T12:00:00.000Z';

function minutesAfter(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}

function item(overrides: Partial<TrackedFoodItem> = {}): TrackedFoodItem {
  return {
    id: 'id-1',
    presetId: null,
    name: 'Test',
    category: null,
    thresholdMinutes: 120,
    warningLeadMinutes: 30,
    enabled: true,
    createdAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  resetTrackedFoodItems();
});

// ── FOOD-01: preset catalog ─────────────────────────────────────────────────────

describe('FOOD_PRESETS (FOOD-01)', () => {
  it('is a compact catalog of basic groceries', () => {
    expect(FOOD_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(FOOD_PRESETS.length).toBeLessThanOrEqual(15);
  });

  it('covers the recommended basic grocery categories', () => {
    const categories = new Set<string>(FOOD_PRESETS.map((p) => p.category));
    ['dairy', 'meat', 'eggs', 'leftovers', 'prepared', 'produce', 'freezer'].forEach((c) => {
      expect(categories.has(c)).toBe(true);
    });
  });

  it('uses Spanish-first names and cautious copy without safety guarantees', () => {
    for (const preset of FOOD_PRESETS) {
      expect(preset.name.trim().length).toBeGreaterThan(0);
      expect(preset.cautionText.trim().length).toBeGreaterThan(0);
      // no temperature claims / false guarantees
      expect(preset.cautionText.toLowerCase()).not.toContain('seguro comer');
      expect(preset.cautionText).not.toMatch(/\d+\s?°/);
    }
  });

  it('has positive thresholds with warning lead strictly below threshold (D-17)', () => {
    for (const preset of FOOD_PRESETS) {
      expect(preset.thresholdMinutes).toBeGreaterThan(0);
      expect(preset.warningLeadMinutes).toBeGreaterThan(0);
      expect(preset.warningLeadMinutes).toBeLessThan(preset.thresholdMinutes);
    }
  });

  it('createTrackedFoodFromPreset returns an enabled item with preset data', () => {
    const tracked = createTrackedFoodFromPreset('milk', NOW);
    expect(tracked.presetId).toBe('milk');
    expect(tracked.name).toBe('Leche');
    expect(tracked.enabled).toBe(true);
    expect(tracked.createdAt).toBe(NOW);
    expect(tracked.thresholdMinutes).toBeGreaterThan(0);
    expect(tracked.warningLeadMinutes).toBeLessThan(tracked.thresholdMinutes);
  });
});

// ── FOOD-02: custom food validation + creation ──────────────────────────────────

describe('validateCustomFood (FOOD-02)', () => {
  it('rejects a blank name', () => {
    expect(validateCustomFood({ name: '   ', thresholdMinutes: 120 }).ok).toBe(false);
  });

  it('rejects a threshold below 15 minutes', () => {
    expect(validateCustomFood({ name: 'Sopa', thresholdMinutes: 10 }).ok).toBe(false);
  });

  it('rejects a threshold above 72 hours', () => {
    expect(validateCustomFood({ name: 'Sopa', thresholdMinutes: 72 * 60 + 1 }).ok).toBe(false);
  });

  it('rejects a warning lead greater than or equal to threshold', () => {
    expect(
      validateCustomFood({ name: 'Sopa', thresholdMinutes: 120, warningLeadMinutes: 120 }).ok,
    ).toBe(false);
  });

  it('accepts a valid lightweight input', () => {
    expect(validateCustomFood({ name: 'Sopa', thresholdMinutes: 120 }).ok).toBe(true);
  });
});

describe('createCustomTrackedFood (FOOD-02, D-12)', () => {
  it('trims and collapses whitespace in the name', () => {
    const tracked = createCustomTrackedFood({ name: '  Sopa   de   pollo ', thresholdMinutes: 120 }, NOW);
    expect(tracked.name).toBe('Sopa de pollo');
  });

  it('stores only lightweight fields and marks the item enabled and custom', () => {
    const tracked = createCustomTrackedFood({ name: 'Sopa', thresholdMinutes: 120 }, NOW);
    expect(tracked.presetId).toBeNull();
    expect(tracked.enabled).toBe(true);
    expect(tracked.warningLeadMinutes).toBeLessThan(tracked.thresholdMinutes);
    expect(Object.keys(tracked).sort()).toEqual(
      ['category', 'createdAt', 'enabled', 'id', 'name', 'presetId', 'thresholdMinutes', 'warningLeadMinutes'].sort(),
    );
  });
});

// ── FOOD-04: timer classification + progress ────────────────────────────────────

describe('classifyFoodTimer (FOOD-04, D-17)', () => {
  const it120w30 = item({ thresholdMinutes: 120, warningLeadMinutes: 30 });

  it('is safe before the warning lead window', () => {
    expect(classifyFoodTimer(it120w30, NOW, minutesAfter(NOW, 60))).toBe('safe');
  });

  it('is warning inside the lead window (early, before threshold)', () => {
    expect(classifyFoodTimer(it120w30, NOW, minutesAfter(NOW, 100))).toBe('warning');
  });

  it('is expired at or after the threshold', () => {
    expect(classifyFoodTimer(it120w30, NOW, minutesAfter(NOW, 120))).toBe('expired');
    expect(classifyFoodTimer(it120w30, NOW, minutesAfter(NOW, 200))).toBe('expired');
  });
});

describe('getFoodTimerProgress (FOOD-04)', () => {
  it('reports elapsed, remaining, clamped percent, and level', () => {
    const p = getFoodTimerProgress(item({ thresholdMinutes: 120, warningLeadMinutes: 30 }), NOW, minutesAfter(NOW, 60));
    expect(p.elapsedMinutes).toBeCloseTo(60);
    expect(p.remainingMinutes).toBeCloseTo(60);
    expect(p.percent).toBeCloseTo(50);
    expect(p.level).toBe('safe');
  });

  it('clamps percent to 100 and remaining to 0 past threshold', () => {
    const p = getFoodTimerProgress(item({ thresholdMinutes: 120 }), NOW, minutesAfter(NOW, 300));
    expect(p.percent).toBe(100);
    expect(p.remainingMinutes).toBe(0);
    expect(p.level).toBe('expired');
  });
});

// ── D-06/D-13: MMKV persistence helpers ─────────────────────────────────────────

describe('tracked food MMKV helpers (D-06, D-13)', () => {
  it('returns [] when nothing is stored', () => {
    expect(readTrackedFoodItems()).toEqual([]);
  });

  it('round-trips items via write/read', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })];
    writeTrackedFoodItems(items);
    expect(readTrackedFoodItems().map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('upsert appends a new item and replaces an existing one by id', () => {
    upsertTrackedFoodItem(item({ id: 'a', name: 'Leche' }));
    upsertTrackedFoodItem(item({ id: 'b', name: 'Queso' }));
    expect(readTrackedFoodItems()).toHaveLength(2);

    upsertTrackedFoodItem(item({ id: 'a', name: 'Leche descremada' }));
    const after = readTrackedFoodItems();
    expect(after).toHaveLength(2);
    expect(after.find((i) => i.id === 'a')?.name).toBe('Leche descremada');
  });

  it('removeTrackedFoodItem removes by id quickly', () => {
    writeTrackedFoodItems([item({ id: 'a' }), item({ id: 'b' })]);
    removeTrackedFoodItem('a');
    expect(readTrackedFoodItems().map((i) => i.id)).toEqual(['b']);
  });

  it('resetTrackedFoodItems clears all items', () => {
    writeTrackedFoodItems([item({ id: 'a' }), item({ id: 'b' })]);
    resetTrackedFoodItems();
    expect(readTrackedFoodItems()).toEqual([]);
  });

  it('returns [] on invalid stored JSON without throwing (T-04-01-01)', () => {
    storage.set(STORAGE_KEYS.foodTrackedItems, '{ not valid json ');
    expect(() => readTrackedFoodItems()).not.toThrow();
    expect(readTrackedFoodItems()).toEqual([]);
  });

  it('drops malformed entries that are not valid tracked items', () => {
    storage.set(
      STORAGE_KEYS.foodTrackedItems,
      JSON.stringify([{ id: 'ok', thresholdMinutes: 120 }, { bogus: true }, null]),
    );
    const items = readTrackedFoodItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('ok');
  });
});
