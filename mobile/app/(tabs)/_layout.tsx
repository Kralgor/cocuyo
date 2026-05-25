import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

// ── TabLayout ──────────────────────────────────────────────────────────────────
// 5-tab Expo Router layout per UI-SPEC Tab Bar table (D-01).
// Imports from 'expo-router' only — no react-navigation imports (RESEARCH.md Pitfall 4).
// Icon names: outline variant for inactive, filled variant for active.
// Icon size: 22dp per UI-SPEC spacing and Pattern 3.
export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   theme.accent,
        tabBarInactiveTintColor: theme.inkDim,
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopColor:  theme.line,
        },
      }}
    >
      {/* Tab 0: Mi Zona — zone detail / home screen (built in Plan 04) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mi Zona',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'location' : 'location-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />

      {/* Tab 1: Reportar — crowd report submission (placeholder in Phase 1) */}
      <Tabs.Screen
        name="report"
        options={{
          title: 'Reportar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'megaphone' : 'megaphone-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />

      {/* Tab 2: Alertas — push notification management (placeholder in Phase 1) */}
      <Tabs.Screen
        name="notify"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />

      {/* Tab 3: Comida — food safety timer (placeholder in Phase 1) */}
      <Tabs.Screen
        name="food"
        options={{
          title: 'Comida',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'restaurant' : 'restaurant-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />

      {/* Tab 4: Historial — outage history (placeholder in Phase 1) */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
    </Tabs>
  );
}
