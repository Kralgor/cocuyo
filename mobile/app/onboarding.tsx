import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLocales } from 'expo-localization';
import { useTheme } from '@/hooks/useTheme';
import { tt } from '@/lib/i18n';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { Lang } from '@/lib/i18n';
import type { MobileTheme } from '@/lib/theme';

// ── constants ──────────────────────────────────────────────────────────────────
const GITHUB_URL = 'https://github.com/kralgor/cocuyo';

// ── detectLang ─────────────────────────────────────────────────────────────────
// Reads device locale; returns 'en' for English, 'es' for everything else.
// Source: RESEARCH.md Code Examples — Device Locale Detection
function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

// ── trust points ───────────────────────────────────────────────────────────────
// 4 trust points from UI-SPEC Copywriting Contract (TRST-01, D-07).
// Each entry maps to a pair of i18n keys: heading + body.
const TRUST_POINTS: { headingKey: string; bodyKey: string }[] = [
  { headingKey: 'trust_open_source_h', bodyKey: 'trust_open_source_b' },
  { headingKey: 'trust_anonymous_h',   bodyKey: 'trust_anonymous_b' },
  { headingKey: 'trust_political_h',   bodyKey: 'trust_political_b' },
  { headingKey: 'trust_offline_h',     bodyKey: 'trust_offline_b' },
];

