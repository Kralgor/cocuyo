// ── parroquia dataset (web) ───────────────────────────────────────────────────
// Mirrors pipeline/parroquias.py + mobile/assets/parroquias.json: the
// cascading state → municipio → parroquia lists used by the report flow.
// Served from app/public/parroquias.json (bundled with the static export).

export interface ParroquiaMunicipio {
  municipio: string;
  parroquias: string[];
}

export interface ParroquiaDataset {
  estado: string;
  municipios: ParroquiaMunicipio[];
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

let cache: ParroquiaDataset[] | null = null;

export async function loadParroquias(): Promise<ParroquiaDataset[]> {
  if (cache) return cache;
  const res = await fetch('/parroquias.json');
  if (!res.ok) return [];
  cache = await res.json() as ParroquiaDataset[];
  return cache;
}

export function findDataset(
  data: ParroquiaDataset[],
  state: string,
): ParroquiaDataset | undefined {
  return data.find(d => normalize(d.estado) === normalize(state));
}

export function getMunicipios(data: ParroquiaDataset[], state: string): string[] {
  return findDataset(data, state)?.municipios.map(m => m.municipio) ?? [];
}

export function getParroquias(
  data: ParroquiaDataset[],
  state: string,
  municipio: string,
): string[] {
  const dataset = findDataset(data, state);
  return dataset?.municipios.find(m => normalize(m.municipio) === normalize(municipio))?.parroquias ?? [];
}
