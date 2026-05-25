import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

// ── Zone tab placeholder ───────────────────────────────────────────────────────
// The full zone detail screen (StatusHero, StaleBanner, SignalCards) is built
// in Plan 04. This placeholder renders a loading state so the tab bar is visible
// and functional in Phase 1 before Plan 04 is complete.
export default function ZoneScreen() {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex:            1,
      alignItems:      'center',
      justifyContent:  'center',
      backgroundColor: theme.bg,
    },
    text: {
      fontSize: 16,
      color:    theme.inkDim,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Cocuyo — cargando…</Text>
    </View>
  );
}
