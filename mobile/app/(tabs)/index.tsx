import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocales } from 'expo-localization';
import { useStatus }   from '@/hooks/useStatus';
import { useOffline }  from '@/hooks/useOffline';
import { useTheme }    from '@/hooks/useTheme';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { tt }          from '@/lib/i18n';
import StatusHero    from '@/components/StatusHero';
import StaleBanner   from '@/components/StaleBanner';
import SignalCard    from '@/components/SignalCard';
import SettingsModal from '@/components/SettingsModal';
import type { Lang } from '@/lib/i18n';
import type { MobileTheme } from '@/lib/theme';
import { Pressable } from 'react-native';

// ── detectLang ─────────────────────────────────────────────────────────────────
function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

// ── ZoneScreen ─────────────────────────────────────────────────────────────────
// Zone detail / home screen — displays the selected zone's live or cached status.
// Spec: UI-SPEC Zone Detail screen (D-12), STAT-01 (status), STAT-02 (duration),
//       STAT-03 (offline staleness banner), D-13 (banner), D-14 (skeleton/error).
//
// Layout (top to bottom):
//   A. Header row: zone name (left) + gear icon (right → SettingsModal)
//   B. StaleBanner: shown when isOffline || isStale (STAT-03)
//   C. StatusHero: zone status + duration (STAT-01/02, D-12)
//   D. Signal cards: Internet / Reportes / Satélite
//   E. Last-updated row: hidden when banner is visible (redundant)
//
// States (D-14):
//   - isLoading && no cached region → skeleton shimmer via StatusHero isLoading prop
//   - isError && no region (first-fetch fail, no cache) → "Sin datos aún" copy
//   - region missing from loaded status → "Sin datos para esta zona" copy
//   - Loaded: full content
//
// Pull-to-refresh: RefreshControl → useStatus().refetch
// Settings: local boolean state → <SettingsModal visible /> at screen root
// StyleSheet.create (D-04)
export default function ZoneScreen() {
  const { theme }                    = useTheme();
  const lang                         = detectLang();
  const { data, isLoading, isError, refetch } = useStatus();
  const { isOffline, isStale, hasCache, ageMinutes } = useOffline();
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [refreshing,   setRefreshing]         = useState(false);

  // ── selectedZone ──────────────────────────────────────────────────────────
  // Read from MMKV synchronously (set by zone-picker on first launch or settings).
  // Stack.Protected ensures this screen is only rendered when selectedZone is set.
  const selectedZone = storage.getString(STORAGE_KEYS.selectedZone) ?? '';
  const region       = data?.regions?.[selectedZone];

  // ── pull-to-refresh ───────────────────────────────────────────────────────
  async function handleRefresh() {
    setRefreshing(true);
    // try/finally — refetch() rejects when the query errors after retries;
    // without finally the spinner sticks on failure (WR-03).
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const styles     = createStyles(theme);
  // Gate on hasCache: before any successful fetch there is no real "last update"
  // to report, so a stale/offline banner would show epoch-scale age (CR-02).
  // First-launch-no-data is handled by showFirstError below.
  const showBanner = (isOffline || isStale) && hasCache;

  // ── state: skeleton / error / loaded ─────────────────────────────────────
  const showSkeleton    = isLoading && !region;
  const showFirstError  = isError   && !region;
  const showNoZoneData  = !isLoading && !isError && data && !region;

  return (
    <View style={styles.root}>
      {/* ── A. Header row ─────────────────────────────────────────────────── */}
      {/* 48dp height, zone name left, gear right (UI-SPEC D-12 header A) */}
      <View style={styles.header}>
        <Text style={styles.headerZone} numberOfLines={1}>
          {region?.display_name ?? selectedZone}
        </Text>
        <Pressable
          onPress={() => setSettingsOpen(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={tt('open_settings', lang)}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color={theme.inkDim}
          />
        </Pressable>
      </View>

      {/* ── B. Staleness banner (D-13, STAT-03) ──────────────────────────── */}
      {/* Shown when isOffline || isStale — non-dismissible (no X, no onPress) */}
      {showBanner && <StaleBanner ageMinutes={ageMinutes} />}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {/* ── C. Hero status block (D-12, STAT-01/02) ──────────────────── */}
        {/* Skeleton: isLoading && no region — shimmer animation (D-14) */}
        {/* Error: first-fetch fail, no cache — "Sin datos aún" copy (D-14) */}
        {showFirstError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {tt('no_data_first_launch', lang)}
            </Text>
          </View>
        ) : showNoZoneData ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {tt('no_data_zone', lang)}
            </Text>
          </View>
        ) : (
          <StatusHero
            status={region?.status ?? 'no_data'}
            outage={region?.outage}
            isLoading={showSkeleton}
          />
        )}

        {/* ── D. Signal breakdown cards (UI-SPEC D-12 section D) ───────── */}
        {/* Shown when region data is available (not skeleton, not error) */}
        {region && !showSkeleton && (
          <View style={styles.signalSection}>
            <SignalCard
              labelKey="signal_int"
              value={region.signals.internet}
            />
            <SignalCard
              labelKey="signal_crowd"
              value={region.signals.crowdsource}
            />
            <SignalCard
              labelKey="signal_sat"
              value={region.signals.satellite}
            />
          </View>
        )}

        {/* ── Skeleton signal placeholders ──────────────────────────────── */}
        {showSkeleton && (
          <View style={styles.signalSection}>
            <SkeletonCard theme={theme} />
            <SkeletonCard theme={theme} />
            <SkeletonCard theme={theme} />
          </View>
        )}

        {/* ── E. Last-updated row — hidden when banner is visible (redundant) */}
        {/* UI-SPEC: "Not shown when staleness banner is visible" */}
        {!showBanner && !showSkeleton && !showFirstError && !showNoZoneData && (
          <Text style={styles.lastUpdated}>
            {tt('last_updated', lang).replace('{N}', String(ageMinutes))}
          </Text>
        )}
      </ScrollView>

      {/* ── Settings modal — mounted at screen root, opened via gear icon ─── */}
      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </View>
  );
}

// ── SkeletonCard ───────────────────────────────────────────────────────────────
// Skeleton placeholder for signal cards while loading (D-14 shimmer).
// Panel color with pulsing opacity — reuses the same animation pattern.
function SkeletonCard({ theme }: { theme: MobileTheme }) {
  const opacity = React.useRef(new Animated.Value(0.5)).current;
  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        height:          72,
        borderRadius:    8,
        backgroundColor: theme.panel,
        marginBottom:    8,
        opacity,
      }}
    />
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────
// StyleSheet.create() — D-04: no inline layout style objects.
// Spacing: md=16dp, sm=8dp, xs=4dp (UI-SPEC Spacing Scale).
function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    root: {
      flex:            1,
      backgroundColor: theme.bg,
    },

    // ── A. Header row ─────────────────────────────────────────────────────────
    // 48dp height, md horizontal padding (UI-SPEC D-12 header A)
    header: {
      height:            48, // UI-SPEC header row height
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16, // md
      backgroundColor:   theme.bg,
    },
    headerZone: {
      flex:       1,
      fontSize:   20,      // Heading (UI-SPEC Typography)
      fontWeight: '700',
      color:      theme.ink,
      marginRight: 8,      // sm — gap before gear icon
    },

    // ── ScrollView ────────────────────────────────────────────────────────────
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 24, // lg — space at bottom of scroll
    },

    // ── signal cards section ──────────────────────────────────────────────────
    signalSection: {
      paddingHorizontal: 16, // md
      paddingTop:        16, // md — space between hero and cards
    },

    // ── error / empty states (D-14) ───────────────────────────────────────────
    errorContainer: {
      minHeight:         120, // same as hero block (visual consistency)
      alignItems:        'center',
      justifyContent:    'center',
      paddingHorizontal: 32, // xl — breathing room for multi-line text
      paddingVertical:   24, // lg
    },
    errorText: {
      fontSize:   16,         // Body (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.inkDim,
      textAlign:  'center',
      lineHeight: 24,         // 1.5 × 16sp
    },

    // ── E. Last-updated row ───────────────────────────────────────────────────
    // Label 13sp, inkFaint, centered — hidden when banner is visible (UI-SPEC D-12 E)
    lastUpdated: {
      fontSize:   13,          // Label (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.inkFaint,
      textAlign:  'center',
      marginTop:  16,          // md
      paddingHorizontal: 16,
    },
  });
}
