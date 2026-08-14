import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';

import ForecastCurve from '@/components/ForecastCurve';
import HistoryStrip from '@/components/HistoryStrip';
import { useTheme } from '@/hooks/useTheme';
import { useHistory } from '@/lib/history';
import { STORAGE_KEYS, storage } from '@/lib/storage';

// ── History tab (STAT-04) ───────────────────────────────────────────────────────
// 30-day outage strip + 48h risk forecast + monthly stats + pattern card
// (estimated return time from pattern.typical_duration_h).
// Data comes from the weekly retrain job via https://cocuyo.kralgor.com/history/{zone}.json
// (useHistory hook, staleTime 6h).
export default function HistoryScreen() {
  const { theme } = useTheme();
  const [selectedZone] = useMMKVString(STORAGE_KEYS.selectedZone, storage);
  const { data: history, isLoading } = useHistory(selectedZone ?? null);

  // ── loading state ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  // ── null state — no zone selected, or history not yet generated ───────────────
  if (!history) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.nullTitle, { color: theme.ink }]}>
          Historia disponible próximamente
        </Text>
        <Text style={[styles.nullSub, { color: theme.inkFaint }]}>
          Los datos se actualizan semanalmente.
        </Text>
      </View>
    );
  }

  const pattern = history.pattern;
  const stats = history.stats_30d;

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.header, { color: theme.ink }]}>{history.display_name}</Text>
      <Text style={[styles.subheader, { color: theme.inkDim }]}>Últimos 30 días</Text>

      {/* 30-day outage strip */}
      <View style={[styles.chartCard, { backgroundColor: theme.panel, borderColor: theme.line }]}>
        <HistoryStrip days={history.days} theme={theme} />
      </View>

      {/* monthly stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.panel, borderColor: theme.line }]}>
          <Text style={[styles.statLabel, { color: theme.inkFaint }]}>Este mes</Text>
          <Text style={[styles.statValue, { color: theme.ink }]}>{stats.total_hours}h sin luz</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.panel, borderColor: theme.line }]}>
          <Text style={[styles.statLabel, { color: theme.inkFaint }]}>Promedio</Text>
          <Text style={[styles.statValue, { color: theme.ink }]}>{stats.avg_duration_h.toFixed(1)}h</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.panel, borderColor: theme.line }]}>
          <Text style={[styles.statLabel, { color: theme.inkFaint }]}>Cortes</Text>
          <Text style={[styles.statValue, { color: theme.ink }]}>{stats.count}</Text>
        </View>
      </View>

      {/* detected pattern — estimated return time from past patterns (STAT-04) */}
      {pattern.detected && (
        <View style={[
          styles.patternCard,
          { backgroundColor: theme.panel, borderColor: theme.line, borderLeftColor: theme.accent },
        ]}>
          <Text style={[styles.patternTitle, { color: theme.accent }]}>Patrón detectado</Text>
          <Text style={[styles.patternDesc, { color: theme.ink }]}>{pattern.description}</Text>
          <Text style={[styles.patternMeta, { color: theme.inkFaint }]}>
            Duración típica: {pattern.typical_duration_h} h
          </Text>
        </View>
      )}

      {/* 48h forecast */}
      <Text style={[styles.subheader, { color: theme.inkDim }]}>Pronóstico 48h</Text>
      <View style={[styles.chartCard, { backgroundColor: theme.panel, borderColor: theme.line }]}>
        <ForecastCurve forecast_48h={history.forecast_48h} theme={theme} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  nullTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  nullSub: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
  },
  subheader: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  chartCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  patternCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  patternTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  patternDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  patternMeta: {
    fontSize: 12,
    marginTop: 8,
  },
});
