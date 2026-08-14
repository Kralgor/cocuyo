import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { getLocales } from 'expo-localization';
import { tt } from '@/lib/i18n';
import { useTheme } from '@/hooks/useTheme';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import ZonePicker from '@/components/ZonePicker';
import type { Lang } from '@/lib/i18n';
import type { MobileTheme } from '@/lib/theme';

// ── detectLang ─────────────────────────────────────────────────────────────────
function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

// ── GitHub URL constant (T-01-08 threat mitigation) ───────────────────────────
// Hardcoded — never derived from user input or remote data (TRST-02, T-01-08).
const GITHUB_URL = 'https://github.com/kralgor/cocuyo';

// ── ThemeOption ────────────────────────────────────────────────────────────────
type ThemeOption = 'system' | 'light' | 'dark' | 'amoled';

// ── SettingsModalProps ────────────────────────────────────────────────────────
interface SettingsModalProps {
  /** Controls visibility of the modal. */
  visible: boolean;
  /** Called when the user taps the close button. */
  onClose: () => void;
}

// ── SettingsModal ─────────────────────────────────────────────────────────────
// Bottom-sheet settings modal — slide-up, ~70% height, panel bg.
// Spec: UI-SPEC D-02, TRST-02.
//
// Sections:
//   A. Modal header: title + close button
//   B. Mi zona: current zone + chevron → opens ZonePicker inline
//   C. Apariencia: 3-option segmented control → useTheme().setOverride
//   D. Privacidad y código abierto: body text + GitHub link (TRST-02)
//
// No destructive actions.
// StyleSheet.create (D-04).
// GitHub URL is a hardcoded constant — not derived from user input (T-01-08).
export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { theme, override, setOverride } = useTheme();
  const lang                             = detectLang();
  const [showZonePicker, setShowZonePicker] = useState(false);

  // ── current zone display ───────────────────────────────────────────────────
  const selectedZone = storage.getString(STORAGE_KEYS.selectedZone) ?? '';

  // ── theme segmented control ───────────────────────────────────────────────
  // Maps UI option → setOverride argument (null | 'light' | 'dark' | 'amoled')
  const themeOptions: { key: ThemeOption; label: string; overrideValue: null | 'light' | 'dark' | 'amoled' }[] = [
    { key: 'system', label: tt('settings_theme_sys',   lang), overrideValue: null    },
    { key: 'light',  label: tt('settings_theme_light', lang), overrideValue: 'light' },
    { key: 'dark',   label: tt('settings_theme_dark',  lang), overrideValue: 'dark'  },
    { key: 'amoled', label: tt('theme_amoled', lang), overrideValue: 'amoled' },
  ];
  // Derive active option from current override value
  const activeThemeKey: ThemeOption =
    override === 'light' ? 'light' :
    override === 'dark'  ? 'dark'  : 'system';

  const styles = createStyles(theme);

  // ── zone selection handler ────────────────────────────────────────────────
  function handleZoneSelect(key: string) {
    storage.set(STORAGE_KEYS.selectedZone, key);
    setShowZonePicker(false);
    // No confirmation dialog — action is reversible (UI-SPEC: Cambiar zona note)
  }

  // ── GitHub link handler (TRST-02) ─────────────────────────────────────────
  async function handleGitHub() {
    await Linking.openURL(GITHUB_URL);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* ── backdrop ──────────────────────────────────────────────────────── */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* ── sheet: ~70% height, panel bg, slide-up (UI-SPEC D-02) ─────────── */}
      <View style={styles.sheet}>
        {/* ── drag handle: 36dp × 4dp, lineStrong, centered (UI-SPEC D-02) */}
        <View style={styles.handle} />

        {/* ── A. Modal header ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>{tt('settings_title', lang)}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={lang === 'en' ? 'Close settings' : 'Cerrar ajustes'}
          >
            <Ionicons name="close" size={24} color={theme.inkDim} />
          </Pressable>
        </View>
        <View style={styles.separator} />

        {/* ── B. Mi zona section ────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>{tt('settings_zone_h', lang).toUpperCase()}</Text>
        <Pressable
          style={styles.zoneRow}
          onPress={() => setShowZonePicker(!showZonePicker)}
          accessibilityRole="button"
          accessibilityLabel={tt('settings_zone_change', lang)}
        >
          <Text style={styles.zoneText} numberOfLines={1}>
            {selectedZone || tt('settings_zone_change', lang)}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.inkFaint} />
        </Pressable>

        {/* ── ZonePicker inline (no nested modal — rendered in sheet) ─────── */}
        {showZonePicker && (
          <View style={styles.zonePickerContainer}>
            <ZonePicker onSelect={handleZoneSelect} />
          </View>
        )}

        {/* ── C. Apariencia section ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>{tt('settings_theme_h', lang).toUpperCase()}</Text>
        <View style={styles.segmentedControl}>
          {themeOptions.map((opt) => {
            const isActive = activeThemeKey === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[
                  styles.segmentOption,
                  isActive && styles.segmentOptionActive,
                ]}
                onPress={() => setOverride(opt.overrideValue)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={opt.label}
              >
                <Text
                  style={[
                    styles.segmentText,
                    isActive && styles.segmentTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── D. Privacidad y código abierto section (TRST-02) ─────────── */}
        <Text style={styles.sectionLabel}>{tt('settings_privacy_h', lang).toUpperCase()}</Text>
        <Text style={styles.privacyBody}>{tt('settings_privacy_b', lang)}</Text>

        {/* ── GitHub link row (TRST-02): Ionicons logo-github + text ────── */}
        <Pressable
          style={styles.githubRow}
          onPress={handleGitHub}
          accessibilityRole="link"
          accessibilityLabel={tt('settings_github', lang)}
        >
          <Ionicons name="logo-github" size={18} color={theme.inkDim} />
          <Text style={styles.githubText}>{tt('settings_github', lang)}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────
