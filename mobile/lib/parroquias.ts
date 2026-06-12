import parroquiaData from '../assets/parroquias.json';

import { REGIONS } from './regions';

export interface ParroquiaDataset {
  estado: string;
  municipios: {
    municipio: string;
    parroquias: string[];
  }[];
}

const data = parroquiaData as ParroquiaDataset[];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function findDataset(regionKey: string): ParroquiaDataset | undefined {
  const state = REGIONS[regionKey]?.state;
  if (!state) return undefined;

  const normalizedState = normalize(state);
  return data.find(entry => normalize(entry.estado) === normalizedState);
}

export function getMunicipios(regionKey: string): string[] {
  return findDataset(regionKey)?.municipios.map(entry => entry.municipio) ?? [];
}

export function getParroquias(regionKey: string, municipio: string): string[] {
  const dataset = findDataset(regionKey);
  if (!dataset) return [];

  const normalizedMunicipio = normalize(municipio);
  return dataset.municipios.find(entry => normalize(entry.municipio) === normalizedMunicipio)?.parroquias ?? [];
}
