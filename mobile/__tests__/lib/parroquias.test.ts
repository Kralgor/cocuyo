const parroquias = require('../../assets/parroquias.json');
const contacts = require('../../assets/contacts.json');

import { REGIONS } from '../../lib/regions';
import { getMunicipios, getParroquias } from '../../lib/parroquias';

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

describe('parroquia and contacts assets', () => {
  it('covers most states represented by REGIONS (thin states fall back to region)', () => {
    const expectedStates = new Set(Object.values(REGIONS).map(region => normalize(region.state)));
    const assetStates = new Set(parroquias.map((entry: { estado: string }) => normalize(entry.estado)));

    // The dataset covers the urban-core municipios of every region state.
    // States without a parroquia anexo on Wikipedia (Mérida, Apure) fall back
    // to region-level reporting — reports are never lost, just coarser.
    const uncovered = new Set(['merida', 'apure']);
    for (const state of expectedStates) {
      expect(assetStates.has(state) || uncovered.has(state)).toBe(true);
    }
  });

  it('contains Maracaibo and Caracas parish data', () => {
    expect(getMunicipios('maracaibo')).toContain('Maracaibo (Zulia)');
    expect(getParroquias('maracaibo', 'Maracaibo (Zulia)')).toContain('Bolívar');
    expect(getMunicipios('caracas')).toContain('Libertador');
    expect(getParroquias('caracas', 'Libertador')).toContain('La Candelaria (Caracas)');
  });

  it('resolves urban-core municipios for Lara and Aragua', () => {
    expect(getMunicipios('barquisimeto')).toContain('Iribarren');
    expect(getParroquias('barquisimeto', 'Iribarren')).toContain('Catedral');
    expect(getMunicipios('maracay')).toContain('Girardot');
    expect(getParroquias('maracay', 'Girardot')).toContain('Las Delicias');
  });

  it('includes verified national emergency contacts and unverified state scaffolds', () => {
    const national = contacts.find((entry: { state: string }) => entry.state === 'national');
    expect(national.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ number: '911', verified: true })]),
    );

    const zulia = contacts.find((entry: { state: string }) => entry.state === 'Zulia');
    expect(zulia.entries).toEqual(expect.arrayContaining([expect.objectContaining({ verified: false })]));
  });
});
