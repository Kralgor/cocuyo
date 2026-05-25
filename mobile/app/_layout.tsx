import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from '@/lib/query';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { ThemeProvider } from '@/contexts/ThemeContext';

// ── splash screen ──────────────────────────────────────────────────────────────
// Call preventAutoHideAsync at module level so the splash stays visible until
// PersistQueryClientProvider's onSuccess callback fires (RESEARCH.md Pitfall 3).
// Do NOT call hideAsync() in useEffect — that fires before cache restore.
SplashScreen.preventAutoHideAsync();

// ── resolveInitialRoute ────────────────────────────────────────────────────────
// Pure helper for determining initial route from MMKV guard values.
// Extracted so it can be unit-tested without rendering native navigation (TRST-01).
// Used by the Stack.Protected guards below — each guard maps to one route.
export type InitialRoute = 'onboarding' | 'zone-picker' | 'tabs';

export function resolveInitialRoute(
  hasSeenOnboarding: boolean,
  selectedZone: string | null,
): InitialRoute {
  if (!hasSeenOnboarding) return 'onboarding';
  if (!selectedZone) return 'zone-picker';
  return 'tabs';
}

// ── RootLayout ─────────────────────────────────────────────────────────────────
// Root layout: wraps the entire app in PersistQueryClientProvider and ThemeProvider.
// Stack.Protected provides declarative routing — no manual router.replace() calls.
// Guards read MMKV synchronously in render body (Pitfall 2 — no useState/await).
export default function RootLayout() {
  // ── MMKV guards — synchronous reads, no await needed (RESEARCH.md Pitfall 2) ──
  const hasSeenOnboarding: boolean =
    storage.getBoolean(STORAGE_KEYS.hasSeenOnboarding) ?? false;
  const selectedZone: string | null =
    storage.getString(STORAGE_KEYS.selectedZone) ?? null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h — matches queryClient gcTime
      }}
      onSuccess={() => {
        // Hide splash screen after persister restores cached data (Pitfall 3).
        // Firing here guarantees the cache is ready before the UI renders.
        SplashScreen.hideAsync();
      }}
    >
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Onboarding: shown only when trust screen has not been seen */}
          <Stack.Protected guard={!hasSeenOnboarding}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>

          {/* Zone picker: shown after onboarding, before zone is selected */}
          <Stack.Protected guard={hasSeenOnboarding && !selectedZone}>
            <Stack.Screen name="zone-picker" />
          </Stack.Protected>

          {/* Main tabs: shown when onboarding is done and a zone is selected */}
          <Stack.Protected guard={hasSeenOnboarding && !!selectedZone}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
