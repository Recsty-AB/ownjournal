import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/** Parse tokens, PKCE code, and OAuth error from current URL (hash first, then query). */
function parseTokensFromUrl(): {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  errorParam: string | null;
  errorDescription: string | null;
} {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  let accessToken = hashParams.get("access_token");
  let refreshToken = hashParams.get("refresh_token");
  const errorParam = hashParams.get("error");
  const errorDescription = hashParams.get("error_description");

  const queryParams = new URLSearchParams(window.location.search);
  if (!accessToken || !refreshToken) {
    const queryAccess = queryParams.get("access_token");
    const queryRefresh = queryParams.get("refresh_token");
    if (queryAccess && queryRefresh) {
      accessToken = queryAccess;
      refreshToken = queryRefresh;
    }
  }
  const code = queryParams.get("code");

  return { accessToken, refreshToken, code, errorParam, errorDescription };
}

const RETRY_DELAY_MS = 250;
const MAX_RETRIES = 6;

/**
 * OAuth Callback Handler for Web Browser
 *
 * This page handles OAuth redirects specifically for web browser users.
 * It uses a separate path (/web-oauth-callback) to prevent Android App Links
 * from intercepting the URL and opening the native app.
 *
 * Supports both:
 * - Token flow: #access_token=...&refresh_token=... (or in query)
 * - PKCE flow: ?code=... (exchangeCodeForSession)
 */
const OAuthCallbackWeb = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // Initial delay so URL is settled (helps with some mobile browsers)
        await new Promise(resolve => setTimeout(resolve, 150));

        if (cancelled) return;

        let parsed = parseTokensFromUrl();
        console.log("🔐 OAuth callback URL:", window.location.href);
        console.log("🔐 Hash params:", Object.fromEntries(new URLSearchParams(window.location.hash.substring(1))));

        if (parsed.errorParam) {
          console.error("OAuth error:", parsed.errorParam, parsed.errorDescription);
          if (!cancelled) {
            setStatus("error");
            setErrorMessage(parsed.errorDescription || parsed.errorParam);
            setTimeout(() => navigate("/", { replace: true }), 3000);
          }
          return;
        }

        // Retry reading URL when tokens/code are missing (hash can arrive shortly after load)
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          const hasTokens = !!(parsed.accessToken && parsed.refreshToken);
          const hasCode = !!parsed.code;
          if (hasTokens || hasCode) break;
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            if (cancelled) return;
            parsed = parseTokensFromUrl();
          }
        }

        if (parsed.accessToken && parsed.refreshToken) {
          if (import.meta.env.DEV) console.log("🔐 Processing OAuth callback (web) with tokens...");
          const { data, error } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });

          if (cancelled) return;

          if (error) {
            console.error("Failed to set session:", error);
            setStatus("error");
            setErrorMessage(error.message);
            setTimeout(() => navigate("/", { replace: true }), 3000);
            return;
          }

          if (import.meta.env.DEV) console.log("✅ Session set successfully:", data.user?.email);
          setStatus("success");
          navigate("/", { replace: true });
          return;
        }

        if (parsed.code) {
          if (import.meta.env.DEV) console.log("🔐 Processing OAuth callback (web) with PKCE code...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(parsed.code);

          if (cancelled) return;

          if (error) {
            console.error("Failed to exchange code for session:", error);
            setStatus("error");
            setErrorMessage(error.message);
            setTimeout(() => navigate("/", { replace: true }), 3000);
            return;
          }

          if (import.meta.env.DEV) console.log("✅ Session set successfully (PKCE):", data.user?.email);
          setStatus("success");
          navigate("/", { replace: true });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (import.meta.env.DEV) console.log("Session already established by auto-detection:", session.user?.email);
          setStatus("success");
          navigate("/", { replace: true });
          return;
        }

        console.warn("No tokens or code in URL after retries, current URL:", window.location.href);
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Authentication incomplete. Please try signing in again.");
          setTimeout(() => navigate("/", { replace: true }), 3000);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("OAuth callback error:", error);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
        setTimeout(() => navigate("/", { replace: true }), 3000);
      }
    };

    handleCallback();

    return () => {
      cancelled = true;
    };
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

export default OAuthCallbackWeb;
