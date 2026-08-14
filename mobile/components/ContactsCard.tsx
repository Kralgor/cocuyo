import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import contactsData from '@/assets/contacts.json';
import { tt, type Lang } from '@/lib/i18n';
import type { MobileTheme } from '@/constants/colors';

interface ContactEntry {
  name: string;
  number: string;
  verified: boolean;
}

interface ContactGroup {
  state: string;
  entries: ContactEntry[];
}

interface ContactsCardProps {
  state: string;
  lang: Lang;
  theme: MobileTheme;
}

const groups = contactsData as ContactGroup[];

export default function ContactsCard({ state, lang, theme }: ContactsCardProps) {
  const national = groups.find(group => group.state === 'national')?.entries ?? [];
  const local = groups.find(group => group.state === state)?.entries ?? [];
  const entries = [...national, ...local];

  if (entries.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.line }]}>
      <Text style={[styles.title, { color: theme.ink }]}>{tt('contacts_header', lang)}</Text>
      {entries.map(entry => {
        const canCall = /^\+?\d+$/.test(entry.number);
        const label = entry.verified ? entry.name : `${entry.name} (${tt('contacts_unverified', lang)})`;

        return (
          <Pressable
            key={`${entry.name}-${entry.number}`}
            disabled={!canCall}
            onPress={() => Linking.openURL(`tel:${entry.number}`)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : canCall ? 1 : 0.58 }]}
            accessibilityRole="button"
            accessibilityLabel={tt('contacts_a11y', lang)
              .replace('{name}', entry.name)
              .replace('{number}', entry.number)}
          >
            <View style={styles.nameWrap}>
              <Ionicons name="call-outline" size={18} color={theme.accent} />
              <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>{label}</Text>
            </View>
            <Text style={[styles.number, { color: theme.inkDim }]}>{entry.number}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  number: {
    fontSize: 13,
    fontWeight: '600',
  },
});
