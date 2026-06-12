import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { tt, type Lang } from '@/lib/i18n';

interface SharePromptProps {
  lang: Lang;
  onShare: () => void;
}

export default function SharePrompt({ lang, onShare }: SharePromptProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.panel, borderColor: theme.line }]}>
      <View style={styles.copy}>
        <Text style={[styles.heading, { color: theme.ink }]}>{tt('share_prompt_heading', lang)}</Text>
        <Text style={[styles.body, { color: theme.inkDim }]}>{tt('share_prompt_body', lang)}</Text>
      </View>
      <Pressable
        onPress={onShare}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.78 : 1 }]}
        accessibilityRole="button"
      >
        <Ionicons name="logo-whatsapp" size={18} color="#1A1A1A" />
        <Text style={styles.buttonText}>{tt('share_prompt_cta', lang)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  copy: {
    gap: 4,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
  },
});
