import { buildAppLink } from "@/config/app";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Cloud, AlertCircle, Lock, Crown, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { aiPermissions } from "@/utils/aiPermissions";
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
    <>
      <div className="space-y-6">
        {/* Pro Status Card */}
        {isPro ? (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold flex items-center gap-2">
                    {t('settings.ai.proMember')}
                    <Badge variant="default" className="text-xs">{t('settings.ai.active')}</Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.ai.allFeaturesUnlocked')}
                  </p>
                </div>
                {stripeCustomerId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManageSubscription}
                    disabled={isLoadingPortal}
                    className="gap-2"
                  >
                    {isLoadingPortal ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    {t('settings.ai.manageSubscription', 'Manage')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="p-6 text-center space-y-4">
              <div className="inline-flex p-3 rounded-full bg-primary/10">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-lg mb-2">{t('settings.ai.unlockFeatures')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('settings.ai.description')}
                </p>
              </div>
              <Button onClick={onUpgrade} disabled={isUpgrading} className="gap-2">
                {isUpgrading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('subscription.processing')}
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    {t('settings.upgrade')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* AI Features Info */}
        {isPro && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                {t('settings.ai.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.ai.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-primary bg-primary/5 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Cloud className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-semibold mb-1">{t('settings.ai.analysisEnabled')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.ai.description')}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-primary">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>{t('settings.ai.supportsAllLanguages')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-primary">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>{t('settings.ai.advancedModels')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-primary">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>{t('settings.ai.noDownloads')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{t('settings.ai.requiresInternet')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>{t('settings.ai.privacyNote')}:</strong> {t('settings.ai.privacyDesc')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};
