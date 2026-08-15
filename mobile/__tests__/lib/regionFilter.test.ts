/**
 * Tests for mobile/lib/regions.ts — filterSections() + REGIONS registry
 * Covers: 25 region keys (17 original + 8 state capitals added 2026-08-15),
 * state grouping, search filtering
 */

import { filterSections, REGIONS, ZONE_SECTIONS } from '../../lib/regions';

// ── REGIONS registry ───────────────────────────────────────────────────────────

describe('REGIONS', () => {
  it('contains exactly 25 regions', () => {
    expect(Object.keys(REGIONS)).toHaveLength(25);
  });

  it('contains ciudad_guayana', () => {
    expect(REGIONS.ciudad_guayana).toBeDefined();
    expect(REGIONS.ciudad_guayana.display_name).toBe('Ciudad Guayana (Bolívar)');
  });

  it('contains guarenas_guatire', () => {
    expect(REGIONS.guarenas_guatire).toBeDefined();
    expect(REGIONS.guarenas_guatire.state).toBe('Miranda');
  });

  it('has los_teques in Miranda state', () => {
    expect(REGIONS.los_teques.state).toBe('Miranda');
  });

  it('has correct coordinates for maracaibo', () => {
    expect(REGIONS.maracaibo.lat).toBeCloseTo(10.6427);
    expect(REGIONS.maracaibo.lon).toBeCloseTo(-71.6125);
  });

  it('covers the 8 state-capital regions added 2026-08-15', () => {
    const added = [
      'guanare', 'san_felipe', 'san_carlos', 'san_juan_de_los_morros',
      'san_fernando_de_apure', 'puerto_ayacucho', 'tucupita', 'la_guaira',
    ];
    for (const key of added) {
      expect(REGIONS[key]).toBeDefined();
      expect(REGIONS[key].state).toBeTruthy();
    }
    expect(REGIONS.guanare.state).toBe('Portuguesa');
    expect(REGIONS.la_guaira.state).toBe('La Guaira');
  });

  it('contains all 25 expected keys', () => {
    const expectedKeys = [
      'maracaibo', 'san_cristobal', 'merida', 'valera', 'barquisimeto',
      'punto_fijo', 'valencia', 'maracay', 'caracas', 'los_teques',
      'guarenas_guatire', 'barinas', 'maturin', 'barcelona', 'cumana',
      'porlamar', 'ciudad_guayana',
      'guanare', 'san_felipe', 'san_carlos', 'san_juan_de_los_morros',
      'san_fernando_de_apure', 'puerto_ayacucho', 'tucupita', 'la_guaira',
    ];
    for (const key of expectedKeys) {
      expect(REGIONS[key]).toBeDefined();
    }
  });

  it('every region has display_name, state, lat, lon', () => {
    for (const [key, meta] of Object.entries(REGIONS)) {
      expect(typeof meta.display_name).toBe('string');
      expect(typeof meta.state).toBe('string');
      expect(typeof meta.lat).toBe('number');
      expect(typeof meta.lon).toBe('number');
    }
  });
});

// ── ZONE_SECTIONS ──────────────────────────────────────────────────────────────

describe('ZONE_SECTIONS', () => {
  it('Miranda section contains both los_teques and guarenas_guatire', () => {
    const miranda = ZONE_SECTIONS.find(s => s.title === 'Miranda');
    expect(miranda).toBeDefined();
    expect(miranda?.data).toContain('los_teques');
    expect(miranda?.data).toContain('guarenas_guatire');
  });

  it('covers all 25 region keys', () => {
    const allKeys = ZONE_SECTIONS.flatMap(s => s.data);
    expect(allKeys).toHaveLength(25);
  });
});

// ── filterSections() ───────────────────────────────────────────────────────────

describe('filterSections', () => {
  it("returns both maracaibo and maracay for query 'mara'", () => {
    const result = filterSections('mara');
    const allKeys = result.flatMap(s => s.data);
    expect(allKeys).toContain('maracaibo');
    expect(allKeys).toContain('maracay');
  });

  it("returns [] for query 'zzz' (no match)", () => {
    const result = filterSections('zzz');
    expect(result).toHaveLength(0);
  });

  it('returns all sections for an empty query', () => {
    const result = filterSections('');
    expect(result.length).toBe(ZONE_SECTIONS.length);
  });

  it('is case-insensitive', () => {
    const lower = filterSections('caracas');
    const upper = filterSections('CARACAS');
    expect(lower.flatMap(s => s.data)).toContain('caracas');
    expect(upper.flatMap(s => s.data)).toContain('caracas');
  });

  it('drops sections with no matching zones', () => {
    // 'maracaibo' matches only Zulia section
    const result = filterSections('maracaibo');
    const sectionTitles = result.map(s => s.title);
    expect(sectionTitles).toContain('Zulia');
    // Should NOT have sections where no item matches
    expect(result.every(s => s.data.length > 0)).toBe(true);
  });

  it('matches by state name — "miranda" returns both Miranda zones', () => {
    const result = filterSections('miranda');
    const allKeys = result.flatMap(s => s.data);
    expect(allKeys).toContain('los_teques');
    expect(allKeys).toContain('guarenas_guatire');
  });

  it("returns exactly maracaibo for query 'maracaibo'", () => {
    const result = filterSections('maracaibo');
    const allKeys = result.flatMap(s => s.data);
    expect(allKeys).toContain('maracaibo');
    // maracay should NOT appear (query is specific)
    expect(allKeys).not.toContain('maracay');
  });
});
