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
