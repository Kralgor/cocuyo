/**
 * Tests for mobile/lib/theme.ts — statusColor() and statusLabel()
 * Covers: pipeline status → theme color/label mapping
 */

import { statusColor, statusLabel } from '../../lib/theme';
import { LIGHT_THEME, DARK_THEME } from '../../constants/colors';

// ── statusColor() ──────────────────────────────────────────────────────────────

describe('statusColor', () => {
  describe('with LIGHT_THEME', () => {
    it("maps 'no_power' → theme.danger", () => {
      expect(statusColor('no_power', LIGHT_THEME)).toBe(LIGHT_THEME.danger);
    });

    it("maps 'unstable' → theme.warn", () => {
      expect(statusColor('unstable', LIGHT_THEME)).toBe(LIGHT_THEME.warn);
    });

    it("maps 'power_back' → theme.ok", () => {
      expect(statusColor('power_back', LIGHT_THEME)).toBe(LIGHT_THEME.ok);
    });

    it("maps 'normal' → theme.ok", () => {
      expect(statusColor('normal', LIGHT_THEME)).toBe(LIGHT_THEME.ok);
    });

    it("maps 'no_data' → theme.inkFaint", () => {
      expect(statusColor('no_data', LIGHT_THEME)).toBe(LIGHT_THEME.inkFaint);
    });

    it("maps unknown status → theme.inkFaint", () => {
      expect(statusColor('__unknown__', LIGHT_THEME)).toBe(LIGHT_THEME.inkFaint);
    });
  });

  describe('with DARK_THEME', () => {
    it("maps 'no_power' → theme.danger", () => {
      expect(statusColor('no_power', DARK_THEME)).toBe(DARK_THEME.danger);
    });

    it("maps 'unstable' → theme.warn", () => {
      expect(statusColor('unstable', DARK_THEME)).toBe(DARK_THEME.warn);
    });

    it("maps 'power_back' → theme.ok", () => {
      expect(statusColor('power_back', DARK_THEME)).toBe(DARK_THEME.ok);
    });
  });
});

// ── statusLabel() ──────────────────────────────────────────────────────────────

describe('statusLabel', () => {
  it("returns 'SIN LUZ' for 'no_power' in ES", () => {
    expect(statusLabel('no_power', 'es')).toBe('SIN LUZ');
  });

  it("returns 'NO POWER' for 'no_power' in EN", () => {
    expect(statusLabel('no_power', 'en')).toBe('NO POWER');
  });

  it("returns 'POWER ON' for 'power_back' in EN", () => {
    expect(statusLabel('power_back', 'en')).toBe('POWER ON');
  });

  it("returns 'CON LUZ' for 'power_back' in ES", () => {
    expect(statusLabel('power_back', 'es')).toBe('CON LUZ');
  });

  it("returns 'INESTABLE' for 'unstable' in ES", () => {
    expect(statusLabel('unstable', 'es')).toBe('INESTABLE');
  });

  it("returns 'UNSTABLE' for 'unstable' in EN", () => {
    expect(statusLabel('unstable', 'en')).toBe('UNSTABLE');
  });

  it("returns 'NORMAL' for 'normal' in both ES and EN", () => {
    expect(statusLabel('normal', 'es')).toBe('NORMAL');
    expect(statusLabel('normal', 'en')).toBe('NORMAL');
  });

  it("returns 'SIN DATOS' for 'no_data' in ES", () => {
    expect(statusLabel('no_data', 'es')).toBe('SIN DATOS');
  });

  it("returns uppercased status for unknown values", () => {
    expect(statusLabel('__unknown__', 'es')).toBe('__UNKNOWN__');
  });
});
