import { REGIONS } from '../../lib/regions';
import { composeShareText } from '../../lib/share';

describe('composeShareText', () => {
  it('includes display name, status, duration, and Cocuyo source in Spanish', () => {
    const text = composeShareText(
      {
        ...REGIONS.maracaibo,
        status: 'no_power',
        outage: {
          type: 'outage',
          started_at: '2026-06-12T10:00:00Z',
          elapsed_minutes: 154,
          confidence: 'medium',
        },
      },
      'maracaibo',
      'es',
    );

    expect(text).toContain('*Maracaibo (Zulia)*');
    expect(text).toContain('Sin luz');
    expect(text).toContain('Sin luz hace 2 h 34 min');
    expect(text).toContain('Fuente: Cocuyo — https://app.cocuyo.kralgor.com');
  });

  it('omits ETA when no estimate is present', () => {
    const text = composeShareText({ ...REGIONS.caracas, status: 'no_power' }, 'caracas', 'es');

    expect(text).not.toContain('Estimado de regreso');
  });
});
