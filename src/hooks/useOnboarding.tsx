import { useState, useCallback, useEffect, useRef } from 'react';

const ONBOARDING_COMPLETE_KEY = 'ownjournal_onboarding_complete';

export const useOnboarding = () => {
  const [isComplete, setIsComplete] = useState(() => {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  });
  
  const [showTour, setShowTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const autoShowTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-show tour for new users (after a small delay to let UI settle)
  useEffect(() => {
    if (!isComplete) {
      autoShowTimerRef.current = setTimeout(() => {
        if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) !== 'true') {
          setShowTour(true);
        }
        autoShowTimerRef.current = null;
      }, 800);
      
      return () => {
        if (autoShowTimerRef.current) {
          clearTimeout(autoShowTimerRef.current);
          autoShowTimerRef.current = null;
        }
      };
    }
  }, [isComplete]);

  const completeTour = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setIsComplete(true);
    setShowTour(false);
    setTourStepIndex(0);
  }, []);

  const restartTour = useCallback((fullReset?: boolean) => {
    if (fullReset) {
      localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      setIsComplete(false);
    }
    setTourStepIndex(0);
    setShowTour(true);
  }, []);

  const skipTour = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setIsComplete(true);
    setShowTour(false);
    setTourStepIndex(0);
  }, []);

  return {
    isComplete,
    showTour,
    setShowTour,
    tourStepIndex,
    setTourStepIndex,
    completeTour,
    restartTour,
    skipTour,
  };
};
