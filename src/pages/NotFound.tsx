import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "@/hooks/useDocumentMeta";

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
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">{t('notFound.title')}</h1>
        <p className="text-xl text-muted-foreground mb-4">{t('notFound.message')}</p>
        <a href="/" className="text-primary hover:underline">
          {t('notFound.returnHome')}
        </a>
      </div>
    </main>
  );
};

export default NotFound;
