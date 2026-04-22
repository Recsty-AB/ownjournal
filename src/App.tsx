import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Suspense, lazy } from "react";
import Index from "./pages/Index";
import "./i18n/config";
import { useDocumentLangSync } from "./hooks/useDocumentMeta";

const Demo = lazy(() => import("./pages/Demo"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const StorageOAuthCallback = lazy(() => import("./pages/StorageOAuthCallback"));
const OAuthCallbackWeb = lazy(() => import("./pages/OAuthCallbackWeb"));

const queryClient = new QueryClient();

function AppShell() {
  useDocumentLangSync();
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/oauth-callback" element={<OAuthCallback />} />
              <Route path="/web-oauth-callback" element={<OAuthCallbackWeb />} />
              <Route path="/storage-callback" element={<StorageOAuthCallback />} />
              <Route path="/portal-return" element={<Navigate to="/?portal_return=true" replace />} />
              <Route path="/checkout-success" element={<Navigate to="/?checkout=success" replace />} />
              <Route path="/checkout-cancel" element={<Navigate to="/?checkout=cancel" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppShell />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
