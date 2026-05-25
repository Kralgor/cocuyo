import ZonePicker from '@/components/ZonePicker';
import { storage, STORAGE_KEYS } from '@/lib/storage';

// ── ZonePickerScreen ───────────────────────────────────────────────────────────
// Route: zone-picker.tsx — guarded by Stack.Protected (shown when
// hasSeenOnboarding === true && !selectedZone, per _layout.tsx).
//
// Renders <ZonePicker> with an onSelect callback that writes selectedZone to MMKV.
// Writing selectedZone triggers the Stack.Protected guard in _layout.tsx to
// re-evaluate synchronously, advancing to (tabs) automatically (Pattern 2).
//
// Do NOT call router.replace/push — Stack.Protected handles routing (D-10).
// ZonePicker is reusable: Settings "Cambiar zona" in Plan 04 also uses it.
export default function ZonePickerScreen() {
  // ── handleSelect ──────────────────────────────────────────────────────────────
  // Sets the canonical region key in MMKV.
  // Stack.Protected guard becomes true → _layout.tsx renders (tabs) automatically.
  function handleSelect(zoneKey: string): void {
    storage.set(STORAGE_KEYS.selectedZone, zoneKey);
  }

  return <ZonePicker onSelect={handleSelect} />;
}
