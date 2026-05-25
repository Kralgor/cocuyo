import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getLocales } from 'expo-localization';
import { tt } from '@/lib/i18n';
import { useTheme } from '@/hooks/useTheme';
import type { Lang } from '@/lib/i18n';
import type { MobileTheme } from '@/lib/theme';

// ── detectLang ─────────────────────────────────────────────────────────────────
function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

// ── SignalCardProps ────────────────────────────────────────────────────────────
interface SignalCardProps {
  /**
   * i18n key for the signal label — one of:
   *   'signal_int' (Internet), 'signal_crowd' (Reportes), 'signal_sat' (Satélite)
   */
  labelKey: string;
  /**
   * Signal strength 0.0–1.0, or null when the signal is unavailable.
   * null: bar is empty (track only), value shows "—"
   */
  value: number | null;
}

// ── SignalCard ─────────────────────────────────────────────────────────────────
// Individual signal breakdown card — Internet / Reportes / Satélite.
// Spec: UI-SPEC D-12 Signal breakdown cards (section D).
//
// Layout: panel bg, md padding (16dp), 8dp radius, sm gap between elements
// Label: Label 13sp, inkDim (signal name)
// Bar: full width minus padding, 8dp height, 4dp radius
//   — lineStrong track (full width)
//   — accent fill proportional to value (0.0–1.0) when value != null
//   — empty track only when value == null
// Value: Label 13sp, ink, right-aligned — "{N}%" when value!=null, "—" when null
// AccessibilityLabel: "{Signal name}: {value}%" or "{Signal name}: sin datos"
// StyleSheet.create (D-04)
export default function SignalCard({ labelKey, value }: SignalCardProps) {
  const { theme } = useTheme();
  const lang      = detectLang();

  const label     = tt(labelKey, lang);
  const valueText = value !== null ? `${Math.round(value * 100)}%` : '—';

  // ── fill width ─────────────────────────────────────────────────────────────
  // Bar fill is proportional to value (0.0–1.0 → 0%–100% of bar width).
  // When value is null, fill width is 0 (empty track only).
  const fillPercent: `${number}%` = value !== null
    ? `${Math.round(value * 100)}%`
    : '0%';

  // ── accessibilityLabel ────────────────────────────────────────────────────
  const a11yLabel = value !== null
    ? `${label}: ${valueText}`
    : lang === 'en'
      ? `${label}: no data`
      : `${label}: sin datos`;

  const styles = createStyles(theme);

  return (
    <View
      style={styles.card}
      accessibilityLabel={a11yLabel}
      accessibilityRole="none"
    >
      {/* ── label + value row ──────────────────────────────────────────────── */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{valueText}</Text>
      </View>

      {/* ── bar track + fill ──────────────────────────────────────────────── */}
      {/* Track: full width, 8dp height, 4dp radius, lineStrong bg (UI-SPEC) */}
      <View style={styles.track}>
        {/* Fill: accent color, proportional to value, 4dp radius (UI-SPEC) */}
        {value !== null && (
          <View style={[styles.fill, { width: fillPercent }]} />
        )}
      </View>
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────
// StyleSheet.create() — D-04: no inline layout style objects.
// Spacing: md=16dp padding, sm=8dp gap, xs=4dp bar radius (UI-SPEC Spacing Scale).
function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.panel, // panel surface (30% — UI-SPEC 60/30/10)
      borderRadius:    8,           // sm — UI-SPEC D-12 signal cards
      padding:         16,          // md — UI-SPEC Spacing Scale
      marginBottom:    8,           // sm — vertical spacing between stacked cards
    },

    // ── label + value row ─────────────────────────────────────────────────────
    labelRow: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'center',
      marginBottom:   8, // sm gap between label row and bar (UI-SPEC)
    },
    label: {
      fontSize:   13,         // Label (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.inkDim, // inkDim — signal card label (UI-SPEC D-12)
      lineHeight: 17,           // 1.3 × 13sp
    },
    value: {
      fontSize:   13,       // Label (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.ink, // ink — right-aligned value (UI-SPEC D-12)
      lineHeight: 17,
    },

    // ── bar track ─────────────────────────────────────────────────────────────
    // 8dp height, 4dp radius, lineStrong background (UI-SPEC D-12)
    track: {
      height:          8,              // UI-SPEC D-12
      borderRadius:    4,              // UI-SPEC D-12
      backgroundColor: theme.lineStrong, // lineStrong track (UI-SPEC)
      overflow:        'hidden',       // clip fill to track radius
    },

    // ── fill ──────────────────────────────────────────────────────────────────
    // accent color, full track height, width driven by value (percentage string)
    fill: {
      height:          '100%',
      backgroundColor: theme.accent, // accent fill — 10% usage (UI-SPEC 60/30/10)
      borderRadius:    4,
    },
  });
}
