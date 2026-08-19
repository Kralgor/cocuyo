import NetInfo from '@react-native-community/netinfo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getLocales } from 'expo-localization';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import ReportConfirmSheet from '@/components/ReportConfirmSheet';
import SharePrompt from '@/components/SharePrompt';
import Toast from '@/components/Toast';
import ZonePicker from '@/components/ZonePicker';
import { useTheme } from '@/hooks/useTheme';
import { useReportQueue } from '@/hooks/useReportQueue';
import { type ReportPayload, getRecentCount, submitReport } from '@/lib/api';
import { composeShareText, shareToWhatsApp } from '@/lib/share';
import { detectNearestZone } from '@/lib/gps';
import { canEnqueue, enqueue } from '@/lib/queue';
import { tt, type Lang } from '@/lib/i18n';
import { REGIONS } from '@/lib/regions';
import { STORAGE_KEYS, storage } from '@/lib/storage';

function detectLang(): Lang {
  const primary = getLocales()[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

// ── epochNow ───────────────────────────────────────────────────────────────────
// Module-level wrapper so Date.now() (impure) is never called inside the
// component render scope — react-hooks/purity flags it even in event handlers.
function epochNow(): number {
  return Date.now();
}

export default function ReportScreen() {
  const { theme } = useTheme();
  const lang = detectLang();
  const { queueLength } = useReportQueue();
  const [zoneKey, setZoneKey] = useState(() => storage.getString(STORAGE_KEYS.selectedZone) ?? 'caracas');
  const [zonePickerOpen, setZonePickerOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'no_power' | 'power_back' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [lastSubmittedStatus, setLastSubmittedStatus] = useState<'no_power' | 'power_back' | null>(null);
  const [canSubmit, setCanSubmit] = useState(() => canEnqueue());
  const styles = useMemo(() => createStyles(theme), [theme]);
  const region = REGIONS[zoneKey];

  useEffect(() => {
    let mounted = true;

    detectNearestZone().then(detected => {
      if (mounted && detected) {
        setZoneKey(detected);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  function selectZone(nextZone: string) {
    storage.set(STORAGE_KEYS.selectedZone, nextZone);
    setZoneKey(nextZone);
    setZonePickerOpen(false);
  }

  function buildPayload(
    status: 'no_power' | 'power_back',
    parroquia: string | null,
    when: { startedAt: string | null; endedAt: string | null },
  ): ReportPayload {
    return {
      region: zoneKey,
      status,
      lat: region?.lat ?? null,
      lon: region?.lon ?? null,
      city_freetext: null,
      onset_type: null,
      symptom: null,
      device_fingerprint: null,
      parroquia,
      started_at: when.startedAt,
      ended_at: when.endedAt,
    };
  }

  async function handleSubmit(parroquia: string | null, when: { startedAt: string | null; endedAt: string | null }) {
    if (!pendingStatus || !canSubmit) return;

    const payload = buildPayload(pendingStatus, parroquia, when);
    setIsSubmitting(true);

    try {
      const net = await NetInfo.fetch();
      const reachable = Boolean(net.isConnected) && net.isInternetReachable !== false;

      if (reachable) {
        await submitReport(payload);
        storage.set(STORAGE_KEYS.lastReportTime, epochNow());
        // social proof: how many people are reporting right now
        const count = await getRecentCount(zoneKey);
        setToast(
          count != null && count > 1
            ? tt('toast_sent_count', lang).replace('{n}', String(count))
            : tt('toast_sent', lang),
        );
      } else {
        enqueue(payload);
        setToast(tt('toast_queued', lang));
      }

      setLastSubmittedStatus(pendingStatus);
      setShareVisible(true);
      setPendingStatus(null);
      setCanSubmit(canEnqueue());
    } catch {
      enqueue(payload);
      setToast(tt('toast_queued', lang));
      setLastSubmittedStatus(pendingStatus);
      setShareVisible(true);
      setPendingStatus(null);
      setCanSubmit(canEnqueue());
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleShare() {
    if (!region || !lastSubmittedStatus) return;

    await shareToWhatsApp(
      composeShareText(
        { display_name: region.display_name, status: lastSubmittedStatus },
        zoneKey,
        lang,
      ),
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{tt('report_title', lang)}</Text>
            <Text style={styles.zoneName}>{region?.display_name ?? zoneKey}</Text>
          </View>
          <Pressable onPress={() => setZonePickerOpen(true)} style={styles.changeButton} accessibilityRole="button">
            <Ionicons name="location-outline" size={18} color={theme.accent} />
            <Text style={styles.changeText}>{tt('gps_manual', lang)}</Text>
          </Pressable>
        </View>

        {queueLength > 0 && (
          <View style={styles.queueBox}>
            <Ionicons name="cloud-offline-outline" size={18} color={theme.warn} />
            <View style={styles.queueCopy}>
              <Text style={styles.queueTitle}>{tt('queue_pending_header', lang)}</Text>
              <Text style={styles.queueBody}>
                {tt('queue_pending_body', lang).replace('{N}', String(queueLength))}
              </Text>
            </View>
          </View>
        )}

        {!canSubmit && <Text style={styles.cooldown}>{tt('cooldown_notice', lang).replace('{N}', '30')}</Text>}

        <View style={styles.actions}>
          <Pressable
            disabled={!canSubmit}
            onPress={() => setPendingStatus('no_power')}
            style={({ pressed }) => [styles.actionButton, styles.outButton, (!canSubmit || pressed) && styles.dimmed]}
          >
            <Text style={styles.actionText}>{tt('report_out', lang)}</Text>
          </Pressable>
          <Pressable
            disabled={!canSubmit}
            onPress={() => setPendingStatus('power_back')}
            style={({ pressed }) => [styles.actionButton, styles.backButton, (!canSubmit || pressed) && styles.dimmed]}
          >
            <Text style={styles.actionText}>{tt('report_back', lang)}</Text>
          </Pressable>
        </View>

        {shareVisible && <SharePrompt lang={lang} onShare={handleShare} />}
      </ScrollView>

      <ReportConfirmSheet
        visible={pendingStatus !== null}
        lang={lang}
        regionKey={zoneKey}
        status={pendingStatus ?? 'no_power'}
        isSubmitting={isSubmitting}
        onClose={() => setPendingStatus(null)}
        onSubmit={handleSubmit}
      />

      <Modal visible={zonePickerOpen} animationType="slide" onRequestClose={() => setZonePickerOpen(false)}>
        <ZonePicker onSelect={selectZone} />
      </Modal>

      <Toast message={toast} />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      padding: 16,
      gap: 18,
    },
    header: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    eyebrow: {
      color: theme.inkDim,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    zoneName: {
      marginTop: 4,
      color: theme.ink,
      fontSize: 22,
      fontWeight: '700',
    },
    changeButton: {
      minHeight: 44,
      maxWidth: 156,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
    },
    changeText: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: '700',
    },
    queueBox: {
      flexDirection: 'row',
      gap: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.panel,
      padding: 14,
    },
    queueCopy: {
      flex: 1,
      gap: 2,
    },
    queueTitle: {
      color: theme.ink,
      fontSize: 15,
      fontWeight: '700',
    },
    queueBody: {
      color: theme.inkDim,
      fontSize: 13,
      lineHeight: 18,
    },
    cooldown: {
      color: theme.warn,
      fontSize: 14,
      lineHeight: 20,
    },
    actions: {
      gap: 12,
    },
    actionButton: {
      height: 64,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outButton: {
      backgroundColor: theme.danger,
    },
    backButton: {
      backgroundColor: theme.ok,
    },
    dimmed: {
      opacity: 0.52,
    },
    actionText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
    },
  });
}
