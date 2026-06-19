import Ionicons from '@expo/vector-icons/Ionicons';
import { getLocales } from 'expo-localization';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useFoodTimers, type FoodTimerCard } from '@/hooks/useFoodTimers';
import { useTheme } from '@/hooks/useTheme';
import {
  FOOD_PRESETS,
  validateCustomFood,
  type FoodWarningLevel,
  type TrackedFoodItem,
} from '@/lib/food';
import { formatDuration, tt, type Lang } from '@/lib/i18n';
import { REGIONS } from '@/lib/regions';

// ── lang detection (mirrors app/(tabs)/index.tsx) ───────────────────────────────
function detectLang(): Lang {
  const primary = getLocales()[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

// ── level → label + token mapping ───────────────────────────────────────────────
function levelLabelKey(level: FoodWarningLevel): string {
  if (level === 'expired') return 'food_level_expired';
  if (level === 'warning') return 'food_level_warning';
  return 'food_level_safe';
}

export default function FoodScreen() {
  const { theme } = useTheme();
  const lang = detectLang();
  const {
    selectedZone,
    trackedItems,
    session,
    timerCards,
    isOffline,
    isStatusStale,
    acknowledgeOutagePrompt,
    dismissRestoredReview,
    addPreset,
    addCustomItem,
    removeItem,
    setItemEnabled,
    resetAllFoodTimers,
  } = useFoodTimers();

  const zoneName = selectedZone ? REGIONS[selectedZone]?.display_name ?? selectedZone : null;
  const trackedPresetIds = useMemo(
    () => new Set(trackedItems.map((i) => i.presetId).filter((id) => id != null)),
    [trackedItems],
  );

  // ── custom item form (Task 3) — local component state only ────────────────────
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customHours, setCustomHours] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  // ── food alerts point-of-use placeholder (Task 4, NOTF-03) ────────────────────
  // Local-only preference. No OS permission request on mount, no remote registration.
  const [alertsArmed, setAlertsArmed] = useState(false);

  const levelToken = (level: FoodWarningLevel): string => {
    if (level === 'expired') return theme.danger;
    if (level === 'warning') return theme.warn;
    return theme.ok;
  };

  const submitCustom = (): void => {
    const hours = Number.parseFloat(customHours.replace(',', '.'));
    const thresholdMinutes = Number.isFinite(hours) ? Math.round(hours * 60) : NaN;
    const result = validateCustomFood({ name: customName, thresholdMinutes });
    if (!result.ok) {
      setCustomError(result.message);
      return;
    }
    addCustomItem({ name: customName, thresholdMinutes });
    setCustomName('');
    setCustomHours('');
    setCustomError(null);
    setShowCustom(false);
  };

  const restored = session.status === 'restored_review';
  const showStale = (isOffline || isStatusStale) && session.status === 'active';

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* ── header ── */}
      <View style={[styles.header, { borderColor: theme.line, backgroundColor: theme.panel }]}>
        <View style={[styles.icon, { backgroundColor: theme.lineStrong }]}>
          <Ionicons name="restaurant" size={22} color={theme.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: theme.inkDim }]}>{tt('tab_food', lang)}</Text>
          <Text style={[styles.title, { color: theme.ink }]}>{tt('food_title', lang)}</Text>
          <Text style={[styles.copy, { color: theme.inkDim }]}>{tt('food_subtitle', lang)}</Text>
          {zoneName ? (
            <Text style={[styles.zone, { color: theme.ink }]}>
              {tt('food_zone_label', lang).replace('{name}', zoneName)}
            </Text>
          ) : (
            <Text style={[styles.warning, { color: theme.warn }]}>{tt('food_no_zone', lang)}</Text>
          )}
        </View>
      </View>

      {/* ── outage review prompt (D-15) ── */}
      {session.needsOutageReviewPrompt ? (
        <View style={[styles.banner, { borderColor: theme.danger, backgroundColor: theme.panel }]}>
          <Text style={[styles.bannerText, { color: theme.ink }]}>
            {tt('food_outage_prompt', lang)}
          </Text>
          <Pressable
            onPress={acknowledgeOutagePrompt}
            style={({ pressed }) => [
              styles.smallButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Text style={[styles.smallButtonText, { color: theme.bg }]}>
              {tt('food_outage_review', lang)}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── stale / offline honesty banner (D-08, D-18) ── */}
      {showStale ? (
        <View style={[styles.note, { borderColor: theme.warn, backgroundColor: theme.panel }]}>
          <Text style={[styles.noteText, { color: theme.warn }]}>
            {isOffline ? tt('food_offline_note', lang) : tt('food_stale_note', lang)}
          </Text>
        </View>
      ) : null}

      {/* ── restored review (D-07, D-16) — never declares food safe ── */}
      {restored ? (
        <View style={[styles.banner, { borderColor: theme.warn, backgroundColor: theme.panel }]}>
          <Text style={[styles.panelTitle, { color: theme.ink }]}>{tt('food_restored_h', lang)}</Text>
          <Text style={[styles.copy, { color: theme.inkDim }]}>{tt('food_restored_note', lang)}</Text>
          <Pressable
            onPress={dismissRestoredReview}
            style={({ pressed }) => [
              styles.smallButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Text style={[styles.smallButtonText, { color: theme.bg }]}>
              {tt('food_restored_clear', lang)}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── active timer cards (D-04, D-17) ── */}
      {timerCards.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>{tt('food_active_h', lang)}</Text>
          <Text style={[styles.copy, { color: theme.inkDim }]}>{tt('food_caution_early', lang)}</Text>
          {timerCards.map((card: FoodTimerCard) => {
            const tone = levelToken(card.progress.level);
            return (
              <View
                key={card.item.id}
                style={[styles.card, { borderColor: theme.line, backgroundColor: theme.panel }]}
              >
                <View style={styles.cardHead}>
                  <Text style={[styles.cardName, { color: theme.ink }]}>{card.item.name}</Text>
                  <Text style={[styles.level, { color: tone }]}>
                    {tt(levelLabelKey(card.progress.level), lang)}
                  </Text>
                </View>
                <Text style={[styles.cardMeta, { color: theme.inkDim }]}>
                  {tt('food_elapsed', lang).replace(
                    '{X}',
                    formatDuration(Math.round(card.progress.elapsedMinutes), lang),
                  )}
                  {'  ·  '}
                  {tt('food_remaining', lang).replace(
                    '{X}',
                    formatDuration(Math.round(card.progress.remainingMinutes), lang),
                  )}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* ── food alerts point-of-use (Task 4, NOTF-03, D-10, D-11) ── */}
      <View style={[styles.panel, { borderColor: theme.line, backgroundColor: theme.panel }]}>
        <Text style={[styles.panelTitle, { color: theme.ink }]}>{tt('food_alerts_h', lang)}</Text>
        <Text style={[styles.copy, { color: theme.inkDim }]}>{tt('food_alerts_body', lang)}</Text>
        <View style={[styles.toggleRow, { borderColor: theme.line }]}>
          <Text style={[styles.toggleTitle, { color: theme.ink }]}>
            {tt('food_alerts_enable', lang)}
          </Text>
          <Switch
            value={alertsArmed}
            onValueChange={setAlertsArmed}
            thumbColor={alertsArmed ? theme.accent : theme.inkDim}
            trackColor={{ false: theme.lineStrong, true: theme.accent }}
          />
        </View>
        <Text style={[styles.hint, { color: theme.inkFaint }]}>{tt('food_alerts_soon', lang)}</Text>
      </View>

      {/* ── tracked foods (D-05, D-13) ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.ink }]}>{tt('food_tracked_h', lang)}</Text>
        {trackedItems.length === 0 ? (
          <Text style={[styles.copy, { color: theme.inkDim }]}>{tt('food_empty_tracked', lang)}</Text>
        ) : (
          trackedItems.map((item: TrackedFoodItem) => (
            <View
              key={item.id}
              style={[styles.row, { borderColor: theme.line, backgroundColor: theme.panel }]}
            >
              <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Switch
                value={item.enabled}
                onValueChange={(v) => setItemEnabled(item.id, v)}
                thumbColor={item.enabled ? theme.accent : theme.inkDim}
                trackColor={{ false: theme.lineStrong, true: theme.accent }}
              />
              <Pressable
                onPress={() => removeItem(item.id)}
                accessibilityLabel={tt('food_remove', lang)}
                style={({ pressed }) => [styles.removeBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
              </Pressable>
            </View>
          ))
        )}
        {trackedItems.length > 0 ? (
          <Pressable
            onPress={resetAllFoodTimers}
            style={({ pressed }) => [styles.resetBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.resetText, { color: theme.danger }]}>{tt('food_reset', lang)}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── presets (D-01, D-02, D-14) ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.ink }]}>{tt('food_presets_h', lang)}</Text>
        {FOOD_PRESETS.map((preset) => {
          const added = trackedPresetIds.has(preset.id);
          return (
            <View
              key={preset.id}
              style={[styles.row, { borderColor: theme.line, backgroundColor: theme.panel }]}
            >
              <View style={styles.presetText}>
                <Text style={[styles.rowName, { color: theme.ink }]}>{preset.name}</Text>
                <Text style={[styles.presetCaution, { color: theme.inkDim }]} numberOfLines={2}>
                  {preset.cautionText}
                </Text>
              </View>
              <Pressable
                onPress={() => addPreset(preset.id)}
                disabled={added}
                style={({ pressed }) => [
                  styles.smallButton,
                  {
                    backgroundColor: added ? theme.lineStrong : theme.accent,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text style={[styles.smallButtonText, { color: added ? theme.inkDim : theme.bg }]}>
                  {tt(added ? 'food_added' : 'food_add_preset', lang)}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* ── custom item (Task 3, D-12) ── */}
      <View style={[styles.panel, { borderColor: theme.line, backgroundColor: theme.panel }]}>
        <View style={styles.customHead}>
          <Text style={[styles.panelTitle, { color: theme.ink }]}>{tt('food_custom_h', lang)}</Text>
          <Pressable onPress={() => setShowCustom((v) => !v)}>
            <Ionicons
              name={showCustom ? 'chevron-up' : 'add-circle-outline'}
              size={24}
              color={theme.accent}
            />
          </Pressable>
        </View>
        {showCustom ? (
          <View style={styles.form}>
            <Text style={[styles.fieldLabel, { color: theme.inkDim }]}>
              {tt('food_name_label', lang)}
            </Text>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder={tt('food_name_ph', lang)}
              placeholderTextColor={theme.inkFaint}
              style={[styles.input, { borderColor: theme.line, color: theme.ink }]}
            />
            <Text style={[styles.fieldLabel, { color: theme.inkDim }]}>
              {tt('food_threshold_label', lang)}
            </Text>
            <TextInput
              value={customHours}
              onChangeText={setCustomHours}
              placeholder={tt('food_threshold_ph', lang)}
              placeholderTextColor={theme.inkFaint}
              keyboardType="numeric"
              style={[styles.input, { borderColor: theme.line, color: theme.ink }]}
            />
            {customError ? (
              <Text style={[styles.warning, { color: theme.danger }]}>{customError}</Text>
            ) : null}
            <View style={styles.formActions}>
              <Pressable
                onPress={submitCustom}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.accent, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Text style={[styles.buttonText, { color: theme.bg }]}>
                  {tt('food_add_custom', lang)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowCustom(false);
                  setCustomError(null);
                }}
                style={({ pressed }) => [styles.resetBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.resetText, { color: theme.inkDim }]}>
                  {tt('food_close', lang)}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16 },
  header: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerText: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800' },
  copy: { fontSize: 14, lineHeight: 20 },
  zone: { fontSize: 14, fontWeight: '700' },
  warning: { fontSize: 14, fontWeight: '700' },
  banner: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 14,
  },
  bannerText: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  note: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  noteText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  card: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    padding: 14,
  },
  cardHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardName: { flex: 1, fontSize: 16, fontWeight: '800' },
  level: { fontSize: 13, fontWeight: '800' },
  cardMeta: { fontSize: 13 },
  panel: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    padding: 16,
  },
  panelTitle: { fontSize: 18, fontWeight: '800' },
  toggleRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  toggleTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 16 },
  row: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  rowName: { flex: 1, fontSize: 15, fontWeight: '700' },
  presetText: { flex: 1, gap: 2 },
  presetCaution: { fontSize: 12, lineHeight: 16 },
  removeBtn: { padding: 4 },
  resetBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  resetText: { fontSize: 14, fontWeight: '700' },
  smallButton: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
  },
  smallButtonText: { fontSize: 14, fontWeight: '800' },
  customHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  form: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  input: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  formActions: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  buttonText: { fontSize: 15, fontWeight: '800' },
});
