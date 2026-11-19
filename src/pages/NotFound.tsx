import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentMeta";
import logo from "@/assets/logo.png";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();
  useDocumentTitle(t('notFound.title'));

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.error(
        "404 Error: User attempted to access non-existent route:",
        location.pathname
      );
    }
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <img src={logo} alt="" className="mx-auto mb-6 h-12 w-12 object-contain dark:invert" />
        <h1 className="text-6xl font-semibold text-foreground">{t('notFound.title')}</h1>
        <p className="mb-8 mt-3 text-lg text-muted-foreground">{t('notFound.message')}</p>
        <Button asChild className="h-11 rounded-full px-6 bg-gradient-primary shadow-glow">
          <a href="/">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t('notFound.returnHome')}
          </a>
        </Button>
      </div>
    </main>
  );
};

export default NotFound;
