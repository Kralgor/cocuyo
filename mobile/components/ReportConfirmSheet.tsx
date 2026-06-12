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
  onSubmit: (parroquia: string | null) => void;
}

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
  const municipios = useMemo(() => getMunicipios(regionKey), [regionKey]);
  const parroquias = useMemo(() => (municipio ? getParroquias(regionKey, municipio) : []), [municipio, regionKey]);
  const region = REGIONS[regionKey];
  const actionLabel = status === 'no_power' ? tt('report_out', lang) : tt('report_back', lang);

  function pickMunicipio(next: string) {
    setMunicipio(next);
    setParroquia(null);
  }

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

          <Pressable
            onPress={() => onSubmit(parroquia)}
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
});