// ── OnboardingScreen ───────────────────────────────────────────────────────────
// First-launch trust screen (TRST-01, D-07/08/10).
// Full-screen centered column, safe-area top/bottom, no persistent scroll
// (all content fits within viewport per UI-SPEC).
// Interaction contract:
//   • Comenzar → storage.set(hasSeenOnboarding, true) → Stack.Protected re-renders
//   • GitHub link → Linking.openURL(GITHUB_URL)
// Do NOT call router.replace/push — Stack.Protected handles routing (Pattern 2).
export default function OnboardingScreen() {
  const { theme } = useTheme();
  const insets   = useSafeAreaInsets();
  const lang     = detectLang();

  // ── handleComplete ──────────────────────────────────────────────────────────
  // Sets the MMKV flag; Stack.Protected guard in _layout.tsx re-evaluates
  // synchronously and advances to zone-picker (D-08, D-10).
  function handleComplete(): void {
    storage.set(STORAGE_KEYS.hasSeenOnboarding, true);
  }

  // ── handleGitHub ────────────────────────────────────────────────────────────
  // Opens the repo in the system browser (T-01-06 — hardcoded URL, not user input).
  function handleGitHub(): void {
    Linking.openURL(GITHUB_URL);
  }

  const styles = createStyles(theme, insets.top, insets.bottom);

  return (
    <View style={styles.screen}>
      {/* ── logo / wordmark ─────────────────────────────────────────────────── */}
      {/* No image asset in Phase 1 — text wordmark per plan note */}
      <View style={styles.logoBlock} accessibilityRole="header">
        <Text style={styles.logoText}>cocuyo</Text>
        <Text style={styles.subtitle}>{tt('tagline', lang)}</Text>
      </View>

      {/* ── 4 trust points ──────────────────────────────────────────────────── */}
      {TRUST_POINTS.map(({ headingKey, bodyKey }) => (
        <View key={headingKey} style={styles.trustRow}>
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={theme.ok}
            accessibilityElementsHidden
          />
          <View style={styles.trustText}>
            <Text style={styles.trustHeading}>{tt(headingKey, lang)}</Text>
            <Text style={styles.trustBody}>{tt(bodyKey, lang)}</Text>
          </View>
        </View>
      ))}

      {/* ── separator ───────────────────────────────────────────────────────── */}
      <View style={styles.separator} />

      {/* ── GitHub link ─────────────────────────────────────────────────────── */}
      <Pressable
        onPress={handleGitHub}
        style={({ pressed }) => [styles.githubLink, pressed && styles.githubLinkPressed]}
        accessibilityRole="link"
        accessibilityLabel={tt('github_link', lang)}
      >
        <Ionicons name="logo-github" size={18} color={theme.ink} />
        <Text style={styles.githubLabel}>{tt('github_link', lang)}</Text>
      </Pressable>

      {/* ── 16dp spacer ─────────────────────────────────────────────────────── */}
      <View style={styles.ctaSpacer} />

      {/* ── Comenzar CTA ────────────────────────────────────────────────────── */}
      <Pressable
        onPress={handleComplete}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel={tt('comenzar', lang)}
      >
        <Text style={styles.ctaLabel}>{tt('comenzar', lang)}</Text>
      </Pressable>
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────
// StyleSheet.create() — D-04: no inline layout style objects.
// Spacing follows UI-SPEC Spacing Scale (xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48).
function createStyles(
  theme: MobileTheme,
  safeTop: number,
  safeBottom: number,
) {
  return StyleSheet.create({
    screen: {
      flex:              1,
      backgroundColor:   theme.bg,
      paddingTop:        safeTop  + 32,  // safe area + xl top margin
      paddingBottom:     safeBottom + 24, // safe area + lg bottom margin
      paddingHorizontal: 24,
      justifyContent:    'center',
    },

    // ── logo block ────────────────────────────────────────────────────────────
    logoBlock: {
      alignItems:    'center',
      marginBottom:  32, // 2xl — logo-to-content gap (UI-SPEC)
    },
    logoText: {
      fontSize:   32,
      fontWeight: '700',
      color:      theme.ink,
      letterSpacing: 1,
    },
    subtitle: {
      fontSize:   16,
      fontWeight: '400',
      color:      theme.inkDim,
      textAlign:  'center',
      marginTop:  8,
    },

    // ── trust point row ───────────────────────────────────────────────────────
    // checkmark-circle (20dp) + 12dp gap + text column (UI-SPEC)
    trustRow: {
      flexDirection:  'row',
      alignItems:     'flex-start',
      marginBottom:   16, // md between rows
    },
    trustText: {
      flex:       1,
      marginLeft: 12, // 12dp gap between icon and text (UI-SPEC)
    },
    trustHeading: {
      fontSize:   16,
      fontWeight: '700',
      color:      theme.ink,
      lineHeight: 22,
    },
    trustBody: {
      fontSize:   13,
      fontWeight: '400',
      color:      theme.inkDim,
      lineHeight: 18,
      marginTop:  2,
    },

    // ── separator ─────────────────────────────────────────────────────────────
    // 24dp vertical space between trust points and buttons (UI-SPEC)
    separator: {
      height: 24,
    },

    // ── GitHub link button ─────────────────────────────────────────────────────
    // Pressable row: left-aligned icon + label, accent border bottom 1dp, no fill.
    githubLink: {
      flexDirection:   'row',
      alignItems:      'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.accent,
      alignSelf:       'flex-start',
    },
    githubLinkPressed: {
      opacity: 0.7,
    },
    githubLabel: {
      fontSize:   16,
      fontWeight: '400',
      color:      theme.ink,
      marginLeft: 6,
    },

    // ── spacer between GitHub link and CTA button ──────────────────────────────
    ctaSpacer: {
      height: 16, // 16dp spacer per UI-SPEC
    },

    // ── Comenzar CTA button ────────────────────────────────────────────────────
    // Full-width, 48dp height, accent fill (#E8C840), ink text, 16sp bold, 8dp radius.
    // ink text on yellow — ratio ~8.6:1 (AAA per UI-SPEC Accessibility).
    cta: {
      backgroundColor: theme.accent,
      height:          48,
      borderRadius:    8,
      alignItems:      'center',
      justifyContent:  'center',
    },
    ctaPressed: {
      opacity: 0.85,
    },
    ctaLabel: {
      fontSize:   16,
      fontWeight: '700',
      color:      theme.ink, // ink on accent — not white (UI-SPEC)
    },
  });
}
