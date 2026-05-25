import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { tt } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { getLocales } from 'expo-localization';

// ── detectLang ────────────────────────────────────────────────────────────────
// Reads device locale and returns 'en' for English or 'es' for everything else.
// Source: RESEARCH.md Code Examples — Device Locale Detection
function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

// ── PlaceholderTab props ───────────────────────────────────────────────────────
interface PlaceholderTabProps {
  /** Ionicons icon name — passed by each placeholder screen (48dp, inkFaint) */
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

// ── PlaceholderTab ────────────────────────────────────────────────────────────
// Reusable "Próximamente" / "Coming soon" screen for Phase 1 placeholder tabs (D-01).
// Renders: centered icon + heading + body, full height, safe-area aware.
// Uses useTheme() for colors and tt() for i18n copy (UI-SPEC Placeholder Tabs).
// Uses StyleSheet.create (D-04 — no inline style objects for layout).
export default function PlaceholderTab({ icon }: PlaceholderTabProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const lang = detectLang();

  const styles = createStyles(theme, insets.top, insets.bottom);

  return (
    <View style={styles.container}>
      <Ionicons
        name={icon}
        size={48}
        color={theme.inkFaint}
        style={styles.icon}
      />
      <Text style={styles.heading}>
        {tt('coming_soon', lang)}
      </Text>
      <Text style={styles.body}>
        {tt('coming_soon_body', lang)}
      </Text>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
// StyleSheet.create() — D-04: no inline style objects for layout.
function createStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  paddingTop: number,
  paddingBottom: number,
) {
  return StyleSheet.create({
    container: {
      flex:            1,
      alignItems:      'center',
      justifyContent:  'center',
      backgroundColor: theme.bg,
      paddingTop:      paddingTop,
      paddingBottom:   paddingBottom,
      paddingHorizontal: 24,
    },
    icon: {
      marginBottom: 16,
    },
    heading: {
      fontSize:   20,
      fontWeight: '700',
      color:      theme.ink,
      textAlign:  'center',
      marginBottom: 8,
    },
    body: {
      fontSize:   16,
      fontWeight: '400',
      color:      theme.inkDim,
      textAlign:  'center',
      lineHeight: 24,
    },
  });
}
