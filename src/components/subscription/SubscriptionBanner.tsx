import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Brain, Lightbulb, Tag, TrendingUp, FileText, Mic, Loader2, ExternalLink, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocalizedPricing } from "@/hooks/useLocalizedPricing";
import { useIapOnlyRegion } from "@/hooks/useIapOnlyRegion";
import { CurrencyCode } from "@/config/pricing";
import { canShowStripeCheckout } from "@/utils/platformDetection";
import { PLAY_STORE_URL } from "@/config/app";

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
  { key: "voiceEntry", icon: Mic },
  { key: "exports", icon: FileText },
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
  // UK VAT / NETP compliance: users in IAP-only regions (see
  // @/config/iapOnlyCountries) must not be offered direct Stripe checkout —
  // route them to the store instead. Self-contained here so every render site
  // of this banner (Index + SettingsDialog) gets the behaviour.
  const { isIapOnly, isLoading: isRegionLoading } = useIapOnlyRegion();

  const isTrialing = isPro && subscriptionStatus === 'trialing';

  if (isPro) {
    return (
      <Card className="mb-4 rounded-2xl border-border bg-card px-4 py-3 shadow-soft sm:mb-6 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <Crown aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-seal" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {isTrialing ? t('subscription.trialMember', 'Plus Trial') : t('subscription.proMember')}
            </p>
            <p className="text-sm text-muted-foreground">{t('subscription.enjoyingFeatures')}</p>
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
          {canShowStripeCheckout() && hasStripeCustomer && onManageSubscription && (
            <Button
              variant="outline"
              size="sm"
              onClick={onManageSubscription}
              disabled={isManagingSubscription}
              className="flex-shrink-0 rounded-full"
            >
              {isManagingSubscription ? (
                <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink aria-hidden="true" className="w-4 h-4 mr-1.5" />
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
    <Card className="mb-4 rounded-2xl border-border bg-card p-5 shadow-soft sm:mb-6 sm:p-6">
      <div className="space-y-5">
        {/* Right padding keeps the title clear of the collapse button the plan row overlays. */}
        <div className="space-y-1.5 pr-10">
          <h3 className="text-2xl font-semibold leading-tight text-foreground">{t('subscription.unlockInsights')}</h3>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t('subscription.description')}
          </p>
        </div>

        {/* 6 features: keep 3 columns from sm up so they fill two balanced
            rows — 4 columns would leave a lopsided 4+2 split. */}
        <ul className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4 sm:grid-cols-3">
          {proFeatures.map(({ key, icon: Icon }) => (
            <li key={key} className="flex min-w-0 items-start gap-2.5">
              <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">{t(`subscription.features.${key}`)}</span>
            </li>
          ))}
        </ul>

        {isRegionLoading ? (
          // Wait for region detection before showing any CTA so a UK user
          // never sees the Stripe button flash before it's replaced.
          <Skeleton className="h-16 w-full max-w-xs" />
        ) : isIapOnly ? (
          // UK VAT / NETP compliance: do NOT offer Stripe checkout here.
          // Point the user to the app store IAP path instead, where Apple /
          // Google handle UK VAT. See @/config/iapOnlyCountries.
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              {t('subscription.iapOnly.title', 'Available in the app')}
            </p>
            <p className="max-w-prose text-sm text-muted-foreground">
              {t('subscription.iapOnly.description', 'In your region, OwnJournal Plus is available through the mobile app. Get it from the store to subscribe.')}
            </p>
            <Button asChild className="h-11 w-full rounded-full px-6 bg-gradient-primary shadow-glow sm:w-auto">
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                <Smartphone aria-hidden="true" className="w-4 h-4 mr-2" />
                {t('subscription.iapOnly.getOnPlay', 'Get it on Google Play')}
              </a>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="min-w-0 space-y-1">
              {isDetecting ? (
                <Skeleton className="h-8 w-40" />
              ) : showTrialCta ? (
                <p className="text-2xl font-semibold leading-tight text-foreground">
                  {t('subscription.trialPricing', '14 days free, then {{yearlyPrice}}/year', { yearlyPrice })}
                </p>
              ) : (
                <p className="text-2xl font-semibold leading-tight text-foreground">
                  {t('subscription.priceYearly', { yearlyPrice })}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {t('subscription.cancelAnytime')}
              </p>
            </div>

            <Button
              onClick={() => onUpgrade(currency)}
              disabled={isLoading}
              className="h-11 w-full rounded-full px-6 bg-gradient-primary shadow-glow sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 aria-hidden="true" className="w-4 h-4 mr-2 animate-spin" />
                  {t('subscription.processing')}
                </>
              ) : showTrialCta
                ? t('subscription.trialCta', 'Start Free Trial')
                : t('subscription.upgradeToPro')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
