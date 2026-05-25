// ── react-native-mmkv mock ─────────────────────────────────────────────────────
// In-memory store implementing the MMKV interface for tests.
// Source: github.com/mrousavy/react-native-mmkv (Jest mocking section)
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => {
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
    };
  }),
}));

// ── @react-native-community/netinfo mock ───────────────────────────────────────
// Returns isConnected: true by default — tests can override per-case.
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: jest.fn(() => ({ isConnected: true })),
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));
