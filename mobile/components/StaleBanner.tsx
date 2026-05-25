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

// ── StaleBannerProps ───────────────────────────────────────────────────────────
interface StaleBannerProps {
  /** Minutes since last successful status fetch — displayed in the banner text. */
  ageMinutes: number;
}

// ── StaleBanner ────────────────────────────────────────────────────────────────
// Non-dismissible amber staleness banner — appears when isOffline || isStale.
// Spec: UI-SPEC D-13, STAT-03.
//
// Height: 40dp fixed, full width, no horizontal margin (UI-SPEC)
// Background: warn color (amber/orange)
// Text: Label 13sp, ink (dark text on amber — contrast is guaranteed), centered
// Non-dismissible: no X button, no onPress handler
// AccessibilityLabel: "Datos desactualizados. Última actualización hace {N} minutos."
// StyleSheet.create (D-04)
export default function StaleBanner({ ageMinutes }: StaleBannerProps) {
  const { theme } = useTheme();
  const lang      = detectLang();

  // ── banner text: "Última actualización hace {N} min — sin conexión" ────────
  const bannerText = tt('stale_banner', lang).replace('{N}', String(ageMinutes));

  // ── accessibilityLabel (UI-SPEC Accessibility) ─────────────────────────────
  const a11yLabel =
    lang === 'en'
      ? `Data is outdated. Last updated ${ageMinutes} minutes ago.`
      : `Datos desactualizados. Última actualización hace ${ageMinutes} minutos.`;

  const styles = createStyles(theme);

  return (
    <View
      style={styles.banner}
      accessibilityLabel={a11yLabel}
      accessibilityRole="none"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.bannerText} numberOfLines={1}>
        {bannerText}
      </Text>
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────
// StyleSheet.create() — D-04: no inline layout style objects.
function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    banner: {
      height:          40,         // UI-SPEC: 40dp fixed height
      width:           '100%',     // full width, no horizontal margin
      backgroundColor: theme.warn, // amber/orange — warn token
      alignItems:      'center',
      justifyContent:  'center',
      // Non-dismissible: no TouchableOpacity, no Pressable, no X button
    },

    // ── text: Label 13sp, ink (dark text — good contrast on amber) ───────────
    // UI-SPEC: Label 13sp, ink (not white — ink is readable on amber warn bg)
    bannerText: {
      fontSize:   13,       // Label (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.ink, // ink on warn bg — contrast verified in UI-SPEC (AAA-level amber)
      textAlign:  'center',
      lineHeight: 17,       // 1.3 × 13sp (UI-SPEC Typography)
      paddingHorizontal: 8, // sm — avoid text clipping on narrow screens
    },
  });
}
