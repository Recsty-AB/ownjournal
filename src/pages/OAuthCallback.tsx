import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

/**
 * OAuth Callback Handler
 * 
 * This page handles OAuth redirects for both web and native (Capacitor) platforms.
 * Tokens are passed in the URL hash fragment: #access_token=...&refresh_token=...
 */
const OAuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get tokens from URL hash fragment
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const errorParam = hashParams.get("error");
        const errorDescription = hashParams.get("error_description");

        if (errorParam) {
          console.error("OAuth error:", errorParam, errorDescription);
          setStatus("error");
          setErrorMessage(errorDescription || errorParam);
          setTimeout(() => navigate("/", { replace: true }), 3000);
          return;
        }

        if (!accessToken || !refreshToken) {
          // No tokens in hash - check if Supabase auto-detection already set the session
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            if (import.meta.env.DEV) console.log("Session already established by auto-detection:", session.user?.email);
            setStatus("success");
            navigate("/", { replace: true });
            return;
          }
          console.warn("No tokens in URL hash, redirecting to home");
          navigate("/", { replace: true });
          return;
        }

        if (import.meta.env.DEV) {
          console.log("🔐 Processing OAuth callback with tokens...");
        }

        // Set the session with the tokens from the URL
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("Failed to set session:", error);
          setStatus("error");
          setErrorMessage(error.message);
          setTimeout(() => navigate("/", { replace: true }), 3000);
          return;
        }

        if (import.meta.env.DEV) {
          console.log("✅ Session set successfully:", data.user?.email);
        }

        setStatus("success");

        // Clean URL and redirect to home
        navigate("/", { replace: true });
      } catch (error) {
        console.error("OAuth callback error:", error);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
        setTimeout(() => navigate("/", { replace: true }), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4" style={{ paddingTop: 'calc(var(--safe-area-inset-top) + 1rem)' }}>
      <div className="w-full max-w-sm text-center">
        <img src={logo} alt="" className="mx-auto mb-8 h-12 w-12 object-contain dark:invert" />
        {status === "processing" && (
          <>
            <Loader2 aria-hidden="true" className="mx-auto mb-4 h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-2xl font-semibold text-foreground">Completing sign in...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 aria-hidden="true" className="mx-auto mb-4 h-6 w-6 text-diagnostic-success" />
            <p className="text-2xl font-semibold text-foreground">Signed in successfully!</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle aria-hidden="true" className="mx-auto mb-4 h-6 w-6 text-diagnostic-error" />
            <p className="text-2xl font-semibold text-foreground">Sign in failed</p>
            {errorMessage && (
              <p className="mt-3 text-sm text-foreground [overflow-wrap:anywhere]">{errorMessage}</p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">Redirecting...</p>
          </>
        )}
      </div>
    </main>
  );
};

export default OAuthCallback;
