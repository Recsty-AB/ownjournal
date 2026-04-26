import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentMeta";

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
            {t("legal.privacy.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("legal.lastUpdated")}: {t("legal.privacy.lastUpdatedDate")}
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.intro.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.intro.content", {
                companyName: t("company.name"),
                companyCountry: t("company.country")
              })}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.dataController.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.dataController.content", {
                companyName: t("company.name"),
                companyEmail: t("company.email")
              })}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.collection.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.collection.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.usage.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.usage.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.storage.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.storage.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.encryption.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.encryption.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.zeroKnowledge.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.zeroKnowledge.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.thirdParty.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.thirdParty.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.syncIdentifier.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.syncIdentifier.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.aiProcessing.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.aiProcessing.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.diagnostics.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.diagnostics.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.localStorage.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.localStorage.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.internationalTransfers.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.internationalTransfers.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.retention.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.retention.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.accountDeletion.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.accountDeletion.content", {
                companyEmail: t("company.email")
              })}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.legalBasis.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.legalBasis.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.dpo.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.dpo.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.californiaRights.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.californiaRights.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.rights.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.rights.content", {
                companyCountry: t("company.country"),
                supervisoryAuthority: t("company.supervisoryAuthority"),
                supervisoryAuthorityUrl: t("company.supervisoryAuthorityUrl"),
                companyEmail: t("company.email")
              })}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.children.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.children.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.changes.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.changes.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("legal.privacy.contact.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.contact.content", {
                companyEmail: t("company.email")
              })}
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center">
          <a href="/terms" className="text-primary hover:underline text-sm">
            {t("legal.terms.title")}
          </a>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
