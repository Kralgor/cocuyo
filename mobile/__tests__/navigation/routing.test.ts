// Tests for resolveInitialRoute — the pure guard helper extracted from _layout.tsx.
// Unit-testable without rendering native navigation (TRST-01).
// Mocks for native modules that cannot run in Jest (no native bridge available).

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-router', () => ({
  Stack: {
    Protected: () => null,
    Screen: () => null,
  },
}));

jest.mock('@tanstack/react-query-persist-client', () => ({
  PersistQueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { resolveInitialRoute } from '../../app/_layout';
import type { InitialRoute } from '../../app/_layout';

describe('resolveInitialRoute', () => {
  // ── onboarding guard ─────────────────────────────────────────────────────────
  it('routes to onboarding when hasSeenOnboarding=false and zone=null', () => {
    const route: InitialRoute = resolveInitialRoute(false, null);
    expect(route).toBe('onboarding');
  });

  it('routes to onboarding when hasSeenOnboarding=false even if zone is set', () => {
    // Edge case: if somehow zone was stored but onboarding not seen, trust screen takes priority.
    const route: InitialRoute = resolveInitialRoute(false, 'caracas');
    expect(route).toBe('onboarding');
  });

  // ── zone-picker guard ─────────────────────────────────────────────────────────
  it('routes to zone-picker when hasSeenOnboarding=true and zone=null', () => {
    const route: InitialRoute = resolveInitialRoute(true, null);
    expect(route).toBe('zone-picker');
  });

  it('routes to zone-picker when hasSeenOnboarding=true and zone is empty string', () => {
    // Empty string is falsy — treated same as null
    const route: InitialRoute = resolveInitialRoute(true, '');
    expect(route).toBe('zone-picker');
  });

  // ── tabs guard ────────────────────────────────────────────────────────────────
  it('routes to tabs when hasSeenOnboarding=true and zone="caracas"', () => {
    const route: InitialRoute = resolveInitialRoute(true, 'caracas');
    expect(route).toBe('tabs');
  });

  it('routes to tabs when hasSeenOnboarding=true and zone="maracaibo"', () => {
    const route: InitialRoute = resolveInitialRoute(true, 'maracaibo');
    expect(route).toBe('tabs');
  });

  it('routes to tabs when hasSeenOnboarding=true and zone="ciudad_guayana"', () => {
    const route: InitialRoute = resolveInitialRoute(true, 'ciudad_guayana');
    expect(route).toBe('tabs');
  });
});
