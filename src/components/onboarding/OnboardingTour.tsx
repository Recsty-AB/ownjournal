import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS, TooltipRenderProps } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface OnboardingTourProps {
  run: boolean;
  stepIndex: number;
  onStepChange: (index: number) => void;
  onComplete: () => void;
  onSkip: () => void;
}

// Custom tooltip component for modern look
const CustomTooltip = ({
  continuous,
  index,
  step,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  size,
}: TooltipRenderProps) => {
  const { t } = useTranslation();
  const isWelcomeOrComplete = step.placement === 'center';
  
  return (
    <div
      {...tooltipProps}
      className="bg-background border border-border rounded-xl shadow-2xl min-w-[280px] max-w-[85vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
      {step.title && (
          <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-2 text-center">
            {step.title}
          </h3>
        )}
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
          {step.content}
        </p>
      </div>
      
      {/* Footer */}
      <div className="px-5 py-4 bg-muted/30 border-t border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: size }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === index ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
            {index + 1}/{size}
          </span>
        </div>
        
        <div className="flex items-center justify-center sm:justify-end gap-2">
          {!isWelcomeOrComplete && (
            <Button
              {...skipProps}
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-8 px-2"
            >
              {t('onboardingTour.buttons.skip', 'Skip')}
            </Button>
          )}
          
          {index > 0 && (
            <Button
              {...backProps}
              variant="ghost"
              size="sm"
              className="h-8 px-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          
          {continuous && (
            <Button
              {...primaryProps}
              size="sm"
              className="h-8 gap-1"
            >
              {isLastStep ? (
                <>
                  {t('onboardingTour.buttons.finish', 'Start Journaling')}
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  {t('onboardingTour.buttons.next', 'Next')}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const OnboardingTour = ({
  run,
  stepIndex,
  onStepChange,
  onComplete,
  onSkip,
}: OnboardingTourProps) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // 7-step tour with center-placed educational content
  const steps: Step[] = [
    // 1. Welcome
    {
      target: 'body',
      content: t('onboardingTour.welcome.content', 'Welcome to OwnJournal - your private, encrypted journal. Let\'s take a quick 30-second tour!'),
      title: t('onboardingTour.welcome.title', 'Welcome!'),
      placement: 'center',
      disableBeacon: true,
    },
    // 2. Timeline
    {
      target: '.tour-timeline',
      content: t('onboardingTour.timeline.content', 'Your journal entries will appear here, organized by date. Click the + button to create your first entry.'),
      title: t('onboardingTour.timeline.title', 'Your Journal Timeline'),
      placement: 'top',
      disableBeacon: true,
    },
    // 3. Sync Status
    {
      target: '.tour-sync-status',
      content: t('onboardingTour.syncStatus.content', 'Once you connect cloud storage, this indicator shows your sync status. Green means synced!'),
      title: t('onboardingTour.syncStatus.title', 'Sync Status'),
      placement: 'bottom',
      disableBeacon: true,
    },
    // 4. Encryption Modes (points to settings button)
    {
      target: '.tour-settings',
      content: t('onboardingTour.encryptionModes.content', 'Choose Simple Mode for easy setup, or E2E Encrypted for maximum privacy with your own password.'),
      title: t('onboardingTour.encryptionModes.title', 'Choose Your Security Level'),
      placement: 'bottom',
      disableBeacon: true,
    },
    // 5. Cloud Storage (points to settings button)
    {
      target: '.tour-settings',
      content: t('onboardingTour.settings.content', 'Connect your cloud storage by tapping "Connect" next to your preferred provider.'),
      title: t('onboardingTour.settings.title', 'Connect Cloud Storage'),
      placement: 'bottom',
      disableBeacon: true,
    },
    // 6. Help
    {
      target: '.tour-help',
      content: t('onboardingTour.help.content', 'Need help anytime? Click here to access guides, tips, and restart this tour.'),
      title: t('onboardingTour.help.title', 'Help & Support'),
      placement: 'bottom',
      disableBeacon: true,
    },
    // 7. Complete
    {
      target: 'body',
      content: t('onboardingTour.complete.content', 'You\'re all set! Start writing your first entry, or open Settings to connect cloud storage for syncing across devices.'),
      title: t('onboardingTour.complete.title', 'Ready to Journal!'),
      placement: 'center',
      disableBeacon: true,
    },
  ];

  const handleCallback = (data: CallBackProps) => {
    const { action, index, status, type, lifecycle } = data;

    if (status === STATUS.FINISHED) {
      onComplete();
      return;
    }

    if (status === STATUS.SKIPPED) {
      onSkip();
      return;
    }

    // Only process after the step is complete (lifecycle: 'complete') to prevent double-triggers
    if (type === EVENTS.STEP_AFTER && lifecycle === 'complete') {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      onStepChange(nextIndex);
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
      // Gracefully skip to next step if target element isn't found
      const nextIndex = index + 1;
      onStepChange(nextIndex);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      callback={handleCallback}
      continuous
      showProgress={false}
      showSkipButton
      scrollToFirstStep
      disableOverlayClose
      spotlightClicks={false}
      tooltipComponent={(props) => (
        <CustomTooltip {...props} />
      )}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          backgroundColor: isDark ? 'hsl(var(--card))' : 'hsl(var(--background))',
          textColor: isDark ? 'hsl(var(--foreground))' : 'hsl(var(--foreground))',
          arrowColor: isDark ? 'hsl(var(--card))' : 'hsl(var(--background))',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10000,
        },
        spotlight: {
          borderRadius: '12px',
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
      }}
      locale={{
        back: t('onboardingTour.buttons.back', 'Back'),
        close: t('onboardingTour.buttons.close', 'Close'),
        last: t('onboardingTour.buttons.finish', 'Start Journaling'),
        next: t('onboardingTour.buttons.next', 'Next'),
        skip: t('onboardingTour.buttons.skip', 'Skip Tour'),
      }}
    />
  );
};
