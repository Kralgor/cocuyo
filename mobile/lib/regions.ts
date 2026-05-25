// ── types ──────────────────────────────────────────────────────────────────────
export interface RegionMeta {
  display_name: string;
  state:        string;
  lat:          number;
  lon:          number;
}

// ── REGIONS ────────────────────────────────────────────────────────────────────
// Translated verbatim from pipeline/regions.py REGIONS dict.
// Keys are canonical region identifiers used in status.json — must match exactly.
// To add a region: add it to pipeline/regions.py first, then mirror here.
export const REGIONS: Record<string, RegionMeta> = {
  maracaibo: {
    display_name: 'Maracaibo (Zulia)',
    state:        'Zulia',
    lat:          10.6427,
    lon:          -71.6125,
  },
  san_cristobal: {
    display_name: 'San Cristóbal (Táchira)',
    state:        'Táchira',
    lat:          7.7669,
    lon:          -72.2311,
  },
  merida: {
    display_name: 'Mérida (Mérida)',
    state:        'Mérida',
    lat:          8.5897,
    lon:          -71.1440,
  },
  valera: {
    display_name: 'Valera (Trujillo)',
    state:        'Trujillo',
    lat:          9.3197,
    lon:          -70.6068,
  },
  barquisimeto: {
    display_name: 'Barquisimeto (Lara)',
    state:        'Lara',
    lat:          10.0647,
    lon:          -69.3571,
  },
  punto_fijo: {
    display_name: 'Punto Fijo (Falcón)',
    state:        'Falcón',
    lat:          11.7069,
    lon:          -70.2153,
  },
  valencia: {
    display_name: 'Valencia (Carabobo)',
    state:        'Carabobo',
    lat:          10.1579,
    lon:          -68.0075,
  },
  maracay: {
    display_name: 'Maracay (Aragua)',
    state:        'Aragua',
    lat:          10.2469,
    lon:          -67.5958,
  },
  caracas: {
    display_name: 'Caracas (Distrito Capital)',
    state:        'Distrito Capital',
    lat:          10.4806,
    lon:          -66.9036,
  },
  los_teques: {
    display_name: 'Los Teques (Miranda)',
    state:        'Miranda',
    lat:          10.3432,
    lon:          -67.0448,
  },
  guarenas_guatire: {
    display_name: 'Guarenas-Guatire (Miranda)',
    state:        'Miranda',
    lat:          10.4667,
    lon:          -66.5333,
  },
  barinas: {
    display_name: 'Barinas (Barinas)',
    state:        'Barinas',
    lat:          8.6226,
    lon:          -70.2075,
  },
  maturin: {
    display_name: 'Maturín (Monagas)',
    state:        'Monagas',
    lat:          9.7458,
    lon:          -63.1833,
  },
  barcelona: {
    display_name: 'Barcelona (Anzoátegui)',
    state:        'Anzoátegui',
    lat:          10.1337,
    lon:          -64.6864,
  },
  cumana: {
    display_name: 'Cumaná (Sucre)',
    state:        'Sucre',
    lat:          10.4631,
    lon:          -64.1731,
  },
  porlamar: {
    display_name: 'Porlamar (Nueva Esparta)',
    state:        'Nueva Esparta',
    lat:          10.9578,
    lon:          -63.8497,
  },
  ciudad_guayana: {
    display_name: 'Ciudad Guayana (Bolívar)',
    state:        'Bolívar',
    lat:          8.3667,
    lon:          -62.6500,
  },
};

// ── zone picker sections ───────────────────────────────────────────────────────
// 17 zones grouped by state for SectionList in ZonePicker.
// Miranda groups los_teques + guarenas_guatire (two zones, one state).
// Source: RESEARCH.md Pattern 6
export interface ZoneSection {
  title: string;
  data:  string[];
}

export const ZONE_SECTIONS: ZoneSection[] = [
  { title: 'Zulia',             data: ['maracaibo'] },
  { title: 'Táchira',          data: ['san_cristobal'] },
  { title: 'Mérida',           data: ['merida'] },
  { title: 'Trujillo',         data: ['valera'] },
  { title: 'Lara',             data: ['barquisimeto'] },
  { title: 'Falcón',           data: ['punto_fijo'] },
  { title: 'Carabobo',         data: ['valencia'] },
  { title: 'Aragua',           data: ['maracay'] },
  { title: 'Distrito Capital',  data: ['caracas'] },
  { title: 'Miranda',           data: ['los_teques', 'guarenas_guatire'] },
  { title: 'Barinas',          data: ['barinas'] },
  { title: 'Monagas',          data: ['maturin'] },
  { title: 'Anzoátegui',       data: ['barcelona'] },
  { title: 'Sucre',            data: ['cumana'] },
  { title: 'Nueva Esparta',    data: ['porlamar'] },
  { title: 'Bolívar',          data: ['ciudad_guayana'] },
];

// ── filterSections ─────────────────────────────────────────────────────────────
// Filters ZONE_SECTIONS by query string (case-insensitive).
// Matches against zone display_name and state name.
// Removes sections with no matching zones.
// Returns all sections when query is empty.
export function filterSections(query: string): ZoneSection[] {
  if (!query) return ZONE_SECTIONS;
  const q = query.toLowerCase();
  return ZONE_SECTIONS
    .map(section => ({
      ...section,
      data: section.data.filter(key => {
        const meta = REGIONS[key];
        if (!meta) return false;
        return (
          meta.display_name.toLowerCase().includes(q) ||
          meta.state.toLowerCase().includes(q)
        );
      }),
    }))
    .filter(section => section.data.length > 0);
}
