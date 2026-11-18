import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS, TooltipRenderProps } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface OnboardingTourProps {
  run: boolean;
  stepIndex: number;
  onStepChange: (index: number) => void;
  onComplete: () => void;
  onSkip: () => void;
}

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

  return (
    <div
      {...tooltipProps}
      className="surface min-w-[280px] max-w-[min(28rem,calc(100vw-2rem))] overflow-hidden shadow-large animate-in fade-in-0 duration-200"
    >
      <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <p className="eyebrow mb-2 tabular-nums">
          {index + 1}/{size}
        </p>
        {step.title && (
          <h3 className="mb-2 text-2xl font-semibold leading-tight text-foreground">
            {step.title}
          </h3>
        )}
        <p className="whitespace-pre-line text-base leading-relaxed text-muted-foreground">
          {step.content}
        </p>
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 pt-3 sm:px-6"
        style={{ paddingBottom: 'calc(0.75rem + var(--safe-area-inset-bottom))' }}
      >
        <Button
          {...skipProps}
          variant="ghost"
          size="sm"
          className="-ml-3 h-10 rounded-full px-3 text-muted-foreground"
        >
          {t('onboardingTour.buttons.skip', 'Skip')}
        </Button>

        <div className="flex items-center gap-1">
          {index > 0 && (
            <Button
              {...backProps}
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}

          {continuous && (
            <Button
              {...primaryProps}
              size="sm"
              className="h-10 gap-1 rounded-full px-5"
            >
              {isLastStep ? (
                <>
                  {t('onboardingTour.buttons.finish', 'Start Journaling')}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </>
              ) : (
                <>
                  {t('onboardingTour.buttons.next', 'Next')}
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
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
          backgroundColor: 'hsl(var(--card))',
          textColor: 'hsl(var(--foreground))',
          arrowColor: 'hsl(var(--card))',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10000,
        },
        spotlight: {
          borderRadius: '16px',
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
