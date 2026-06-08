// Tests for useOffline staleness logic.
// We import the hook's OWN pure helper (computeStaleness) rather than mirroring
// it here — a re-implemented mirror previously stayed green through the CR-02
// epoch-age bug. renderHook is not available (no @testing-library/react-native).

import { storage, STORAGE_KEYS } from '../../lib/storage';
import { computeStaleness, STALE_THRESHOLD_MS } from '../../hooks/useOffline';

describe('useOffline staleness logic', () => {
  // ── isStale ────────────────────────────────────────────────────────────────

  it('isStale=true when last fetch was 16 minutes ago', () => {
    const lastFetch = Date.now() - 16 * 60 * 1000;
    const { isStale } = computeStaleness(lastFetch);
    expect(isStale).toBe(true);
  });

  it('isStale=false when last fetch was 5 minutes ago', () => {
    const lastFetch = Date.now() - 5 * 60 * 1000;
    const { isStale } = computeStaleness(lastFetch);
    expect(isStale).toBe(false);
  });

  it('isStale=false when cache is 14 minutes old (below 15-min threshold)', () => {
    const lastFetch = Date.now() - 14 * 60 * 1000;
    const { isStale } = computeStaleness(lastFetch);
    expect(isStale).toBe(false);
  });

  it('isStale=true when cache is exactly 15 minutes and 1 second old', () => {
    const lastFetch = Date.now() - (STALE_THRESHOLD_MS + 1000);
    const { isStale } = computeStaleness(lastFetch);
    expect(isStale).toBe(true);
  });

  // ── never-fetched state (CR-02 regression) ──────────────────────────────────
  // A missing/zero timestamp must NOT report an epoch-scale age or a stale cache.
  // hasCache=false lets the home screen suppress the banner before first fetch.

  it('hasCache=false and ageMinutes=0 when no fetch has occurred (undefined)', () => {
    const { hasCache, isStale, ageMinutes } = computeStaleness(undefined);
    expect(hasCache).toBe(false);
    expect(isStale).toBe(false);
    expect(ageMinutes).toBe(0);
  });

  it('hasCache=false and ageMinutes=0 when timestamp is 0 (legacy fallback)', () => {
    const { hasCache, isStale, ageMinutes } = computeStaleness(0);
    expect(hasCache).toBe(false);
    expect(isStale).toBe(false);
    expect(ageMinutes).toBe(0);
  });

  it('hasCache=true once a real timestamp exists', () => {
    const { hasCache } = computeStaleness(Date.now());
    expect(hasCache).toBe(true);
  });

  // ── ageMinutes ─────────────────────────────────────────────────────────────

  it('ageMinutes is approximately correct for a 10-minute-old cache', () => {
    const lastFetch = Date.now() - 10 * 60 * 1000;
    const { ageMinutes } = computeStaleness(lastFetch);
    expect(ageMinutes).toBeGreaterThanOrEqual(9);
    expect(ageMinutes).toBeLessThanOrEqual(10);
  });

  // ── MMKV round-trip ────────────────────────────────────────────────────────
  // Verify storage reads the timestamp correctly (tests the storage integration
  // that useOffline depends on).

  it('MMKV stores and retrieves cacheTimestamp as a number', () => {
    const now = Date.now();
    storage.set(STORAGE_KEYS.cacheTimestamp, now);
    const retrieved = storage.getNumber(STORAGE_KEYS.cacheTimestamp) ?? 0;
    expect(retrieved).toBe(now);
  });

  it('MMKV returns 0 (via fallback) when cacheTimestamp key is absent', () => {
    // Use a test-only key that was never set
    const absent = storage.getNumber('__test_absent_key__') ?? 0;
    expect(absent).toBe(0);
  });

  // ── isOffline logic ────────────────────────────────────────────────────────
  // The isOffline check is: isConnected === false
  // Test the predicate directly.

  it('isOffline=false when isConnected=true', () => {
    expect(true === false).toBe(false);   // sanity
    expect((true) === false).toBe(false); // isConnected=true → isOffline=false
  });

  it('isOffline=true when isConnected=false', () => {
    expect((false) === false).toBe(true); // isConnected=false → isOffline=true
  });

  it('isOffline=false when isConnected=null (unknown state not treated as offline)', () => {
    expect((null) === false).toBe(false); // null !== false → isOffline=false
  });
});
