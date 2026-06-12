import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [message, opacity]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: theme.panel, borderColor: theme.lineStrong, opacity }]}>
      <Text style={[styles.text, { color: theme.ink }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 30,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
});
