// ── react-native-mmkv mock ─────────────────────────────────────────────────────
// In-memory store implementing the MMKV interface for tests.
// MMKV v4 uses createMMKV() factory (not new MMKV()) — mock updated accordingly.
// Source: github.com/mrousavy/react-native-mmkv (Jest mocking section)
jest.mock('react-native-mmkv', () => {
  function makeMmkvInstance() {
    const store = {};
    return {
      set: (key, value) => {
        store[key] = value;
      },
      getString: (key) => (typeof store[key] === 'string' ? store[key] : undefined),
      getBoolean: (key) => (typeof store[key] === 'boolean' ? store[key] : undefined),
      getNumber: (key) => (typeof store[key] === 'number' ? store[key] : undefined),
      delete: (key) => {
        delete store[key];
      },
      // MMKV v4 uses remove() not delete() — both exposed in mock for compatibility
      remove: (key) => {
        delete store[key];
      },
    };
  }
  return {
    // v4 API: createMMKV({ id }) factory
    createMMKV: jest.fn().mockImplementation(() => makeMmkvInstance()),
    // Keep MMKV as a class mock for any code that checks instanceof or type
    MMKV: jest.fn().mockImplementation(() => makeMmkvInstance()),
  };
});

// ── @react-native-community/netinfo mock ───────────────────────────────────────
// Returns isConnected: true by default — tests can override per-case.
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: jest.fn(() => ({ isConnected: true })),
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

jest.mock('expo-location', () => ({
  Accuracy: {
    Balanced: 3,
  },
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted', granted: true })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude: 10.4806,
        longitude: -66.9036,
      },
    }),
  ),
}));

jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(() => Promise.resolve(0.85)),
  addBatteryLevelListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test123]' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notif-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 4, MAX: 5 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

// ── react-native-svg mock ─────────────────────────────────────────────────────
// Native SVG rendering is not available in jest. Mock renders React elements
// so chart components (HistoryStrip, ForecastCurve) can render without native
// modules. Text is aliased as SvgText in components — kept as a plain mock here.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const mock = (name) => (props) => React.createElement(name, props);
  return {
    __esModule: true,
    default: mock('Svg'),
    Svg: mock('Svg'),
    G: mock('G'),
    Rect: mock('Rect'),
    Line: mock('Line'),
    Path: mock('Path'),
    Defs: mock('Defs'),
    LinearGradient: mock('LinearGradient'),
    Stop: mock('Stop'),
    Text: mock('SvgText'),
  };
});
