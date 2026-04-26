import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentMeta";

const TermsOfService = () => {
  const { t } = useTranslation();
  const [isNativeApp, setIsNativeApp] = useState(false);
  useDocumentTitle(t('legal.terms.title'));

  useEffect(() => {
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    setIsNativeApp(isCapacitor);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {isNativeApp ? (
              <Button variant="ghost" asChild>
                <a href="/" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  {t("common.back")}
                </a>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <a href="https://ownjournal.app" className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    {t("legal.backToHomepage")}
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://app.ownjournal.app" className="flex items-center gap-2">
                    {t("legal.openApp")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("legal.terms.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("legal.lastUpdated")}: {t("legal.terms.lastUpdatedDate")}
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.acceptance.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.acceptance.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.description.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.description.content", {
                companyName: t("company.name"),
                companyCountry: t("company.country")
              })}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.accounts.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.accounts.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.subscriptions.title")}
            </h2>
            <p className="text-muted-foreground whitespace-pre-line">
              {t("legal.terms.subscriptions.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.withdrawal.title")}
            </h2>
            <p className="text-muted-foreground whitespace-pre-line">
              {t("legal.terms.withdrawal.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.acceptableUse.title")}
            </h2>
            <p className="text-muted-foreground whitespace-pre-line">
              {t("legal.terms.acceptableUse.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.intellectualProperty.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.intellectualProperty.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.dataStorage.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.dataStorage.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.limitation.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.limitation.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.termination.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.termination.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.changes.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.changes.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.appleTerms.title")}
            </h2>
            <p className="text-muted-foreground whitespace-pre-line">
              {t("legal.terms.appleTerms.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.severability.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.severability.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.contact.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.contact.content", {
                companyEmail: t("company.email")
              })}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.terms.governingLaw.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.terms.governingLaw.content", {
                companyCountry: t("company.country")
              })}
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center">
          <a href="/privacy" className="text-primary hover:underline text-sm">
            {t("legal.privacy.title")}
          </a>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
