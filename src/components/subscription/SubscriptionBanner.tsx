import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Sparkles, Brain, Lightbulb, Tag, TrendingUp, FileText, FileType, Image, Loader2, ExternalLink, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocalizedPricing } from "@/hooks/useLocalizedPricing";
import { CurrencyCode } from "@/config/pricing";

interface SubscriptionBannerProps {
  onUpgrade: (currency: CurrencyCode) => void;
  isPro?: boolean;
  isLoading?: boolean;
  onManageSubscription?: () => void;
  isManagingSubscription?: boolean;
  hasStripeCustomer?: boolean;
  subscriptionStatus?: string | null;
  hasUsedTrial?: boolean;
  currentPeriodEnd?: string | null;
}

const proFeatures = [
  { key: "aiAnalysis", icon: Brain },
  { key: "titleSuggestions", icon: Lightbulb },
  { key: "tagSuggestions", icon: Tag },
  { key: "trendAnalysis", icon: TrendingUp },
  { key: "pdfExport", icon: FileText },
  { key: "wordExport", icon: FileType },
  { key: "imageUpload", icon: Image },
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
  currentPeriodEnd,
}: SubscriptionBannerProps) => {
  const { t } = useTranslation();
  const { currency, yearlyPrice, isDetecting } = useLocalizedPricing();

  const isTrialing = isPro && subscriptionStatus === 'trialing';
  const trialDaysRemaining = (() => {
    if (!currentPeriodEnd) return null;
    const ms = new Date(currentPeriodEnd).getTime();
    if (Number.isNaN(ms)) return null;
    return Math.max(0, Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24)));
  })();

  if (isPro) {
    return (
      <Card className={`p-3 sm:p-4 text-primary-foreground shadow-glow mb-4 sm:mb-6 ${isTrialing ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-primary'}`}>
        <div className="flex items-center gap-3">
          {isTrialing ? (
            <Clock className="w-5 h-5 flex-shrink-0" />
          ) : (
            <Crown className="w-5 h-5 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm sm:text-base">
              {isTrialing ? t('subscription.trialMember', 'Plus Trial') : t('subscription.proMember')}
            </p>
            <p className="text-xs sm:text-sm opacity-90">
              {isTrialing && trialDaysRemaining !== null
                ? (trialDaysRemaining <= 1
                    ? t('subscription.trialLastDay', 'Last day of your free trial')
                    : t('subscription.trialDaysRemaining', '{{days}} days remaining in your free trial', { days: trialDaysRemaining }))
                : t('subscription.enjoyingFeatures')}
            </p>
          </div>
          {hasStripeCustomer && onManageSubscription && (
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
