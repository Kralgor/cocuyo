import Ionicons from '@expo/vector-icons/Ionicons';
import { getLocales } from 'expo-localization';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import BatteryBanner from '@/components/BatteryBanner';
import ContactsCard from '@/components/ContactsCard';
import SettingsModal from '@/components/SettingsModal';
import SignalCard from '@/components/SignalCard';
import StaleBanner from '@/components/StaleBanner';
import StatusHero from '@/components/StatusHero';
import { useBattery } from '@/hooks/useBattery';
import { useOffline } from '@/hooks/useOffline';
import { useStatus } from '@/hooks/useStatus';
import { useTheme } from '@/hooks/useTheme';
import { composeShareText, shareToWhatsApp } from '@/lib/share';
import { tt, type Lang } from '@/lib/i18n';
import { REGIONS } from '@/lib/regions';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import type { MobileTheme } from '@/constants/colors';

const NORMAL_REFRESH_MS = 10 * 60 * 1000;
const BATTERY_SAVING_REFRESH_MS = 30 * 60 * 1000;

function detectLang(): Lang {
  const primary = getLocales()[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

export default function ZoneScreen() {
  const lang = detectLang();
  const { theme } = useTheme();
  const { isBatterySaving } = useBattery();
  const { isOffline, isStale, ageMinutes, hasCache } = useOffline();
  const { data, isLoading, isError, refetch } = useStatus(
    isBatterySaving ? BATTERY_SAVING_REFRESH_MS : NORMAL_REFRESH_MS,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const selectedZone = storage.getString(STORAGE_KEYS.selectedZone) ?? '';
  const region = data?.regions?.[selectedZone];
  const styles = createStyles(theme);
  const showBanner = (isOffline || isStale) && hasCache;
  const showSkeleton = isLoading && !region;
  const showFirstError = isError && !region;
  const showNoZoneData = !isLoading && !isError && data && !region;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleShare() {
    if (!region) return;
    await shareToWhatsApp(composeShareText(region, selectedZone, lang));
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerZone} numberOfLines={1}>
          {region?.display_name ?? selectedZone}
        </Text>
        <Pressable
          onPress={() => setSettingsOpen(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={tt('open_settings', lang)}
        >
          <Ionicons name="settings-outline" size={24} color={theme.inkDim} />
        </Pressable>
      </View>

      {showBanner && <StaleBanner ageMinutes={ageMinutes} />}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        <BatteryBanner visible={isBatterySaving} lang={lang} theme={theme} />

        {region && (region.crowd_reports_30min ?? 0) > 0 && (
          <View style={styles.crowdCallout}>
            <Ionicons name="people" size={16} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.crowdTitle}>
                {region.crowd_reports_30min === 1
                  ? tt('crowd_1_active', lang)
                  : tt('crowd_n_active', lang).replace('{n}', String(region.crowd_reports_30min))}
              </Text>
              <Text style={styles.crowdSub}>{tt('crowd_sub', lang)}</Text>
            </View>
          </View>
        )}

        {showFirstError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{tt('no_data_first_launch', lang)}</Text>
          </View>
        ) : showNoZoneData ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{tt('no_data_zone', lang)}</Text>
          </View>
        ) : (
          <View style={styles.heroWrap}>
            <StatusHero status={region?.status ?? 'no_data'} outage={region?.outage} isLoading={showSkeleton} />
            {region && !showSkeleton && (
              <Pressable
                onPress={handleShare}
                style={styles.shareButton}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={lang === 'en' ? 'Share status via WhatsApp' : 'Compartir estado por WhatsApp'}
              >
                <Ionicons name="share-social-outline" size={20} color="rgba(255,255,255,0.86)" />
              </Pressable>
            )}
          </View>
        )}

        {region && !showSkeleton && (
          <>
            <View style={styles.signalSection}>
              <SignalCard labelKey="signal_int" value={region.signals.internet} />
              <SignalCard labelKey="signal_crowd" value={region.signals.crowdsource} />
              <SignalCard labelKey="signal_sat" value={region.signals.satellite} />
            </View>
            <ContactsCard state={REGIONS[selectedZone]?.state ?? ''} lang={lang} theme={theme} />
          </>
        )}

        {showSkeleton && (
          <View style={styles.signalSection}>
            <SkeletonCard theme={theme} />
            <SkeletonCard theme={theme} />
            <SkeletonCard theme={theme} />
          </View>
        )}

        {!showBanner && !showSkeleton && !showFirstError && !showNoZoneData && (
          <Text style={styles.lastUpdated}>{tt('last_updated', lang).replace('{N}', String(ageMinutes))}</Text>
        )}
      </ScrollView>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

function SkeletonCard({ theme }: { theme: MobileTheme }) {
  return <View style={[stylesStatic.skeleton, { backgroundColor: theme.panel }]} />;
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    header: {
      height: 48,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerZone: {
      flex: 1,
      color: theme.ink,
      fontSize: 20,
      fontWeight: '700',
      marginRight: 12,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 16,
    },
    heroWrap: {
      position: 'relative',
    },
    crowdCallout: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.panel,
      borderWidth: 1,
      borderColor: theme.accent,
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
    },
    crowdTitle: {
      color: theme.ink,
      fontSize: 15,
      fontWeight: '600',
    },
    crowdSub: {
      color: theme.inkDim,
      fontSize: 11,
      marginTop: 2,
    },
    shareButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signalSection: {
      gap: 8,
    },
    errorContainer: {
      minHeight: 120,
      borderRadius: 8,
      backgroundColor: theme.panel,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    errorText: {
      color: theme.inkDim,
      fontSize: 16,
      textAlign: 'center',
    },
    lastUpdated: {
      color: theme.inkFaint,
      fontSize: 12,
      textAlign: 'center',
    },
  });
}

const stylesStatic = StyleSheet.create({
  skeleton: {
    height: 72,
    borderRadius: 8,
    marginBottom: 8,
    opacity: 0.55,
  },
});
