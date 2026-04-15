/**
 * React hook that runs local AI capability detection once on mount
 * and exposes the result plus a manual refresh function.
 *
 * Guards against setState-after-unmount via an `isActive` ref, and
 * prevents concurrent-refresh races via an in-flight counter so the
 * latest refresh always wins.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  detectLocalAICapability,
  type LocalAICapability,
} from '@/services/localAICapabilities';

export interface UseLocalAICapabilityResult {
  capability: LocalAICapability | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useLocalAICapability(): UseLocalAICapabilityResult {
  const [capability, setCapability] = useState<LocalAICapability | null>(null);
  const [loading, setLoading] = useState(true);
  const isActiveRef = useRef(true);
  const runCounterRef = useRef(0);

  const run = useCallback(async () => {
    const myRun = ++runCounterRef.current;
    if (isActiveRef.current) setLoading(true);
    try {
      const result = await detectLocalAICapability();
      // Only apply if we're still the latest run AND the component is mounted
      if (isActiveRef.current && myRun === runCounterRef.current) {
        setCapability(result);
      }
    } finally {
      if (isActiveRef.current && myRun === runCounterRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isActiveRef.current = true;
    run();
    return () => {
      isActiveRef.current = false;
    };
  }, [run]);

  return { capability, loading, refresh: run };
}
