/**
 * Tests for mobile/lib/i18n.ts
 * Covers: STAT-02 — duration formatting; tt() lookup; fallback behavior
 */

import { tt, formatDuration } from '../../lib/i18n';

// ── tt() tests ─────────────────────────────────────────────────────────────────

describe('tt', () => {
  it('returns the Spanish string for a known key in es', () => {
    expect(tt('comenzar', 'es')).toBe('Comenzar');
  });

  it('returns the English string for a known key in en', () => {
    expect(tt('comenzar', 'en')).toBe('Get started');
  });

  it('returns the key itself for an unknown key', () => {
    expect(tt('__unknown_key__', 'es')).toBe('__unknown_key__');
    expect(tt('__unknown_key__', 'en')).toBe('__unknown_key__');
  });

  it('defaults to Spanish when no lang is provided', () => {
    expect(tt('coming_soon')).toBe('Próximamente');
  });

  it('returns status labels for no_power in ES', () => {
    expect(tt('status_no_power', 'es')).toBe('SIN LUZ');
  });

  it('returns status labels for power_back in EN', () => {
    expect(tt('status_power_back', 'en')).toBe('POWER ON');
  });

  it('returns search_placeholder in ES', () => {
    expect(tt('search_placeholder', 'es')).toBe('Buscar zona…');
  });

  it('returns search_placeholder in EN', () => {
    expect(tt('search_placeholder', 'en')).toBe('Search zones…');
  });

  // ── food keys (Phase 4) ──────────────────────────────────────────────────
  it('returns Spanish food strings for known food keys', () => {
    expect(tt('food_title', 'es')).toBe('Comida sin luz');
    expect(tt('food_restored_h', 'es')).toBe('Volvio la luz');
    expect(tt('food_level_expired', 'es')).toBe('Paso el limite');
  });

  it('falls back to the key for an unknown food key', () => {
    expect(tt('food_does_not_exist', 'es')).toBe('food_does_not_exist');
  });

  it('food copy never declares food safe or claims fridge temperature', () => {
    const keys = [
      'food_restored_note',
      'food_level_safe',
      'food_level_warning',
      'food_level_expired',
      'food_caution_early',
    ];
    for (const k of keys) {
      const es = tt(k, 'es');
      expect(es.toLowerCase()).not.toContain('segura comer');
      expect(es.toLowerCase()).not.toContain('comida segura');
      expect(es).not.toMatch(/\d+\s?°/);
    }
  });

  it('new food strings stay ASCII-only (no accents introduced by this plan)', () => {
    const foodKeys = [
      'food_title', 'food_subtitle', 'food_no_zone', 'food_empty_tracked',
      'food_outage_prompt', 'food_stale_note', 'food_offline_note',
      'food_restored_h', 'food_restored_note', 'food_caution_early',
      'food_alerts_body', 'food_alerts_soon',
    ];
    for (const k of foodKeys) {
      // eslint-disable-next-line no-control-regex
      expect(tt(k, 'es')).toMatch(/^[\x00-\x7F]*$/);
    }
  });
});

// ── formatDuration() tests ─────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats hours and minutes in ES — 154 min → "2 h 34 min"', () => {
    expect(formatDuration(154, 'es')).toBe('2 h 34 min');
  });

  it('formats hours and minutes in EN — 154 min → "2h 34m"', () => {
    expect(formatDuration(154, 'en')).toBe('2h 34m');
  });

  it('formats minutes only (under 1h) in ES — 45 min → "45 min"', () => {
    expect(formatDuration(45, 'es')).toBe('45 min');
  });

  it('formats minutes only (under 1h) in EN — 45 min → "45 min"', () => {
    expect(formatDuration(45, 'en')).toBe('45 min');
  });

  it('returns "—" when min is null', () => {
    expect(formatDuration(null, 'es')).toBe('—');
    expect(formatDuration(null, 'en')).toBe('—');
  });

  it('handles exactly 60 min → "1 h 0 min" in ES', () => {
    expect(formatDuration(60, 'es')).toBe('1 h 0 min');
  });

  it('handles 0 min → "0 min"', () => {
    expect(formatDuration(0, 'es')).toBe('0 min');
  });
});
