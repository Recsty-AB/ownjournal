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
 * Required by App Store guideline 3.1.2: Privacy + Terms links visible on the
 * paywall before purchase confirmation.
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
import { iapService, IAPError, type IAPProduct } from "@/services/iapService";

interface NativePaywallProps {
  /** Called when a purchase completes successfully. Parent should refresh subscription state. */
  onPurchased?: () => void;
}

const proFeatures = [
  { key: "aiAnalysis", icon: Brain },
  { key: "titleSuggestions", icon: Lightbulb },
  { key: "tagSuggestions", icon: Tag },
  { key: "trendAnalysis", icon: TrendingUp },
  { key: "pdfExport", icon: FileText },
  { key: "wordExport", icon: FileType },
];

export const NativePaywall = ({ onPurchased }: NativePaywallProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [product, setProduct] = useState<IAPProduct | null>(null);
  const [isEligibleForTrial, setIsEligibleForTrial] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [products, eligible] = await Promise.all([
          iapService.getProducts(),
          iapService.isEligibleForTrial(),
        ]);
        if (cancelled) return;
        setProduct(products[0] ?? null);
        setIsEligibleForTrial(eligible);
      } catch (err) {
        if (import.meta.env.DEV) console.warn("Failed to load IAP product:", err);
      } finally {
        if (!cancelled) setIsLoadingProduct(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const ent = await iapService.purchase();
      if (ent.isPro) {
        toast({
          title: t("subscription.upgradeSuccess"),
          description: t("subscription.upgradeSuccessDesc"),
        });
        onPurchased?.();
      } else {
        toast({
          title: t("subscription.purchasePending", "Purchase pending"),
          description: t("subscription.purchasePending"),
        });
      }
    } catch (err) {
      if (err instanceof IAPError && err.code === "USER_CANCELLED") {
        // No toast — user explicitly cancelled.
        return;
      }
      toast({
        variant: "destructive",
        title: t("subscription.purchaseFailed", "Purchase failed"),
        description: err instanceof Error ? err.message : String(err),
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
        onPurchased?.();
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
  ) : (
    <p className="text-sm text-destructive">
      {t("subscription.purchaseFailed", "Purchase could not be completed")}
    </p>
  );

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
