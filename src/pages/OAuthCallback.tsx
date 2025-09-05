import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-lg text-muted-foreground">Completing sign in...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg text-foreground">Signed in successfully!</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-lg text-foreground">Sign in failed</p>
            {errorMessage && (
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            )}
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
