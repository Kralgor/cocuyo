import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tt, type Lang } from '@/lib/i18n';
import type { MobileTheme } from '@/constants/colors';

interface BatteryBannerProps {
  visible: boolean;
  lang: Lang;
  theme: MobileTheme;
}

export default function BatteryBanner({ visible, lang, theme }: BatteryBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: theme.panel, borderColor: theme.lineStrong }]}
      accessibilityLabel={tt('battery_banner_a11y', lang)}
    >
      <Ionicons name="battery-half-outline" size={18} color={theme.warn} />
      <Text style={[styles.text, { color: theme.ink }]}>{tt('battery_saving_banner', lang)}</Text>
      <Pressable onPress={() => setDismissed(true)} hitSlop={10} accessibilityRole="button">
        <Ionicons name="close" size={18} color={theme.inkDim} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
