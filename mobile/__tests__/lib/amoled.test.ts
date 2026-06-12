import { AMOLED_THEME } from '../../constants/colors';
import { useBattery } from '../../hooks/useBattery';

describe('AMOLED battery mode', () => {
  it('defines a true-black AMOLED theme variant', () => {
    expect(AMOLED_THEME.bg).toBe('#000000');
    expect(AMOLED_THEME.surface).toBe('#000000');
    expect(AMOLED_THEME.text).toBeTruthy();
  });

  it('exposes low-battery state from the battery hook', () => {
    const state = useBattery();

    expect(state).toMatchObject({
      level: expect.any(Number),
      isLowPower: expect.any(Boolean),
    });
  });
});
