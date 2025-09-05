import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Cloud, Smartphone, Lock, Key, AlertTriangle, Copy, Check, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { authSchema } from "@/utils/validation";
import { FEATURES } from "@/config/features";
import { SUPABASE_CONFIG } from "@/config/supabase";
import { 
  isInAppBrowser, 
  getInAppBrowserName, 
  getOpenInBrowserInstructions,
  copyCurrentUrl,
  isIOS 
} from "@/utils/inAppBrowserDetection";
import { translateAuthError } from "@/utils/authErrorTranslator";

type AuthViewMode = 'login' | 'signup' | 'forgot-password';

interface AuthScreenProps {
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
}

export const AuthScreen = ({ onGoogleSignIn, onAppleSignIn }: AuthScreenProps) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<AuthViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // In-app browser detection state
  const [inAppBrowserDetected, setInAppBrowserDetected] = useState(false);
  const [inAppBrowserName, setInAppBrowserName] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check for in-app browser on mount
  useEffect(() => {
    if (isInAppBrowser()) {
      setInAppBrowserDetected(true);
      setInAppBrowserName(getInAppBrowserName());
    }
  }, []);

  // Show notification when landing with auth error in URL (e.g. expired magic link)
  useEffect(() => {
    const hash = window.location.hash?.substring(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const error = params.get("error");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");
    if (!error) return;

    const title =
      errorCode === "otp_expired"
        ? t("auth.linkExpired", "Link expired or invalid")
        : t("auth.authError");
    const description =
      errorCode === "otp_expired"
        ? t("auth.linkExpiredDesc", "This sign-in link has expired or was already used. Please sign in again or request a new link.")
        : (errorDescription || error);

    toast({
      title,
      description,
      variant: "destructive",
      duration: 8000,
    });

    // Clean URL so the message doesn't reappear on refresh
    const cleanHash = hash
      .split("&")
      .filter(
        (p) =>
          !p.startsWith("error=") &&
          !p.startsWith("error_code=") &&
          !p.startsWith("error_description=")
      )
      .join("&");
    const newHash = cleanHash ? `#${cleanHash}` : "";
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + newHash
    );
  }, [toast, t]);

  const handleCopyUrl = async () => {
    const success = await copyCurrentUrl();
    if (success) {
      setUrlCopied(true);
      toast({
        title: t('auth.urlCopied', 'URL copied!'),
        description: t('auth.urlCopiedDesc', "Now tap the menu and select 'Open in Browser'"),
        duration: 8000,
      });
      // Reset after 3 seconds
      setTimeout(() => setUrlCopied(false), 3000);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading('email');
    
    // Validate input
    const result = authSchema.safeParse({ email, password });
    if (!result.success) {
      const firstError = result.error.errors[0];
      toast({
        title: t('auth.authError'),
        description: firstError.message,
        variant: "destructive",
      });
      setIsLoading(null);
      return;
    }

    const isSignUp = viewMode === 'signup';

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        
        if (error) throw error;
        
        toast({
          title: t('auth.accountCreated'),
          description: `${t('auth.accountCreatedDesc')} ${t('auth.checkSpamHint')}`,
          duration: 15000,
        });
        setViewMode('login');
        setEmail('');
        setPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
      }
    } catch (error) {
      const { title, description } = translateAuthError(error as Error, t);
      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: t('auth.authError'),
        description: t('auth.resetPasswordDesc'),
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading('reset');
    try {
      // Check if email exists first
      const checkResponse = await fetch(
        `${SUPABASE_CONFIG.url}/functions/v1/check-email-exists`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          },
          body: JSON.stringify({ email }),
        }
      );
      
      const checkResult = await checkResponse.json();
      
      if (!checkResult.exists) {
        toast({
          title: t('auth.noAccountFound'),
          description: t('auth.noAccountFoundDesc'),
          variant: "destructive",
        });
        setIsLoading(null);
        return;
      }

      // Email exists, proceed with reset
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      
      if (error) throw error;
      
      toast({
        title: t('auth.checkEmail'),
        description: t('auth.resetLinkSent'),
      });
      // Go back to login after successful reset request
      setViewMode('login');
    } catch (error) {
      const { title, description } = translateAuthError(error as Error, t);
      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading('google');
    try {
      await onGoogleSignIn();
    } finally {
      setIsLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading('apple');
    try {
      await onAppleSignIn();
    } finally {
      setIsLoading(null);
    }
  };

  const isSignUp = viewMode === 'signup';
  const isForgotPassword = viewMode === 'forgot-password';

  return (
    <div className="min-h-screen bg-gradient-paper flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        {/* Hero Section */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-gradient-primary flex items-center justify-center shadow-glow p-3">
            <img src={logo} alt="OwnJournal" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('auth.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('auth.subtitle')}
            </p>
          </div>
        </div>

        {/* Features - 2x2 cards on all screen sizes */}
        {!isForgotPassword && (
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-card rounded-lg shadow-soft">
              <Shield className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium text-foreground">{t('features.endToEnd')}</p>
              <p className="text-xs text-muted-foreground">{t('features.encryption')}</p>
            </div>
            <div className="text-center p-3 bg-card rounded-lg shadow-soft">
              <Cloud className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium text-foreground">{t('features.yourStorage')}</p>
              <p className="text-xs text-muted-foreground">{t('features.yourControl')}</p>
            </div>
            <div className="text-center p-3 bg-card rounded-lg shadow-soft">
              <Smartphone className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium text-foreground">{t('features.worksOffline')}</p>
              <p className="text-xs text-muted-foreground">{t('features.alwaysAvailable')}</p>
            </div>
            <div className="text-center p-3 bg-card rounded-lg shadow-soft">
              <Lock className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium text-foreground">{t('features.zeroKnowledge')}</p>
              <p className="text-xs text-muted-foreground">{t('features.privacyFirst')}</p>
            </div>
          </div>
        )}

        {/* Forgot Password View */}
        {isForgotPassword ? (
          <Card className="p-4 shadow-medium bg-gradient-subtle">
            <div className="space-y-3">
              <div className="text-center mb-3">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {t('auth.resetPassword')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('auth.resetPasswordDesc')}
                </p>
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t('auth.email')}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading !== null}
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading !== null}
                  className="w-full"
                >
                  {isLoading === 'reset' ? (
                    <div className="w-4 h-4 mr-3 animate-spin rounded-full border-2 border-gray-300 border-t-white" />
                  ) : null}
                  {t('auth.sendResetLink')}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  onClick={() => setViewMode('login')}
                  disabled={isLoading !== null}
                  className="w-full text-sm"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('auth.backToSignIn')}
                </Button>
              </form>
            </div>
          </Card>
        ) : (
          /* Sign In / Sign Up View */
          <Card className="p-4 shadow-medium bg-gradient-subtle">
            <div className="space-y-3">
              <div className="text-center mb-3">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {t('auth.signInTitle')}
                </h2>
              </div>
              {/* Email/Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading !== null}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth.passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading !== null}
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading !== null}
                  className="w-full"
                >
                  {isLoading === 'email' ? (
                    <div className="w-4 h-4 mr-3 animate-spin rounded-full border-2 border-gray-300 border-t-white" />
                  ) : null}
                  {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
                </Button>

                <div className="text-center space-y-2">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setViewMode(isSignUp ? 'login' : 'signup')}
                    disabled={isLoading !== null}
                    className="text-sm"
                  >
                    {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.noAccount')}
                  </Button>
                  
                  {viewMode === 'login' && (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setViewMode('forgot-password')}
                      disabled={isLoading !== null}
                      className="text-xs block mx-auto"
                    >
                      {t('auth.forgotPassword')}
                    </Button>
                  )}
                </div>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('auth.continueWith')}
                  </span>
                </div>
              </div>

              {/* In-App Browser Warning - positioned above Google button */}
              {inAppBrowserDetected && (
                <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {t('auth.inAppBrowserWarning', { appName: inAppBrowserName || 'this app' })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('auth.inAppBrowserDesc')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyUrl}
                      className="flex-1"
                    >
                      {urlCopied ? (
                        <Check className="w-4 h-4 mr-2 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 mr-2" />
                      )}
                      {urlCopied ? t('auth.copied', 'Copied!') : t('auth.copyUrl', 'Copy URL')}
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading !== null}
                variant="outline"
                className="w-full"
              >
                {isLoading === 'google' ? (
                  <div className="w-4 h-4 mr-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                ) : (
                  <svg className="w-4 h-4 mr-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {t('auth.continueWithGoogle')}
              </Button>

              {FEATURES.APPLE_SIGNIN_ENABLED && (
                <Button
                  onClick={handleAppleSignIn}
                  disabled={isLoading !== null}
                  variant="outline"
                  className="w-full"
                >
                  {isLoading === 'apple' ? (
                    <div className="w-4 h-4 mr-3 animate-spin rounded-full border-2 border-gray-600 border-t-white" />
                  ) : (
                    <svg className="w-4 h-4 mr-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  )}
                  {t('auth.continueWithApple')}
                </Button>
              )}


              <div className="text-xs text-center text-muted-foreground space-y-1 mt-4">
                <p>
                  {t('auth.termsAgreementPrefix')}{" "}
                  <Link to="/terms" className="underline hover:text-primary">
                    {t('auth.termsLink')}
                  </Link>{" "}
                  {t('auth.and')}{" "}
                  <Link to="/privacy" className="underline hover:text-primary">
                    {t('auth.privacyLink')}
                  </Link>
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Key className="w-3 h-3" />
                  <span>{t('auth.dataEncrypted')}</span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
