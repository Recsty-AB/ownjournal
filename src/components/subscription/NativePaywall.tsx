/**
 * NativePaywall
 *
 * Paywall shown inside the iOS / Android Capacitor app. Replaces the
 * SubscriptionBanner upgrade variant on native, where Apple and Google
 * forbid linking to external (Stripe) checkout. The Plus-member confirmation
 * variant of SubscriptionBanner still applies on native — only the
 * "upgrade" surface is replaced.
 *
 * Pricing is read from StoreKit / Play Billing via iapService.getProducts()
 * (NOT from useLocalizedPricing) so the user sees the exact price the store
 * will charge them, in their store currency, with platform tax/VAT applied.
 *
 * Trial copy is gated on iapService.isEligibleForTrial() — the stores
 * enforce one-trial-per-account natively, so we ask them rather than
 * checking our own has_used_trial flag (which only tracks Stripe trials).
 *
 * Required by App Store guideline 3.1.1: Restore Purchases button.
 * Required by App Store guideline 3.1.2: subscription title, length, price
 * (with per-month equivalent), auto-renew/manage-in-store disclosure, and
 * Privacy + Terms links visible on the paywall before purchase confirmation.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Crown, Sparkles, Brain, Lightbulb, Tag, TrendingUp, FileText, FileType, Loader2, RotateCcw,
} from "lucide-react";
import { iapService, IAPError, type IAPProduct, type IAPEntitlement } from "@/services/iapService";
import { getPlatformInfo } from "@/utils/platformDetection";

interface NativePaywallProps {
  /**
   * Called when a purchase (or restore) grants Plus. Receives the entitlement
   * so the parent can flip the UI to Plus immediately, without waiting for the
   * RevenueCat → webhook → DB round-trip.
   */
  onPurchased?: (entitlement?: IAPEntitlement) => void;
}

const proFeatures = [
  { key: "aiAnalysis", icon: Brain },
  { key: "titleSuggestions", icon: Lightbulb },
  { key: "tagSuggestions", icon: Tag },
  { key: "trendAnalysis", icon: TrendingUp },
  { key: "pdfExport", icon: FileText },
  { key: "wordExport", icon: FileType },
];

/**
 * Yearly price → per-month equivalent, formatted in the product's currency.
 * Used in the App Store 3.1.2 disclosure ("$19.99/year — about $1.67/month").
 * Returns null if the product or its priceAmountMicros is missing/zero.
 */
function formatMonthlyEquivalent(product: IAPProduct | null, locale?: string): string | null {
  if (!product || !product.priceAmountMicros || !product.currencyCode) return null;
  const monthlyAmount = product.priceAmountMicros / 12 / 1_000_000;
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: "currency",
      currency: product.currencyCode,
      maximumFractionDigits: 2,
    }).format(monthlyAmount);
  } catch {
    return null;
  }
}