// StyleSheet.create() — D-04: no inline layout style objects.
// Spacing: md=16dp, sm=8dp, xs=4dp, lg=24dp (UI-SPEC Spacing Scale).
function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    // ── backdrop ──────────────────────────────────────────────────────────────
    backdrop: {
      flex:            1,
      backgroundColor: 'rgba(0,0,0,0.40)',
    },

    // ── sheet: ~70% height, panel bg, slide-up (UI-SPEC D-02) ────────────────
    sheet: {
      position:        'absolute',
      bottom:          0,
      left:            0,
      right:           0,
      height:          '70%', // UI-SPEC: ~70% screen height
      backgroundColor: theme.panel,
      borderTopLeftRadius:  16,
      borderTopRightRadius: 16,
      paddingBottom:   24, // lg — safe-area-ish bottom padding
    },

    // ── drag handle: 36dp × 4dp, lineStrong, 8dp top margin (UI-SPEC D-02) ──
    handle: {
      width:           36,
      height:          4,
      borderRadius:    2,
      backgroundColor: theme.lineStrong,
      alignSelf:       'center',
      marginTop:       8, // sm
      marginBottom:    8, // sm
    },

    // ── A. Modal header ───────────────────────────────────────────────────────
    header: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16, // md
      paddingVertical:   12,
    },
    title: {
      fontSize:   20,     // Heading (UI-SPEC Typography)
      fontWeight: '700',
      color:      theme.ink,
    },
    separator: {
      height:          1,
      backgroundColor: theme.line,
      marginHorizontal: 0,
    },

    // ── section label: Label 13sp, inkDim, uppercase (UI-SPEC D-02) ──────────
    sectionLabel: {
      fontSize:          13,         // Label (UI-SPEC Typography)
      fontWeight:        '400',
      color:             theme.inkDim,
      letterSpacing:     0.5,
      paddingHorizontal: 16,         // md
      paddingTop:        16,         // md
      paddingBottom:     8,          // sm
    },

    // ── B. Mi zona row ────────────────────────────────────────────────────────
    // 48dp height, md horizontal padding, chevron-forward on right (UI-SPEC D-02)
    zoneRow: {
      height:            48,
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16,
      backgroundColor:   theme.panel,
    },
    zoneText: {
      flex:       1,
      fontSize:   16,      // Body (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.ink,
      marginRight: 8,
    },

    // ── ZonePicker container (inline in sheet) ────────────────────────────────
    zonePickerContainer: {
      height:          240,
      marginHorizontal: 0,
      borderTopWidth:  1,
      borderTopColor:  theme.line,
    },

    // ── C. Apariencia segmented control (UI-SPEC D-02) ────────────────────────
    // 3 options, 36dp height, full width minus md padding, accent active fill
    segmentedControl: {
      flexDirection:     'row',
      marginHorizontal:  16, // md
      height:            36, // UI-SPEC D-02
      borderRadius:      8,
      overflow:          'hidden',
      backgroundColor:   theme.bg, // inactive bg = bg (subtle container)
      borderWidth:       1,
      borderColor:       theme.line,
    },
    segmentOption: {
      flex:            1,
      alignItems:      'center',
      justifyContent:  'center',
      backgroundColor: 'transparent',
    },
    segmentOptionActive: {
      backgroundColor: theme.accent, // accent fill for active (UI-SPEC 60/30/10)
    },
    segmentText: {
      fontSize:   13,         // Label (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.inkDim,
    },
    segmentTextActive: {
      color:      theme.ink,  // ink on accent is readable (8.6:1 contrast per UI-SPEC)
      fontWeight: '700',
    },

    // ── D. Privacidad section body ────────────────────────────────────────────
    privacyBody: {
      fontSize:          16,         // Body (UI-SPEC Typography)
      fontWeight:        '400',
      color:             theme.inkDim,
      lineHeight:        24,         // 1.5 × 16sp
      paddingHorizontal: 16,         // md
      paddingBottom:     8,          // sm
    },

    // ── GitHub link row (TRST-02) ─────────────────────────────────────────────
    // Ionicons logo-github (18dp) + accent text + 48dp height (UI-SPEC D-02)
    githubRow: {
      height:            48,  // UI-SPEC: 48dp touch target
      flexDirection:     'row',
      alignItems:        'center',
      paddingHorizontal: 16,  // md
      gap:               8,   // sm — icon to text gap
    },
    githubText: {
      fontSize:   16,          // Body (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.accent, // accent color for link (UI-SPEC 60/30/10)
    },
  });
}
