import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

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

export default OAuthCallbackWeb;
