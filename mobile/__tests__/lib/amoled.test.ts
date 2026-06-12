import { AMOLED_THEME } from '../../constants/colors';
import { useBattery } from '../../hooks/useBattery';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

describe('AMOLED battery mode', () => {
  it('defines a true-black AMOLED theme variant', () => {
    expect(AMOLED_THEME.bg).toBe('#000000');
    expect(AMOLED_THEME.surface).toBe('#000000');
    expect(AMOLED_THEME.text).toBeTruthy();
  });

  it('exposes low-battery state from the battery hook', async () => {
    let state: ReturnType<typeof useBattery> | undefined;

    function Probe() {
      state = useBattery();
      return null;
    }

    await act(async () => {
      TestRenderer.create(React.createElement(Probe));
      await Promise.resolve();
    });

    expect(state).toMatchObject({
      level: expect.any(Number),
      isLowPower: expect.any(Boolean),
    });
  });
});
