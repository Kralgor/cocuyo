import { detectNearestZone, findNearestZone } from '../../lib/gps';

describe('gps zone detection', () => {
  it('maps Caracas coordinates to the caracas region key', () => {
    expect(findNearestZone(10.4806, -66.9036)).toBe('caracas');
  });

  it('maps Maracaibo coordinates to the maracaibo region key', () => {
    expect(findNearestZone(10.6427, -71.6125)).toBe('maracaibo');
  });

  it('returns null for coordinates outside Venezuela coverage', () => {
    expect(findNearestZone(40.7128, -74.006)).toBeNull();
  });

  it('detects the nearest zone through expo-location', async () => {
    await expect(detectNearestZone()).resolves.toBe('caracas');
  });
});
