import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Sparkles, Brain, Lightbulb, Tag, TrendingUp, FileText, FileType, Loader2, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocalizedPricing } from "@/hooks/useLocalizedPricing";
import { CurrencyCode } from "@/config/pricing";
import { canShowPurchaseCTA } from "@/utils/platformDetection";

interface SubscriptionBannerProps {
  onUpgrade: (currency: CurrencyCode) => void;
  isPro?: boolean;
  isLoading?: boolean;
  onManageSubscription?: () => void;
  isManagingSubscription?: boolean;
  hasStripeCustomer?: boolean;
  subscriptionStatus?: string | null;
  hasUsedTrial?: boolean;
}

const proFeatures = [
  { key: "aiAnalysis", icon: Brain },
  { key: "titleSuggestions", icon: Lightbulb },
  { key: "tagSuggestions", icon: Tag },
  { key: "trendAnalysis", icon: TrendingUp },
  { key: "pdfExport", icon: FileText },
  { key: "wordExport", icon: FileType },
];

export const SubscriptionBanner = ({
  onUpgrade,
  isPro = false,
  isLoading = false,
  onManageSubscription,
  isManagingSubscription = false,
  hasStripeCustomer = false,
  subscriptionStatus,
  hasUsedTrial = true,
}: SubscriptionBannerProps) => {
  const { t } = useTranslation();
  const { currency, yearlyPrice, isDetecting } = useLocalizedPricing();

  const isTrialing = isPro && subscriptionStatus === 'trialing';

  if (isPro) {
    return (
      <Card className="p-3 sm:p-4 bg-gradient-primary text-primary-foreground shadow-glow mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <Crown className="w-5 h-5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm sm:text-base">
              {isTrialing ? t('subscription.trialMember', 'Plus Trial') : t('subscription.proMember')}
            </p>
            <p className="text-xs sm:text-sm opacity-90">{t('subscription.enjoyingFeatures')}</p>
          </div>
          {/*
            Manage Subscription opens the Stripe billing portal, which is
            external payment management. App Store anti-steering and Google
            Play billing policy both disallow linking to external payment
            surfaces from inside native apps, so this button is hidden on
            Capacitor iOS/Android. Everything else in the Plus-member card
            (crown icon, "Plus Member" label, feature confirmation text) is
            purely informational status and stays visible on all platforms.
          */}
          {canShowPurchaseCTA() && hasStripeCustomer && onManageSubscription && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onManageSubscription}
              disabled={isManagingSubscription}
              className="flex-shrink-0"
            >
              {isManagingSubscription ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-1.5" />
              )}
              {!isManagingSubscription && t('subscription.manageButton')}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const showTrialCta = !hasUsedTrial;

  return (
    <Card className="p-4 sm:p-6 bg-gradient-subtle border-2 border-dashed border-primary/20 mb-4 sm:mb-6">
      <div className="text-center space-y-3 sm:space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
          <h3 className="text-base sm:text-lg font-bold text-foreground">{t('subscription.unlockInsights')}</h3>
          <Sparkles className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          {t('subscription.description')}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 max-w-lg mx-auto">
          {proFeatures.map(({ key, icon: Icon }) => (
            <div key={key} className="text-center p-1.5 sm:p-2">
              <Icon className="w-4 sm:w-5 h-4 sm:h-5 mx-auto mb-1 text-primary" />
              <p className="text-[10px] sm:text-xs font-medium">{t(`subscription.features.${key}`)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1 sm:space-y-2">
          {isDetecting ? (
            <Skeleton className="h-7 sm:h-8 w-24 mx-auto" />
          ) : showTrialCta ? (
            <p className="text-xl sm:text-2xl font-bold text-primary">
              {t('subscription.trialPricing', '14 days free, then {{yearlyPrice}}/year', { yearlyPrice })}
            </p>
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-primary">
              {t('subscription.priceYearly', { yearlyPrice })}
            </p>
          )}
        </div>

        <Button
          onClick={() => onUpgrade(currency)}
          disabled={isLoading}
          className="w-full sm:w-auto bg-gradient-primary shadow-glow"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('subscription.processing')}
            </>
          ) : (
            <>
              <Crown className="w-4 h-4 mr-2" />
              {showTrialCta
                ? t('subscription.trialCta', 'Start Free Trial')
                : t('subscription.upgradeToPro')}
            </>
          )}
        </Button>

        <p className="text-[10px] sm:text-xs text-muted-foreground">
          {t('subscription.cancelAnytime')}
        </p>
      </div>
    </Card>
  );
};
