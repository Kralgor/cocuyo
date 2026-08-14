import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useNotifications } from '@/hooks/useNotifications';
import { useTheme } from '@/hooks/useTheme';
import { REGIONS } from '@/lib/regions';

type ToggleKey = 'notifyOutage' | 'notifyRestoration' | 'notifyNeighbor';

const TOGGLES: { key: ToggleKey; title: string; body: string }[] = [
  {
    key: 'notifyOutage',
    title: 'Sin luz',
    body: 'Aviso cuando tu zona guardada entra en apagón confirmado.',
  },
  {
    key: 'notifyRestoration',
    title: 'Volvió la luz',
    body: 'Aviso cuando la recuperación queda confirmada.',
  },
  {
    key: 'notifyNeighbor',
    title: 'Aviso de zona vecina',
    body: 'Aviso factual si una zona cercana a la tuya queda afectada.',
  },
];

export default function NotifyScreen() {
  const { theme } = useTheme();
  const {
    selectedZone,
    permissionGranted,
    prefs,
    busy,
    error,
    enableNotifications,
    setPreference,
  } = useNotifications();

  const zoneName = selectedZone ? REGIONS[selectedZone]?.display_name ?? selectedZone : null;
  const enabled = permissionGranted;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.header, { borderColor: theme.line, backgroundColor: theme.panel }]}>
        <View style={[styles.icon, { backgroundColor: theme.lineStrong }]}>
          <Ionicons name="notifications" size={22} color={theme.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: theme.inkDim }]}>Alertas Cocuyo</Text>
          <Text style={[styles.title, { color: theme.ink }]}>Notificaciones de apagones</Text>
        </View>
      </View>

      {!enabled ? (
        <View style={[styles.panel, { borderColor: theme.line, backgroundColor: theme.panel }]}>
          <Text style={[styles.panelTitle, { color: theme.ink }]}>
            Activa avisos para tu zona guardada
          </Text>
          <Text style={[styles.copy, { color: theme.inkDim }]}>
            Cocuyo guarda solo un token anónimo, tu zona guardada y tus preferencias. No se
            adjunta identidad ni ubicación GPS.
          </Text>
          {zoneName ? (
            <Text style={[styles.zone, { color: theme.ink }]}>Zona: {zoneName}</Text>
          ) : (
            <Text style={[styles.warning, { color: theme.warn }]}>
              Elige una zona antes de activar notificaciones.
            </Text>
          )}
          <Pressable
            disabled={busy || !selectedZone}
            onPress={enableNotifications}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: selectedZone ? theme.accent : theme.lineStrong,
                opacity: pressed || busy ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: theme.bg }]}>
              {busy ? 'Activando...' : 'Activar notificaciones'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.panel, { borderColor: theme.line, backgroundColor: theme.panel }]}>
          <Text style={[styles.panelTitle, { color: theme.ink }]}>
            Suscripción activa
          </Text>
          <Text style={[styles.copy, { color: theme.inkDim }]}>
            Zona guardada: {zoneName ?? 'sin zona'}. Los avisos no prometen hora de regreso.
          </Text>
          <View style={styles.toggleList}>
            {TOGGLES.map(item => (
              <View key={item.key} style={[styles.toggleRow, { borderColor: theme.line }]}>
                <View style={styles.toggleText}>
                  <Text style={[styles.toggleTitle, { color: theme.ink }]}>{item.title}</Text>
                  <Text style={[styles.toggleBody, { color: theme.inkDim }]}>{item.body}</Text>
                </View>
                <Switch
                  value={prefs[item.key]}
                  disabled={busy}
                  onValueChange={value => void setPreference(item.key, value)}
                  thumbColor={prefs[item.key] ? theme.accent : theme.inkDim}
                  trackColor={{ false: theme.lineStrong, true: theme.accent }}
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {error ? (
        <View style={[styles.error, { borderColor: theme.warn, backgroundColor: theme.panel }]}>
          <Text style={[styles.errorText, { color: theme.warn }]}>{error}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
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
  headerText: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  panel: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
    padding: 16,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  copy: {
    fontSize: 15,
    lineHeight: 21,
  },
  zone: {
    fontSize: 15,
    fontWeight: '700',
  },
  warning: {
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  toggleList: {
    gap: 10,
  },
  toggleRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  toggleText: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  toggleBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
