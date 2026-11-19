import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentMeta";
import logo from "@/assets/logo.png";

const PrivacyPolicy = () => {
  const { t } = useTranslation();
  const [isNativeApp, setIsNativeApp] = useState(false);
  useDocumentTitle(t('legal.privacy.title'));

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
            {t("legal.privacy.title")}
          </h1>
          <p className="eyebrow mt-4">
            {t("legal.lastUpdatedOn", { date: t("legal.privacy.lastUpdatedDate") })}
          </p>
        </header>

        <div className="reading space-y-10 text-foreground">
          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.intro.title")}
            </h2>
            <p>
              {t("legal.privacy.intro.content", {
                companyName: t("company.name"),
                companyCountry: t("company.country")
              })}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.dataController.title")}
            </h2>
            <p>
              {t("legal.privacy.dataController.content", {
                companyName: t("company.name"),
                companyEmail: t("company.email")
              })}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.collection.title")}
            </h2>
            <p>
              {t("legal.privacy.collection.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.usage.title")}
            </h2>
            <p>
              {t("legal.privacy.usage.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.storage.title")}
            </h2>
            <p>
              {t("legal.privacy.storage.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.encryption.title")}
            </h2>
            <p>
              {t("legal.privacy.encryption.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.zeroKnowledge.title")}
            </h2>
            <p>
              {t("legal.privacy.zeroKnowledge.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.thirdParty.title")}
            </h2>
            <p>
              {t("legal.privacy.thirdParty.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.syncIdentifier.title")}
            </h2>
            <p>
              {t("legal.privacy.syncIdentifier.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.aiProcessing.title")}
            </h2>
            <p>
              {t("legal.privacy.aiProcessing.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.diagnostics.title")}
            </h2>
            <p>
              {t("legal.privacy.diagnostics.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.localStorage.title")}
            </h2>
            <p>
              {t("legal.privacy.localStorage.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.internationalTransfers.title")}
            </h2>
            <p>
              {t("legal.privacy.internationalTransfers.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.retention.title")}
            </h2>
            <p>
              {t("legal.privacy.retention.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.accountDeletion.title")}
            </h2>
            <p>
              {t("legal.privacy.accountDeletion.content", {
                companyEmail: t("company.email")
              })}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.legalBasis.title")}
            </h2>
            <p>
              {t("legal.privacy.legalBasis.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.dpo.title")}
            </h2>
            <p>
              {t("legal.privacy.dpo.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.californiaRights.title")}
            </h2>
            <p>
              {t("legal.privacy.californiaRights.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.rights.title")}
            </h2>
            <p>
              {t("legal.privacy.rights.content", {
                companyCountry: t("company.country"),
                supervisoryAuthority: t("company.supervisoryAuthority"),
                supervisoryAuthorityUrl: t("company.supervisoryAuthorityUrl"),
                companyEmail: t("company.email")
              })}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.children.title")}
            </h2>
            <p>
              {t("legal.privacy.children.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.changes.title")}
            </h2>
            <p>
              {t("legal.privacy.changes.content")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl leading-snug">
              {t("legal.privacy.contact.title")}
            </h2>
            <p>
              {t("legal.privacy.contact.content", {
                companyEmail: t("company.email")
              })}
            </p>
          </section>
        </div>

        <footer className="mt-12 border-t border-border pt-6">
          <a href="/terms" className="inline-flex min-h-10 items-center text-sm underline underline-offset-4 transition-colors hover:text-muted-foreground">
            {t("legal.terms.title")}
          </a>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
