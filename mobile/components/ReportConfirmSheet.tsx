import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { tt, type Lang } from '@/lib/i18n';
import { getMunicipios, getParroquias } from '@/lib/parroquias';
import { REGIONS } from '@/lib/regions';

interface ReportConfirmSheetProps {
  visible: boolean;
  lang: Lang;
  regionKey: string;
  status: 'no_power' | 'power_back';
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (parroquia: string | null, when: { startedAt: string | null; endedAt: string | null }) => void;
}

// ── retroactive window state ──────────────────────────────────────────────────
// Default: right now. "Antes" reveals day + start/end time steppers.
type WhenMode = 'now' | 'earlier';
type WhenDay = 'today' | 'yesterday';

export default function ReportConfirmSheet({
  visible,
  lang,
  regionKey,
  status,
  isSubmitting,
  onClose,
  onSubmit,
}: ReportConfirmSheetProps) {
  const { theme } = useTheme();
  const [municipio, setMunicipio] = useState<string | null>(null);
  const [parroquia, setParroquia] = useState<string | null>(null);
  const [whenMode, setWhenMode] = useState<WhenMode>('now');
  const [whenDay, setWhenDay] = useState<WhenDay>('today');
  const [startHour, setStartHour] = useState(14);
  const [endHour, setEndHour] = useState<number | null>(null);
  const municipios = useMemo(() => getMunicipios(regionKey), [regionKey]);
  const parroquias = useMemo(() => (municipio ? getParroquias(regionKey, municipio) : []), [municipio, regionKey]);
  const region = REGIONS[regionKey];
  const actionLabel = status === 'no_power' ? tt('report_out', lang) : tt('report_back', lang);

  function pickMunicipio(next: string) {
    setMunicipio(next);
    setParroquia(null);
  }

  function submit() {
    let startedAt: string | null = null;
    let endedAt: string | null = null;
    if (whenMode === 'earlier') {
      const start = new Date();
      if (whenDay === 'yesterday') start.setDate(start.getDate() - 1);
      start.setHours(startHour, 0, 0, 0);
      startedAt = start.toISOString();
      if (endHour != null) {
        const end = new Date(start);
        end.setHours(endHour, 0, 0, 0);
        endedAt = end.toISOString();
      }
    }
    onSubmit(parroquia, { startedAt, endedAt });
  }

  const fmtTime = (h: number, m = 0) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const stepper = (label: string, value: string, onUp: () => void, onDown: () => void) => (
    <View style={[styles.step, { borderColor: theme.lineStrong }]}>
      <Text style={[styles.stepLabel, { color: theme.inkFaint }]}>{label}</Text>
      <Pressable onPress={onUp} hitSlop={8} accessibilityRole="button">
        <Ionicons name="chevron-up" size={20} color={theme.ink} />
      </Pressable>
      <Text style={[styles.stepValue, { color: theme.ink }]}>{value}</Text>
      <Pressable onPress={onDown} hitSlop={8} accessibilityRole="button">
        <Ionicons name="chevron-down" size={20} color={theme.ink} />
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.lineStrong }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.ink }]}>{tt('confirm_title', lang)}</Text>
              <Text style={[styles.subtitle, { color: theme.inkDim }]}>{actionLabel}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Ionicons name="close" size={24} color={theme.inkDim} />
            </Pressable>
          </View>

          <Text style={[styles.zone, { color: theme.ink }]}>
            {tt('zone_label', lang).replace('{name}', region?.display_name ?? regionKey)}
          </Text>

          <Text style={[styles.label, { color: theme.inkDim }]}>{tt('parroquia_label', lang)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {municipios.map(item => (
              <Pressable
                key={item}
                onPress={() => pickMunicipio(item)}
                style={[styles.chip, { borderColor: municipio === item ? theme.accent : theme.lineStrong }]}
              >
                <Text style={[styles.chipText, { color: theme.ink }]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {parroquias.length > 0 && (
            <ScrollView style={styles.parroquiaList}>
              {parroquias.map(item => (
                <Pressable
                  key={item}
                  onPress={() => setParroquia(item)}
                  style={[styles.row, { borderBottomColor: theme.line }]}
                >
                  <Text style={[styles.rowText, { color: theme.ink }]}>{item}</Text>
                  {parroquia === item && <Ionicons name="checkmark" size={18} color={theme.accent} />}
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Text style={[styles.label, { color: theme.inkDim }]}>{tt('when_label', lang)}</Text>
          <View style={styles.whenRow}>
            <Pressable
              onPress={() => setWhenMode('now')}
              style={[styles.whenBtn, { borderColor: whenMode === 'now' ? theme.accent : theme.lineStrong }]}
            >
              <Text style={[styles.whenBtnText, { color: whenMode === 'now' ? theme.ink : theme.inkDim }]}>
                {tt('when_now', lang)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setWhenMode('earlier')}
              style={[styles.whenBtn, { borderColor: whenMode === 'earlier' ? theme.accent : theme.lineStrong }]}
            >
              <Text style={[styles.whenBtnText, { color: whenMode === 'earlier' ? theme.ink : theme.inkDim }]}>
                {tt('when_earlier', lang)}
              </Text>
            </Pressable>
          </View>

          {whenMode === 'earlier' && (
            <>
              <View style={styles.whenRow}>
                <Pressable
                  onPress={() => setWhenDay('today')}
                  style={[styles.whenBtn, { borderColor: whenDay === 'today' ? theme.accent : theme.lineStrong }]}
                >
                  <Text style={[styles.whenBtnText, { color: whenDay === 'today' ? theme.ink : theme.inkDim }]}>
                    {tt('when_today', lang)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setWhenDay('yesterday')}
                  style={[styles.whenBtn, { borderColor: whenDay === 'yesterday' ? theme.accent : theme.lineStrong }]}
                >
                  <Text style={[styles.whenBtnText, { color: whenDay === 'yesterday' ? theme.ink : theme.inkDim }]}>
                    {tt('when_yesterday', lang)}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.stepRow}>
                {stepper(
                  tt('when_start', lang),
                  fmtTime(startHour),
                  () => setStartHour((startHour + 1) % 24),
                  () => setStartHour((startHour + 23) % 24),
                )}
                <Pressable
                  onPress={() => setEndHour(endHour == null ? startHour : null)}
                  style={[styles.whenBtn, { borderColor: endHour != null ? theme.accent : theme.lineStrong, justifyContent: 'center' }]}
                >
                  <Text style={[styles.whenBtnText, { color: endHour != null ? theme.ink : theme.inkDim }]}>
                    {endHour != null
                      ? tt('when_end', lang).replace('{t}', fmtTime(endHour))
                      : tt('when_ongoing', lang)}
                  </Text>
                </Pressable>
              </View>
              {endHour != null && (
                <View style={styles.stepRow}>
                  {stepper(
                    tt('when_end', lang),
                    fmtTime(endHour),
                    () => setEndHour((endHour + 1) % 24),
                    () => setEndHour((endHour + 23) % 24),
                  )}
                </View>
              )}
            </>
          )}

          <Pressable
            onPress={submit}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: theme.warn, opacity: pressed || isSubmitting ? 0.72 : 1 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>{tt('submit_report', lang)}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
  },
  zone: {
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  chips: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  parroquiaList: {
    maxHeight: 180,
  },
  row: {
    minHeight: 44,
    borderBottomWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowText: {
    fontSize: 16,
  },
  submit: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '700',
  },
  whenRow: {
    flexDirection: 'row',
    gap: 8,
  },
  whenBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whenBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
  },
  step: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stepValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
