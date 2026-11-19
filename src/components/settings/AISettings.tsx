import { buildAppLink } from "@/config/app";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cloud, AlertCircle, Lock, Crown, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { aiPermissions } from "@/utils/aiPermissions";
import { canShowStripeCheckout } from "@/utils/platformDetection";
import { supabase } from "@/integrations/supabase/client";

interface AISettingsProps {
  onUpgrade?: () => void;
  isUpgrading?: boolean;
}

export const AISettings = ({ onUpgrade, isUpgrading = false }: AISettingsProps) => {
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Check Pro status and Stripe customer ID on mount
  useEffect(() => {
    const checkProStatus = async () => {
      const status = await aiPermissions.isPROSubscriber();
      setIsPro(status);
      
      // Also fetch stripe_customer_id to show manage button
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('subscriptions')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .single();
        setStripeCustomerId(data?.stripe_customer_id || null);
      }
    };
    checkProStatus();
  }, []);

  const handleManageSubscription = async () => {
    if (!canShowStripeCheckout()) return;
    setIsLoadingPortal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: t('index.signInRequired'),
          description: t('index.signInRequiredDesc'),
          variant: "destructive",
        });
        return;
      }

      // Check if running on Capacitor (iOS/Android native app)
      const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();

      // For native apps, use the production URL since window.location.origin is localhost
      const origin = isCapacitor 
        ? buildAppLink() 
        : window.location.origin;

      const response = await supabase.functions.invoke('customer-portal', {
        body: { origin },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      toast({
        title: t('settings.ai.portalError', 'Could not open subscription manager'),
        description: t('settings.ai.portalErrorDesc', 'Please try again later.'),
        variant: "destructive",
      });
    } finally {
      setIsLoadingPortal(false);
    }
  };

  return (
    <div className="divide-y divide-border">
      {isPro ? (
        <section className="flex flex-wrap items-center gap-3 pb-6">
          <Crown className="h-5 w-5 shrink-0 text-seal" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h4 className="flex flex-wrap items-center gap-2 font-medium">
              {t('settings.ai.proMember')}
              <Badge variant="secondary" className="text-xs">{t('settings.ai.active')}</Badge>
            </h4>
            <p className="text-sm text-muted-foreground">
              {t('settings.ai.allFeaturesUnlocked')}
            </p>
          </div>
          {canShowStripeCheckout() && stripeCustomerId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
              className="gap-2"
            >
              {isLoadingPortal ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              )}
              {t('settings.ai.manageSubscription', 'Manage')}
            </Button>
          )}
        </section>
      ) : (
        <section className="surface space-y-4 p-5 text-center sm:p-6">
          <Lock className="mx-auto h-5 w-5 text-seal" aria-hidden="true" />
          <div className="space-y-2">
            <h4 className="text-xl font-semibold">{t('settings.ai.unlockFeatures')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('settings.ai.description')}
            </p>
          </div>
          <Button onClick={onUpgrade} disabled={isUpgrading} className="gap-2">
            {isUpgrading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t('subscription.processing')}
              </>
            ) : (
              <>
                <Crown className="w-4 h-4" aria-hidden="true" />
                {t('settings.upgrade')}
              </>
            )}
          </Button>
        </section>
      )}

      {isPro && (
        <section className="space-y-4 pt-6">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-foreground">
              {t('settings.ai.title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('settings.ai.description')}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Cloud className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {t('settings.ai.analysisEnabled')}
            </h4>
            <p className="text-sm text-muted-foreground">
              {t('settings.ai.description')}
            </p>
            <ul className="space-y-2 pt-1 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-diagnostic-success" aria-hidden="true" />
                <span>{t('settings.ai.supportsAllLanguages')}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-diagnostic-success" aria-hidden="true" />
                <span>{t('settings.ai.advancedModels')}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-diagnostic-success" aria-hidden="true" />
                <span>{t('settings.ai.noDownloads')}</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>{t('settings.ai.requiresInternet')}</span>
              </li>
            </ul>
          </div>

          <div className="notice notice-warning">
            <AlertCircle aria-hidden="true" />
            <p className="text-xs">
              <strong>{t('settings.ai.privacyNote')}:</strong> {t('settings.ai.privacyDesc')}
            </p>
          </div>
        </section>
      )}
    </div>
  );
};
