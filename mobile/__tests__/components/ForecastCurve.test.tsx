/**
 * Render tests for mobile/components/ForecastCurve.tsx
 * Covers: STAT-04 — 48h risk forecast curve renders without crashing
 * (empty data, all-zero risk, all-max risk).
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import ForecastCurve from '../../components/ForecastCurve';
import type { ForecastPoint } from '../../lib/history';

function makePoints(risk: number, count = 96): ForecastPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    half_hour: i,
    hour: Math.floor(i / 2),
    risk,
  }));
}

function renderCurve(points: ForecastPoint[]) {
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(React.createElement(ForecastCurve, { forecast_48h: points }));
  });
  return renderer!.toJSON();
}

describe('ForecastCurve', () => {
  it('renders without crashing when forecast_48h=[] (empty array)', () => {
    const tree = renderCurve([]);
    expect(tree).toBeTruthy();
  });

  it('renders without crashing when all risk values are 0', () => {
    const tree = renderCurve(makePoints(0));
    expect(tree).toBeTruthy();
  });

  it('renders without crashing when all risk values are 1', () => {
    const tree = renderCurve(makePoints(1));
    expect(tree).toBeTruthy();
  });

  it('renders a path for the forecast line when data is present', () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(ForecastCurve, { forecast_48h: makePoints(0.5) }),
      );
    });
    const paths = renderer!.root.findAllByType('Path');
    expect(paths.length).toBeGreaterThan(0);
  });
});
