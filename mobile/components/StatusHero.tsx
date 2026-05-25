import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { getLocales } from 'expo-localization';
import { statusColor, statusLabel } from '@/lib/theme';
import { formatDuration } from '@/lib/i18n';
import { useTheme } from '@/hooks/useTheme';
import type { OutageInfo } from '@/lib/api';
import type { Lang } from '@/lib/i18n';

// ── detectLang ─────────────────────────────────────────────────────────────────
function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

// ── StatusHeroProps ────────────────────────────────────────────────────────────
interface StatusHeroProps {
  /** Pipeline status string: 'no_power' | 'power_back' | 'unstable' | 'normal' | 'no_data' */
  status: string;
  /** Outage info from RegionEntry — only present when an active outage exists. */
  outage?: OutageInfo;
  /** True when data is loading and no cached region exists — shows shimmer. */
  isLoading?: boolean;
}

// ── StatusHero ─────────────────────────────────────────────────────────────────
// Hero status block — large color-coded block for the selected zone's power status.
// Spec: UI-SPEC D-12, STAT-01 (status display), STAT-02 (duration).
//
// Background: statusColor(status, theme) — danger/ok/warn/inkFaint
// Status label: Display 48sp bold, always #FFFFFF (contrast guaranteed by color choice)
// Duration: shown only when outage?.started_at exists — uses elapsed_minutes from API
// Loading: shimmer animation (opacity 0.5→1.0→0.5, 1200ms) when isLoading=true
// AccessibilityLabel: "Estado: {statusLabel}. Sin luz hace {duration}."
// StyleSheet.create (D-04)
export default function StatusHero({ status, outage, isLoading = false }: StatusHeroProps) {
  const { theme } = useTheme();
  const lang      = detectLang();

  // ── shimmer animation ──────────────────────────────────────────────────────
  // Opacity pulse 0.5→1.0→0.5 loop, 1200ms, ease-in-out (UI-SPEC Skeleton states)
  const shimmerOpacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (!isLoading) {
      shimmerOpacity.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue:         1.0,
          duration:        600,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue:         0.5,
          duration:        600,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isLoading, shimmerOpacity]);

  const bgColor  = isLoading ? theme.panel : statusColor(status, theme);
  const label    = statusLabel(status, lang);
  const duration = outage?.started_at ? formatDuration(outage.elapsed_minutes, lang) : null;

  // ── accessibilityLabel ────────────────────────────────────────────────────
  // UI-SPEC: "Estado: {statusLabel}. Sin luz hace {duration}."
  const a11yLabel = duration
    ? `Estado: ${label}. Sin luz hace ${duration}.`
    : `Estado: ${label}.`;

  const styles = createStyles(theme, bgColor);

  return (
    <Animated.View
      style={[styles.hero, isLoading && { opacity: shimmerOpacity }]}
      accessibilityLabel={a11yLabel}
      accessibilityRole="none"
    >
      {!isLoading && (
        <>
          {/* ── status label: Display 48sp bold, #FFFFFF always (UI-SPEC contrast) */}
          <Text style={styles.statusText}>{label}</Text>

          {/* ── duration: shown only when outage.started_at exists (STAT-02) */}
          {duration !== null && (
            <Text style={styles.durationText}>{duration}</Text>
          )}
        </>
      )}
    </Animated.View>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────
// StyleSheet.create() — D-04: no inline layout style objects.
// Spacing follows UI-SPEC Spacing Scale (lg=24, md=16).
function createStyles(theme: ReturnType<typeof useTheme>['theme'], bgColor: string) {
  return StyleSheet.create({
    hero: {
      minHeight:       120, // UI-SPEC: min 120dp for sunlight readability
      width:           '100%',
      backgroundColor: bgColor,
      alignItems:      'center',
      justifyContent:  'center',
      paddingVertical: 24, // lg
    },

    // ── status label: Display 48sp bold, always white on colored hero ────────
    // UI-SPEC contrast rule: use #FFFFFF regardless of theme (color choice guarantees contrast).
    statusText: {
      fontSize:   48,       // Display (UI-SPEC Typography)
      fontWeight: '700',    // bold
      color:      '#FFFFFF', // always white — contrast guaranteed by status color choice
      lineHeight: 52,       // 1.1 × 48sp (UI-SPEC Typography)
      textAlign:  'center',
    },

    // ── duration line: Body 16sp, rgba(255,255,255,0.80) (UI-SPEC) ──────────
    // Shown only when outage.started_at exists (STAT-02).
    durationText: {
      fontSize:   16,                         // Body (UI-SPEC Typography)
      fontWeight: '400',
      color:      'rgba(255,255,255,0.80)',   // UI-SPEC: 80% opacity white
      marginTop:  8,                          // sm
      textAlign:  'center',
    },
  });
}
