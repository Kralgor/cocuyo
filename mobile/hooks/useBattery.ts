import * as Battery from 'expo-battery';
import { useEffect, useState } from 'react';

export function useBattery(): { isBatterySaving: boolean; isLowPower: boolean; level: number } {
  const [level, setLevel] = useState(1);

  useEffect(() => {
    let mounted = true;

    Battery.getBatteryLevelAsync().then(nextLevel => {
      if (mounted && nextLevel !== -1) {
        setLevel(nextLevel);
      }
    });

    const subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (batteryLevel !== -1) {
        setLevel(batteryLevel);
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const isBatterySaving = level !== -1 && level < 0.2;

  return { isBatterySaving, isLowPower: isBatterySaving, level };
}