export const NativePaywall = ({ onPurchased }: NativePaywallProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isIOS = getPlatformInfo().platform === "capacitor-ios";

  const [product, setProduct] = useState<IAPProduct | null>(null);
  const [isEligibleForTrial, setIsEligibleForTrial] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  // True when the store/RevenueCat couldn't be reached or no product loaded —
  // distinct from a failed purchase. Shows a retryable "unavailable" message
  // instead of silently leaving the paywall in a dead state.
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingProduct(true);
    setLoadFailed(false);
    (async () => {
      try {
        const [products, eligible] = await Promise.all([
          iapService.getProducts(),
          iapService.isEligibleForTrial(),
        ]);
        if (cancelled) return;
        const loaded = products[0] ?? null;
        setProduct(loaded);
        setIsEligibleForTrial(eligible);
        if (!loaded) setLoadFailed(true);
      } catch (err) {
        if (import.meta.env.DEV) console.warn("Failed to load IAP product:", err);
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setIsLoadingProduct(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const handleRetry = () => setReloadKey((k) => k + 1);

  const showPending = () =>
    toast({
      title: t("subscription.purchasePending", "Purchase pending"),
      description: t("subscription.purchasePendingDesc"),
    });

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const ent = await iapService.purchase();
      if (ent.isPro) {
        toast({
          title: t("subscription.upgradeSuccess"),
          description: t("subscription.upgradeSuccessDesc"),
        });
        onPurchased?.(ent);
      } else {
        // Resolved without an active entitlement — typically a deferred /
        // awaiting-approval purchase. Treat as pending, not a failure.
        showPending();
      }
    } catch (err) {
      if (err instanceof IAPError) {
        // User explicitly dismissed the sheet — no toast at all.
        if (err.code === "USER_CANCELLED") return;
        // Deferred / Ask-to-Buy / sandbox approval — the purchase may still
        // complete, so this is a pending state, not an error.
        if (err.code === "PAYMENT_PENDING") {
          showPending();
          return;
        }
      }
      if (import.meta.env.DEV) console.warn("IAP purchase failed:", err);
      // Show a friendly, localized message rather than the raw store error
      // string (App Store 2.1(b): a cryptic error is a poor user experience).
      toast({
        variant: "destructive",
        title: t("subscription.purchaseFailed", "Purchase failed"),
        description: t("subscription.purchaseFailedDesc"),
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const ent = await iapService.restore();
      if (ent.isPro) {
        toast({
          title: t("subscription.restoreSuccess", "Purchases restored"),
        });
        onPurchased?.(ent);
      } else {
        toast({
          title: t("subscription.restoreNothing", "No purchases to restore"),
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("subscription.restoreFailed", "Restore failed"),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const priceLine = isLoadingProduct ? (
    <Skeleton className="h-7 sm:h-8 w-32 mx-auto" />
  ) : product ? (
    isEligibleForTrial ? (
      <p className="text-xl sm:text-2xl font-bold text-primary">
        {t("subscription.trialPricing", "{{trialDays}} days free, then {{yearlyPrice}}/year", {
          trialDays: product.introOffer?.periodDays ?? 14,
          yearlyPrice: product.priceFormatted,
        })}
      </p>
    ) : (
      <p className="text-xl sm:text-2xl font-bold text-primary">
        {t("subscription.priceYearly", { yearlyPrice: product.priceFormatted })}
      </p>
    )
  ) : null;

  return (
    <Card className="p-4 sm:p-6 bg-gradient-subtle border-2 border-dashed border-primary/20 mb-4 sm:mb-6">
      <div className="text-center space-y-3 sm:space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
          <h3 className="text-base sm:text-lg font-bold text-foreground">
            {t("subscription.unlockInsights")}
          </h3>
          <Sparkles className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          {t("subscription.description")}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 max-w-lg mx-auto">
          {proFeatures.map(({ key, icon: Icon }) => (
            <div key={key} className="text-center p-1.5 sm:p-2">
              <Icon className="w-4 sm:w-5 h-4 sm:h-5 mx-auto mb-1 text-primary" />
              <p className="text-[10px] sm:text-xs font-medium">{t(`subscription.features.${key}`)}</p>
            </div>
          ))}
        </div>

        {loadFailed && !isLoadingProduct ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">
              {t("subscription.iapUnavailable", "In-app purchases aren't available right now")}
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {t("subscription.iapUnavailableDesc", "We couldn't reach the store. Please check your connection and try again.")}
            </p>
            <Button variant="outline" size="sm" onClick={handleRetry} className="mt-1">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              {t("subscription.tryAgain", "Try again")}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1 sm:space-y-2">{priceLine}</div>

            <Button
              onClick={handlePurchase}
              disabled={isPurchasing || isLoadingProduct || !product}
              className="w-full sm:w-auto bg-gradient-primary shadow-glow"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("subscription.processing")}
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4 mr-2" />
                  {isEligibleForTrial
                    ? t("subscription.trialCta", "Start Free Trial")
                    : t("subscription.upgradeToPro")}
                </>
              )}
            </Button>

            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {t("subscription.cancelAnytime")}
            </p>
          </>
        )}

        <div className="pt-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRestore}
            disabled={isRestoring || isPurchasing}
            className="text-xs text-muted-foreground"
          >
            {isRestoring ? (
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3 mr-1.5" />
            )}
            {t("subscription.restorePurchases", "Restore Purchases")}
          </Button>
        </div>

        {/*
          App Store guideline 3.1.2(c) requires the following visible on the
          paywall before purchase: subscription title, length, price (and
          per-unit price where applicable), and the auto-renew / manage-in-
          store disclosure. The static parts (title, length, renewal terms)
          always render — even if the live store price can't be fetched — so
          the required disclosure is never missing. The price line is shown
          once the product has loaded (it reflects the exact store price).
        */}
        <div className="pt-3 mt-1 border-t border-border/50 space-y-1.5 text-[10px] sm:text-xs text-muted-foreground max-w-md mx-auto text-left">
          <p className="font-semibold text-foreground text-center">
            {t("subscription.disclosureTitle")}
          </p>
          {product && (
            <p className="text-center">
              {(() => {
                const monthly = formatMonthlyEquivalent(product, i18n.language);
                return monthly
                  ? t("subscription.priceWithMonthly", {
                      yearlyPrice: product.priceFormatted,
                      monthlyEquivalent: monthly,
                    })
                  : t("subscription.priceYearly", { yearlyPrice: product.priceFormatted });
              })()}
            </p>
          )}
          <p className="text-center">{t("subscription.disclosureLength")}</p>
          <p>
            {t(isIOS ? "subscription.renewalApple" : "subscription.renewalGoogle")}
          </p>
        </div>

        {/*
          App Store guideline 3.1.2 requires Privacy + Terms links visible
          on the paywall surface before purchase confirmation. These are
          internal routes — Apple reviewers click them in-app.
        */}
        <p className="text-[10px] text-muted-foreground space-x-2">
          <Link to="/privacy" className="underline hover:text-primary">
            {t("auth.privacyLink")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className="underline hover:text-primary">
            {t("auth.termsLink")}
          </Link>
        </p>
      </div>
    </Card>
  );
};
