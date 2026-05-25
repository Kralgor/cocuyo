import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SectionList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLocales } from 'expo-localization';
import { REGIONS, filterSections } from '@/lib/regions';
import { statusColor } from '@/lib/theme';
import { tt } from '@/lib/i18n';
import { useTheme } from '@/hooks/useTheme';
import { useStatus } from '@/hooks/useStatus';
import type { Lang } from '@/lib/i18n';
import type { MobileTheme } from '@/lib/theme';
import type { ZoneSection } from '@/lib/regions';

// ── detectLang ─────────────────────────────────────────────────────────────────
// Reads device locale; returns 'en' for English, 'es' for everything else.
// Source: RESEARCH.md Code Examples — Device Locale Detection
function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

// ── ZonePickerProps ────────────────────────────────────────────────────────────
// Reusable: zone-picker route passes selectedZone write;
// Settings "Cambiar zona" (Plan 04) passes its own handler.
interface ZonePickerProps {
  /** Called when user taps a zone row — receives the canonical region key. */
  onSelect: (zoneKey: string) => void;
}

// ── ZonePicker ─────────────────────────────────────────────────────────────────
// SectionList of 17 zones grouped by state with a search bar and status dots.
// Spec: UI-SPEC Zone Picker screen interaction contract (D-11, STAT-01).
// Reusable by Settings "Cambiar zona" action in Plan 04.
//
// Search: filters filterSections(query) case-insensitively; empty result shows no_results copy.
// Status dots: colored via statusColor(status, theme) from live useStatus() data;
//              inkFaint fallback when no data available (first launch / loading).
// StyleSheet.create for all layout (D-04).
export default function ZonePicker({ onSelect }: ZonePickerProps) {
  const { theme }   = useTheme();
  const { data }    = useStatus();
  const insets      = useSafeAreaInsets();
  const lang        = detectLang();
  const [query, setQuery] = useState('');

  const sections = filterSections(query);
  const styles   = createStyles(theme, insets.top, insets.bottom);

  // ── renderSectionHeader ──────────────────────────────────────────────────────
  // Uppercase state name, Label 13sp, inkDim, xl left padding (UI-SPEC).
  function renderSectionHeader({ section }: { section: ZoneSection }) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {section.title.toUpperCase()}
        </Text>
      </View>
    );
  }

  // ── renderItem ───────────────────────────────────────────────────────────────
  // Zone row: 48dp height, panel bg, status dot + 8dp gap + display_name (UI-SPEC).
  function renderItem({ item: key }: { item: string }) {
    const region     = REGIONS[key];
    const rawStatus  = data?.regions?.[key]?.status ?? null;
    const dotColor   = rawStatus
      ? statusColor(rawStatus, theme)
      : theme.inkFaint; // inkFaint fallback when no data (first launch / loading)

    // accessibilityLabel: "{display_name}, {statusLabel}" per UI-SPEC Accessibility
    const statusText = rawStatus
      ? rawStatus.replace(/_/g, ' ')
      : lang === 'en' ? 'no data' : 'sin datos';
    const a11yLabel = `${region.display_name}, ${statusText}`;

    return (
      <Pressable
        onPress={() => onSelect(key)}
        style={({ pressed }) => [styles.zoneRow, pressed && styles.zoneRowPressed]}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
      >
        {/* Status dot — 8dp diameter, 4dp margin-right (UI-SPEC Spacing) */}
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={styles.zoneName}>{region.display_name}</Text>
      </Pressable>
    );
  }

  // ── empty result ─────────────────────────────────────────────────────────────
  // Shown when filterSections returns no sections for the current query.
  function renderEmptyResult() {
    if (!query) return null;
    const msg = tt('no_results', lang).replace('{query}', query);
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{msg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── header title ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{tt('zone_picker_title', lang)}</Text>
      </View>

      {/* ── search bar ────────────────────────────────────────────────────────── */}
      {/* 48dp height, 16dp horizontal margin, panel bg, 8dp radius (UI-SPEC) */}
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={tt('search_placeholder', lang)}
          placeholderTextColor={theme.inkFaint}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel={tt('search_placeholder', lang)}
        />
      </View>

      {/* ── SectionList or empty state ────────────────────────────────────────── */}
      {sections.length === 0 ? (
        renderEmptyResult()
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(key) => key}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────
// StyleSheet.create() — D-04: no inline layout style objects.
// Spacing follows UI-SPEC Spacing Scale (xs=4, sm=8, md=16, lg=24, xl=32).
function createStyles(
  theme: MobileTheme,
  safeTop: number,
  safeBottom: number,
) {
  return StyleSheet.create({
    container: {
      flex:            1,
      backgroundColor: theme.bg,
      paddingTop:      safeTop,
      paddingBottom:   safeBottom,
    },

    // ── header ─────────────────────────────────────────────────────────────────
    header: {
      paddingHorizontal: 16, // md
      paddingVertical:   12,
    },
    headerTitle: {
      fontSize:   20,  // Heading (UI-SPEC Typography)
      fontWeight: '700',
      color:      theme.ink,
    },

    // ── search bar ─────────────────────────────────────────────────────────────
    searchWrapper: {
      marginHorizontal: 16, // md
      marginBottom:     8,  // sm
    },
    searchInput: {
      height:          48, // touch target (UI-SPEC)
      backgroundColor: theme.panel,
      borderRadius:    8,  // sm
      paddingHorizontal: 16,
      fontSize:        16,
      color:           theme.ink,
    },

    // ── SectionList content padding ────────────────────────────────────────────
    listContent: {
      paddingBottom: 16,
    },

    // ── section header ─────────────────────────────────────────────────────────
    // Label 13sp, inkDim, xl (32dp) left padding (UI-SPEC Zone Picker)
    sectionHeader: {
      backgroundColor:   theme.bg,
      paddingLeft:       32, // xl
      paddingRight:      16,
      paddingVertical:   6,
    },
    sectionTitle: {
      fontSize:   13, // Label (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.inkDim,
      letterSpacing: 0.5,
    },

    // ── zone row ───────────────────────────────────────────────────────────────
    // 48dp height, panel background, md horizontal padding (UI-SPEC)
    zoneRow: {
      height:            48, // touch target (iOS HIG / Android material)
      flexDirection:     'row',
      alignItems:        'center',
      backgroundColor:   theme.panel,
      paddingHorizontal: 16, // md
    },
    zoneRowPressed: {
      opacity: 0.75,
    },

    // ── status dot ─────────────────────────────────────────────────────────────
    // 8dp diameter, 4dp margin-right (UI-SPEC Spacing Scale xs=4, sm=8)
    statusDot: {
      width:        8,
      height:       8,
      borderRadius: 4,
      marginRight:  8, // sm gap between dot and label (UI-SPEC: 8dp gap)
    },

    // ── zone name ─────────────────────────────────────────────────────────────
    zoneName: {
      flex:       1,
      fontSize:   16, // Body (UI-SPEC Typography)
      fontWeight: '400',
      color:      theme.ink,
    },

    // ── row separator ─────────────────────────────────────────────────────────
    separator: {
      height:          1,
      backgroundColor: theme.line,
    },

    // ── empty state ───────────────────────────────────────────────────────────
    emptyContainer: {
      flex:            1,
      alignItems:      'center',
      justifyContent:  'center',
      paddingHorizontal: 24,
      paddingTop:      48,
    },
    emptyText: {
      fontSize:   16, // Body (UI-SPEC)
      fontWeight: '400',
      color:      theme.inkDim,
      textAlign:  'center',
    },
  });
}
