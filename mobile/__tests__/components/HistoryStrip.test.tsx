/**
 * Render tests for mobile/components/HistoryStrip.tsx
 * Covers: STAT-04 — 30-day outage strip chart renders without crashing
 * (empty data, zero-outage days, zero-duration blocks).
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import HistoryStrip from '../../components/HistoryStrip';
import type { HistoryDay } from '../../lib/history';

function renderStrip(days: HistoryDay[]) {
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(React.createElement(HistoryStrip, { days }));
  });
  return renderer!.toJSON();
}

describe('HistoryStrip', () => {
  it('renders without crashing when days=[] (empty array)', () => {
    const tree = renderStrip([]);
    expect(tree).toBeTruthy();
  });

  it('renders without crashing when days has 30 entries with zero outages', () => {
    const days: HistoryDay[] = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      outages: [],
    }));
    const tree = renderStrip(days);
    expect(tree).toBeTruthy();
  });

  it('does not crash when an OutageBlock has duration_h=0', () => {
    const days: HistoryDay[] = [
      { date: '2026-06-22', outages: [{ start_hour: 14, duration_h: 0, type: 'no_power' }] },
    ];
    const tree = renderStrip(days);
    expect(tree).toBeTruthy();
  });

  it('renders outage rectangles for days with outages', () => {
    const days: HistoryDay[] = [
      { date: '2026-06-22', outages: [{ start_hour: 14, duration_h: 3, type: 'no_power' }] },
    ];
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(React.createElement(HistoryStrip, { days }));
    });
    const rects = renderer!.root.findAllByType('Rect');
    expect(rects.length).toBeGreaterThan(0);
  });
});
