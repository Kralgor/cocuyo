/**
 * Tests for mobile/lib/storage.ts
 * Covers: STAT-03 — MMKV storage round-trips; STORAGE_KEYS contract
 * MMKV mock provided by jest.setup.js (in-memory implementation)
 */

import { storage, STORAGE_KEYS } from '../../lib/storage';

// ── tests ──────────────────────────────────────────────────────────────────────

describe('storage', () => {
  it('round-trips a string value via set/getString', () => {
    storage.set(STORAGE_KEYS.selectedZone, 'maracaibo');
    expect(storage.getString(STORAGE_KEYS.selectedZone)).toBe('maracaibo');
  });

  it('round-trips a boolean value via set/getBoolean', () => {
    storage.set(STORAGE_KEYS.hasSeenOnboarding, true);
    expect(storage.getBoolean(STORAGE_KEYS.hasSeenOnboarding)).toBe(true);
  });

  it('round-trips a boolean false value', () => {
    storage.set(STORAGE_KEYS.hasSeenOnboarding, false);
    expect(storage.getBoolean(STORAGE_KEYS.hasSeenOnboarding)).toBe(false);
  });

  it('round-trips a number value via set/getNumber', () => {
    const ts = 1716638400000;
    storage.set(STORAGE_KEYS.cacheTimestamp, ts);
    expect(storage.getNumber(STORAGE_KEYS.cacheTimestamp)).toBe(ts);
  });

  it('returns undefined for a key that has not been set', () => {
    // Fresh in-memory mock — key never set in this call
    expect(storage.getString('__nonexistent_key__')).toBeUndefined();
    expect(storage.getBoolean('__nonexistent_bool__')).toBeUndefined();
    expect(storage.getNumber('__nonexistent_num__')).toBeUndefined();
  });
});

describe('STORAGE_KEYS', () => {
  it('has hasSeenOnboarding key', () => {
    expect(STORAGE_KEYS.hasSeenOnboarding).toBe('hasSeenOnboarding');
  });

  it('has selectedZone key', () => {
    expect(STORAGE_KEYS.selectedZone).toBe('selectedZone');
  });

  it('has themeOverride key', () => {
    expect(STORAGE_KEYS.themeOverride).toBe('themeOverride');
  });

  it('has cacheTimestamp key', () => {
    // Value is 'statusCacheTimestamp' per plan spec
    expect(STORAGE_KEYS.cacheTimestamp).toBe('statusCacheTimestamp');
  });
});
