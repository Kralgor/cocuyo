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
