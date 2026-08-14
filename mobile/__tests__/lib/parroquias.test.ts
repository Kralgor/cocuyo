const parroquias = require('../../assets/parroquias.json');
const contacts = require('../../assets/contacts.json');

import { REGIONS } from '../../lib/regions';
import { getMunicipios, getParroquias } from '../../lib/parroquias';

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

describe('parroquia and contacts assets', () => {
  it('covers every state currently represented by REGIONS', () => {
    const expectedStates = new Set(Object.values(REGIONS).map(region => normalize(region.state)));
    const assetStates = new Set(parroquias.map((entry: { estado: string }) => normalize(entry.estado)));

    for (const state of expectedStates) {
      expect(assetStates.has(state)).toBe(true);
    }
  });

  it('contains Maracaibo and Caracas parish data', () => {
    expect(getMunicipios('maracaibo')).toContain('Maracaibo');
    expect(getParroquias('maracaibo', 'Maracaibo')).toContain('Bolivar');
    expect(getMunicipios('caracas')).toContain('Libertador');
    expect(getParroquias('caracas', 'Libertador')).toContain('Candelaria');
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
