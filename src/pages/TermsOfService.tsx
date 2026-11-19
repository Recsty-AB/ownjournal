import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentMeta";
import logo from "@/assets/logo.png";

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
      <div className="mx-auto w-full max-w-[44rem] px-5 pb-16 sm:px-8" style={{ paddingTop: 'calc(1.5rem + var(--safe-area-inset-top))' }}>
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-2">
          {isNativeApp ? (
            <Button variant="ghost" asChild className="-ml-3 h-10 rounded-full text-muted-foreground">
              <a href="/">
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {t("common.back")}
              </a>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="-ml-3 h-10 rounded-full text-muted-foreground">
                <a href="https://ownjournal.app">
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  {t("legal.backToHomepage")}
                </a>
              </Button>
              <Button variant="outline" asChild className="h-10 rounded-full">
                <a href="https://app.ownjournal.app">
                  {t("legal.openApp")}
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              </Button>
            </>
          )}
        </nav>

        <header className="mb-10 border-b border-border pb-8">
          <img src={logo} alt="" className="mb-6 h-10 w-10 object-contain dark:invert" />
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-5xl">
            {t("legal.terms.title")}
          </h1>
          <p className="eyebrow mt-4">
            {t("legal.lastUpdatedOn", { date: t("legal.terms.lastUpdatedDate") })}
          </p>
        </header>

        <div className="reading space-y-10 text-foreground">
          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.acceptance.title")}
            </h2>
            <p>
              {t("legal.terms.acceptance.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.description.title")}
            </h2>
            <p>
              {t("legal.terms.description.content", {
                companyName: t("company.name"),
                companyCountry: t("company.country")
              })}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.accounts.title")}
            </h2>
            <p>
              {t("legal.terms.accounts.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.subscriptions.title")}
            </h2>
            <p className="whitespace-pre-line">
              {t("legal.terms.subscriptions.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.withdrawal.title")}
            </h2>
            <p className="whitespace-pre-line">
              {t("legal.terms.withdrawal.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.acceptableUse.title")}
            </h2>
            <p className="whitespace-pre-line">
              {t("legal.terms.acceptableUse.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.intellectualProperty.title")}
            </h2>
            <p>
              {t("legal.terms.intellectualProperty.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.dataStorage.title")}
            </h2>
            <p>
              {t("legal.terms.dataStorage.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.limitation.title")}
            </h2>
            <p>
              {t("legal.terms.limitation.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.termination.title")}
            </h2>
            <p>
              {t("legal.terms.termination.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.changes.title")}
            </h2>
            <p>
              {t("legal.terms.changes.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.appleTerms.title")}
            </h2>
            <p className="whitespace-pre-line">
              {t("legal.terms.appleTerms.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.severability.title")}
            </h2>
            <p>
              {t("legal.terms.severability.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.contact.title")}
            </h2>
            <p>
              {t("legal.terms.contact.content", {
                companyEmail: t("company.email")
              })}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.terms.governingLaw.title")}
            </h2>
            <p>
              {t("legal.terms.governingLaw.content", {
                companyCountry: t("company.country")
              })}
            </p>
          </section>
        </div>

        <footer className="mt-12 border-t border-border pt-6">
          <a href="/privacy" className="inline-flex min-h-10 items-center text-sm underline underline-offset-4 transition-colors hover:text-muted-foreground">
            {t("legal.privacy.title")}
          </a>
        </footer>
      </div>
    </div>
  );
};

export default TermsOfService;
