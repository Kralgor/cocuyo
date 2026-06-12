import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

import { submitReport } from '@/lib/api';
import { flushQueue, getQueue } from '@/lib/queue';

export function useReportQueue(): { queueLength: number; isFlushing: boolean } {
  const [queueLength, setQueueLength] = useState(() => getQueue().length);
  const [isFlushing, setIsFlushing] = useState(false);

  const flushIfReachable = useCallback(async (isReachable: boolean) => {
    if (!isReachable || isFlushing) return;

    setIsFlushing(true);
    try {
      await flushQueue(submitReport);
      setQueueLength(getQueue().length);
    } finally {
      setIsFlushing(false);
    }
  }, [isFlushing]);

  useEffect(() => {
    // Mount once near the report flow/layout so queued reports sync opportunistically.
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      void flushIfReachable(Boolean(state.isConnected) && state.isInternetReachable === true);
    });

    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;

      void NetInfo.fetch().then(state => {
        void flushIfReachable(Boolean(state.isConnected) && state.isInternetReachable === true);
      });
    });

    setQueueLength(getQueue().length);

    return () => {
      unsubscribeNetInfo();
      appStateSubscription.remove();
    };
  }, [flushIfReachable]);

  return { queueLength, isFlushing };
}
