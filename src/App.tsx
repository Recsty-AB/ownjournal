import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Demo from "./pages/Demo";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import OAuthCallback from "./pages/OAuthCallback";
import StorageOAuthCallback from "./pages/StorageOAuthCallback";
import OAuthCallbackWeb from "./pages/OAuthCallbackWeb";
import "./i18n/config";

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
