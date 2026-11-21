import { useState, useRef, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Shield,
  Cloud,
  Crown,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  Play,
  Tag,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  Smartphone,
  HardDrive,
  Mail,
  ArrowRight,
  Copy,
  Check,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { MOOD_EMOJI } from "@/utils/moodEmoji";
import { PREDEFINED_ACTIVITIES } from "@/utils/activities";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTour?: (fullReset?: boolean) => void;
  initialTab?: string;
  initialAccordion?: string;
}

// Topic question, set like a handbook entry heading.
const TOPIC = "gap-4 py-4 text-left text-base font-medium";
// Long-form answer in the reading face and measure.
const ANSWER = "reading space-y-3 pb-6 text-[1.0625rem] text-foreground sm:text-[1.125rem]";
// A sub-section inside an answer: a ruled margin instead of a box.
const ASIDE = "space-y-1.5 border-l-2 border-border pl-4";
const FOOTNOTE = "font-sans text-sm text-muted-foreground";
const COMMAND = "overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm";
const BADGE = "rounded-full border border-border px-2 py-0.5 font-sans text-[11px] font-medium leading-4 text-muted-foreground";

const PlusBadge = ({ children }: { children: ReactNode }) => (
  <span className={cn(BADGE, "border-seal/40 text-seal")}>{children}</span>
);

const PlusNote = ({ children }: { children: ReactNode }) => (
  <p className={cn(FOOTNOTE, "flex items-start gap-2")}>
    <Crown aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-seal" />
    <span>{children}</span>
  </p>
);

// Where to find subscription management: Settings > … as a breadcrumb.
const SettingsPath = ({ t }: { t: (key: string) => string }) => (
  <div className="flex flex-wrap items-center gap-1.5 font-sans text-sm font-medium">
    <span>{t("help.faq.path.step1")}</span>
    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
    <span>{t("help.faq.path.step2")}</span>
    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
    <span>{t("help.faq.path.step3")}</span>
    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
    <span>{t("help.faq.path.step4")}</span>
  </div>
);

// Category definitions for reuse
const getCategoryDefinitions = (t: (key: string) => string) => [
  { value: "getting-started", icon: Sparkles, label: t("help.tabs.gettingStarted") },
  { value: "security", icon: Shield, label: t("help.tabs.security") },
  { value: "storage", icon: Cloud, label: t("help.tabs.storage") },
  { value: "features", icon: Tag, label: t("help.tabs.features") },
  { value: "troubleshooting", icon: AlertTriangle, label: t("help.tabs.troubleshooting") },
  { value: "faq", icon: HelpCircle, label: t("help.tabs.faq") },
  { value: "support", icon: Mail, label: t("help.tabs.support") },
];

export const HelpDialog = ({ open, onOpenChange, onStartTour, initialTab, initialAccordion }: HelpDialogProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("getting-started");
  const [copied, setCopied] = useState(false);
  const [openAccordionValue, setOpenAccordionValue] = useState<string | undefined>(undefined);
  const isMobile = useIsMobile();
  
  // Mobile drill-down navigation state
  const [mobileSelectedCategory, setMobileSelectedCategory] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Navigate to specific tab/accordion when dialog opens with initialTab
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
      if (isMobile) {
        setMobileSelectedCategory(initialTab);
      }
      if (initialAccordion) {
        setOpenAccordionValue(initialAccordion);
      }
    }
  }, [open, initialTab, initialAccordion, isMobile]);

  // Reset mobile category when dialog closes
  useEffect(() => {
    if (!open) {
      setMobileSelectedCategory(null);
      setOpenAccordionValue(undefined);
    }
  }, [open]);

  // Scroll to top when selecting a category on mobile
  useEffect(() => {
    if (mobileSelectedCategory && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [mobileSelectedCategory]);

  const handleStartTour = () => {
    onOpenChange(false);
    setTimeout(() => {
      onStartTour?.(true);
    }, 300);
  };

  const handleCopyEmail = async () => {
    const email = t("help.support.email.address");
    await navigator.clipboard.writeText(email);
    setCopied(true);
    toast.success(t("common.copiedToClipboard"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMobileCategorySelect = (category: string) => {
    setMobileSelectedCategory(category);
    setActiveTab(category);
  };

  const handleMobileBack = () => {
    setMobileSelectedCategory(null);
  };

  const categories = getCategoryDefinitions(t);

  // Helper component for the vertical sidebar items (desktop only)
  const SidebarItem = ({ value, icon: Icon, label }: { value: string; icon: any; label: string }) => (
    <TabsTrigger
      value={value}
      onClick={() => setActiveTab(value)}
      className="h-auto w-full justify-start gap-3 whitespace-normal rounded-lg px-3 py-2.5 text-left text-sm font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=active]:bg-accent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="min-w-0">{label}</span>
    </TabsTrigger>
  );

  // Mobile category list item - native-style vertical list
  const MobileCategoryListItem = ({ value, icon: Icon, label }: { value: string; icon: any; label: string }) => (
    <button
      onClick={() => handleMobileCategorySelect(value)}
      className="flex min-h-14 w-full items-center gap-4 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-accent active:bg-accent"
    >
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 text-lg font-semibold">{label}</span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );

  // Content sections - shared between mobile and desktop
  const renderContentSection = (tabValue: string) => {
    switch (tabValue) {
      case "getting-started":
        return (
          <div className="space-y-4">
            {/* Tour Section */}
            <div className="notice flex-wrap items-center justify-between gap-x-4 p-4">
              <div className="min-w-0">
                <h3 className="font-medium">{t("help.gettingStarted.tourTitle")}</h3>
                <p className="text-muted-foreground">{t("help.gettingStarted.tourDesc")}</p>
              </div>
              <Button size="sm" onClick={handleStartTour} className="shrink-0 gap-2 rounded-full px-4">
                <Play aria-hidden="true" className="h-4 w-4" />
                {t("help.gettingStarted.startTour")}
              </Button>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="first-entry">
                <AccordionTrigger className={TOPIC}>
                  {t("help.gettingStarted.firstEntry.title")}
                </AccordionTrigger>
                <AccordionContent className={ANSWER}>
                  <p>{t("help.gettingStarted.firstEntry.step1")}</p>
                  <p>{t("help.gettingStarted.firstEntry.step2")}</p>
                  <p>{t("help.gettingStarted.firstEntry.step3")}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="markdown">
                <AccordionTrigger className={TOPIC}>
                  {t("help.gettingStarted.markdown.title")}
                </AccordionTrigger>
                <AccordionContent className={ANSWER}>
                  <div className={cn(COMMAND, "space-y-1")}>
                    <p># {t("help.gettingStarted.markdown.heading")}</p>
                    <p>**{t("help.gettingStarted.markdown.bold")}**</p>
                    <p>*{t("help.gettingStarted.markdown.italic")}*</p>
                    <p>- {t("help.gettingStarted.markdown.list")}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sync-setup">
                <AccordionTrigger className={TOPIC}>
                  {t("help.gettingStarted.syncSetup.title")}
                </AccordionTrigger>
                <AccordionContent className={ANSWER}>
                  <p>{t("help.gettingStarted.syncSetup.step1")}</p>
                  <p>{t("help.gettingStarted.syncSetup.step2")}</p>
                  <p>{t("help.gettingStarted.syncSetup.step3")}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="account-setup">
                <AccordionTrigger className={TOPIC}>
                  {t("help.gettingStarted.accountSetup.title")}
                </AccordionTrigger>
                <AccordionContent className={ANSWER}>
                  <p>{t("help.gettingStarted.accountSetup.desc")}</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>{t("help.gettingStarted.accountSetup.emailOption")}</li>
                    <li>{t("help.gettingStarted.accountSetup.googleOption")}</li>
                  </ul>
                  <p className={FOOTNOTE}>{t("help.gettingStarted.accountSetup.tip")}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        );

      case "security":
        return (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="encryption-architecture">
              <AccordionTrigger className={TOPIC}>
                {t("help.security.encryptionArchitecture.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <p>{t("help.security.encryptionArchitecture.desc")}</p>
                
                <div className="space-y-3">
                  <div className={ASIDE}>
                    <h4>
                      {t("help.security.encryptionArchitecture.algorithm.title")}
                    </h4>
                    <p>{t("help.security.encryptionArchitecture.algorithm.desc")}</p>
                  </div>
                  
                  <div className={ASIDE}>
                    <h4>
                      {t("help.security.encryptionArchitecture.keyDerivation.title")}
                    </h4>
                    <p>{t("help.security.encryptionArchitecture.keyDerivation.desc")}</p>
                  </div>
                  
                  <div className={ASIDE}>
                    <h4>
                      {t("help.security.encryptionArchitecture.howItWorks.title")}
                    </h4>
                    <div className="space-y-1">
                      <p>{t("help.security.encryptionArchitecture.howItWorks.step1")}</p>
                      <p>{t("help.security.encryptionArchitecture.howItWorks.step2")}</p>
                      <p>{t("help.security.encryptionArchitecture.howItWorks.step3")}</p>
                      <p>{t("help.security.encryptionArchitecture.howItWorks.step4")}</p>
                    </div>
                  </div>
                </div>
                
                <p className="font-medium">
                  {t("help.security.encryptionArchitecture.summary")}
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="zero-knowledge">
              <AccordionTrigger className={TOPIC}>
                {t("help.security.zeroKnowledge.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <p>{t("help.security.zeroKnowledge.desc")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="encryption-modes">
              <AccordionTrigger className={TOPIC}>
                {t("help.security.encryptionModes.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <div className={ASIDE}>
                  <h4>
                    {t("help.security.encryptionModes.simpleTitle")}
                  </h4>
                  <p>{t("help.security.encryptionModes.simpleDesc")}</p>
                </div>
                <div className={ASIDE}>
                  <h4>
                    {t("help.security.encryptionModes.e2eTitle")}
                  </h4>
                  <p>{t("help.security.encryptionModes.e2eDesc")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="password-tips">
              <AccordionTrigger className={TOPIC}>
                {t("help.security.passwordTips.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t("help.security.passwordTips.tip1")}</li>
                  <li>{t("help.security.passwordTips.tip2")}</li>
                  <li>{t("help.security.passwordTips.tip3")}</li>
                </ul>
                <div className="notice notice-error font-sans">
                  <AlertTriangle aria-hidden="true" />
                  <p className="font-medium">{t("help.security.passwordTips.warning")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );

      case "storage":
        return (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="google-drive">
              <AccordionTrigger className={TOPIC}>
                {t("help.storage.googleDrive.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <p>{t("help.storage.googleDrive.step1")}</p>
                <p>{t("help.storage.googleDrive.step2")}</p>
                <p className={FOOTNOTE}>{t("help.storage.googleDrive.note")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="dropbox">
              <AccordionTrigger className={TOPIC}>
                {t("help.storage.dropbox.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <p>{t("help.storage.dropbox.step1")}</p>
                <p>{t("help.storage.dropbox.step2")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="nextcloud">
              <AccordionTrigger className={TOPIC}>
                {t("help.storage.nextcloud.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <p>{t("help.storage.nextcloud.step1")}</p>
                <p>{t("help.storage.nextcloud.step2")}</p>
                <p>{t("help.storage.nextcloud.step3")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="transfer">
              <AccordionTrigger className={TOPIC}>
                {t("help.storage.transfer.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <p>{t("help.storage.transfer.desc")}</p>
                <p>{t("help.storage.transfer.steps")}</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );

      case "features":
        return (
          <div className="space-y-6">
            {/* Pro Features */}
            <div>
              <h3 className="eyebrow mb-1 flex items-center gap-2.5">
                <PlusBadge>{t('help.sections.proBadge')}</PlusBadge>
                {t('help.sections.aiPoweredFeatures')}
              </h3>
              {/* Controlled so in-app links (e.g. "How this works") can open a topic directly. */}
              <Accordion type="single" collapsible className="w-full" value={openAccordionValue} onValueChange={(v) => setOpenAccordionValue(v)}>
                <AccordionItem value="tag-suggestions">
                  <AccordionTrigger className={TOPIC}>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {t("help.features.tagSuggestions.title")}
                      <PlusBadge>{t('help.sections.proBadge')}</PlusBadge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.tagSuggestions.desc")}</p>
                    <PlusNote>{t("help.features.tagSuggestions.proNote")}</PlusNote>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="title-suggestions">
                  <AccordionTrigger className={TOPIC}>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {t("help.features.titleSuggestions.title")}
                      <PlusBadge>{t('help.sections.proBadge')}</PlusBadge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.titleSuggestions.desc")}</p>
                    <PlusNote>{t("help.features.titleSuggestions.proNote")}</PlusNote>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="voice-entry">
                  <AccordionTrigger className={TOPIC}>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {t("help.features.voiceEntry.title")}
                      <PlusBadge>{t('help.sections.proBadge')}</PlusBadge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.voiceEntry.desc")}</p>
                    <PlusNote>{t("help.features.voiceEntry.proNote")}</PlusNote>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dreams">
                  <AccordionTrigger className={TOPIC}>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {t("help.features.dreams.title")}
                      <PlusBadge>{t('help.sections.proBadge')}</PlusBadge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.dreams.desc")}</p>
                    <PlusNote>{t("help.features.dreams.proNote")}</PlusNote>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dream-method">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.dreamMethod.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.dreamMethod.intro")}</p>
                    <p>{t("help.features.dreamMethod.jung")}</p>
                    <p>{t("help.features.dreamMethod.research")}</p>
                    <p>{t("help.features.dreamMethod.questions")}</p>
                    <p>{t("help.features.dreamMethod.noDictionary")}</p>
                    <p>{t("help.features.dreamMethod.notAdvice")}</p>
                    <p className={FOOTNOTE}>{t("help.features.dreamMethod.privacy")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="ai-analysis">
                  <AccordionTrigger className={TOPIC}>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {t("help.features.aiAnalysis.title")}
                      <PlusBadge>{t('help.sections.proBadge')}</PlusBadge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.aiAnalysis.desc")}</p>
                    <PlusNote>{t("help.features.aiAnalysis.proNote")}</PlusNote>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="trends">
                  <AccordionTrigger className={TOPIC}>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {t("help.features.trends.title")}
                      <PlusBadge>{t('help.sections.proBadge')}</PlusBadge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.trends.desc")}</p>
                    <PlusNote>{t("help.features.trends.proNote")}</PlusNote>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="activity-insights">
                  <AccordionTrigger className={TOPIC}>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {t("help.features.activityInsights.title")}
                      <PlusBadge>{t('help.sections.proBadge')}</PlusBadge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.activityInsights.desc")}</p>
                    <PlusNote>{t("help.features.activityInsights.proNote")}</PlusNote>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="export">
                  <AccordionTrigger className={TOPIC}>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {t("help.features.export.title")}
                      <PlusBadge>{t('help.sections.proBadge')}</PlusBadge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.export.desc")}</p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>{t("help.features.export.pdf")}</li>
                      <li>{t("help.features.export.word")}</li>
                      <li>{t("help.features.export.json")}</li>
                    </ul>
                    
                    {/* Save location section */}
                    <div className="space-y-2 border-t border-border pt-4">
                      <h4>
                        {t("help.features.export.saveLocationTitle")}
                      </h4>
                      <ul className={`space-y-2 ${FOOTNOTE}`}>
                        <li className="flex items-start gap-2">
                          <Smartphone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{t("help.features.export.saveLocationMobile")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <HardDrive aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{t("help.features.export.saveLocationWeb")}</span>
                        </li>
                      </ul>
                      <p className={FOOTNOTE}>{t("help.features.export.shareHint")}</p>
                    </div>
                    
                    <PlusNote>{t("help.features.export.proNote")}</PlusNote>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Free Features */}
            <div>
              <h3 className="eyebrow mb-1 flex items-center gap-2.5">
                <span className={BADGE}>{t('help.sections.freeBadge')}</span>
                {t('help.sections.coreFeatures')}
              </h3>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="mood-tracking">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.moodTracking.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.moodTracking.desc")}</p>
                    <div className={`flex flex-wrap gap-x-4 gap-y-1 ${FOOTNOTE}`} aria-hidden="true">
                      {(['great', 'good', 'okay', 'poor', 'terrible'] as const).map(mood => (
                        <span key={mood}>{MOOD_EMOJI[mood]} {t(`journalEntry.moods.${mood}`)}</span>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="activity-tagging">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.activityTagging.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.activityTagging.desc")}</p>
                    <div className={`flex flex-wrap gap-x-4 gap-y-1 ${FOOTNOTE}`} aria-hidden="true">
                      {PREDEFINED_ACTIVITIES.slice(0, 6).map(a => (
                        <span key={a.key}>{a.emoji} {t(`activities.${a.key}`)}</span>
                      ))}
                      <span>...</span>
                    </div>
                    <PlusNote>{t("help.features.activityTagging.plusHint")}</PlusNote>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="mood-calendar">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.moodCalendar.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.moodCalendar.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="mood-stats">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.moodStats.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.moodStats.desc")}</p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>{t("help.features.moodStats.distribution")}</li>
                      <li>{t("help.features.moodStats.overTime")}</li>
                      <li>{t("help.features.moodStats.dayOfWeek")}</li>
                      <li>{t("help.features.moodStats.streaks")}</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="tags">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.tags.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.tags.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="e2e-encryption">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.e2eEncryption.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.e2eEncryption.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="zero-knowledge">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.zeroKnowledge.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.zeroKnowledge.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="self-hosted">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.selfHostedStorage.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.selfHostedStorage.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="multi-device">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.multiDeviceSync.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.multiDeviceSync.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="offline-backup">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.offlineBackup.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.offlineBackup.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="backup-import-export">
                  <AccordionTrigger className={TOPIC}>
                    {t("help.features.backupImportExport.title")}
                  </AccordionTrigger>
                  <AccordionContent className={ANSWER}>
                    <p>{t("help.features.backupImportExport.desc")}</p>
                    
                    {/* Export location section */}
                    <div className="space-y-2 border-t border-border pt-4">
                      <h4>
                        {t("help.features.backupImportExport.exportTitle")}
                      </h4>
                      <p>{t("help.features.backupImportExport.exportDesc")}</p>
                    </div>
                    
                    {/* Import location section */}
                    <div className="space-y-2 border-t border-border pt-4">
                      <h4>
                        {t("help.features.backupImportExport.importTitle")}
                      </h4>
                      <ul className={`space-y-2 ${FOOTNOTE}`}>
                        <li className="flex items-start gap-2">
                          <Smartphone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{t("help.features.backupImportExport.importMobile")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <HardDrive aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{t("help.features.backupImportExport.importWeb")}</span>
                        </li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        );

      case "troubleshooting":
        return (
          <Accordion type="single" collapsible className="w-full" value={openAccordionValue} onValueChange={(v) => setOpenAccordionValue(v)}>
            <AccordionItem value="nextcloud-encryption">
              <AccordionTrigger className={TOPIC}>
                {t("help.troubleshooting.nextcloudEncryption.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <p>{t("help.troubleshooting.nextcloudEncryption.intro")}</p>
                
                <div className={ASIDE}>
                  <h4>{t("help.troubleshooting.nextcloudEncryption.whyTitle")}</h4>
                  <p>{t("help.troubleshooting.nextcloudEncryption.why")}</p>
                </div>

                <h4>{t("help.troubleshooting.nextcloudEncryption.fixTitle")}</h4>
                
                <div className={ASIDE}>
                  <h4>{t("help.troubleshooting.nextcloudEncryption.fixOption1Title")}</h4>
                  <p>{t("help.troubleshooting.nextcloudEncryption.fixOption1Desc")}</p>
                  <div className="space-y-1">
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption1Step1")}</p>
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption1Step2")}</p>
                    <p className={COMMAND}>{t("help.troubleshooting.nextcloudEncryption.fixOption1Step3")}</p>
                    <p className={COMMAND}>{t("help.troubleshooting.nextcloudEncryption.fixOption1Step4")}</p>
                    <p className={COMMAND}>{t("help.troubleshooting.nextcloudEncryption.fixOption1Step5")}</p>
                    <p className={COMMAND}>{t("help.troubleshooting.nextcloudEncryption.fixOption1Step6")}</p>
                  </div>
                  <p className={FOOTNOTE}>{t("help.troubleshooting.nextcloudEncryption.fixOption1Note")}</p>
                </div>

                <div className={ASIDE}>
                  <h4>{t("help.troubleshooting.nextcloudEncryption.fixOption2Title")}</h4>
                  <p>{t("help.troubleshooting.nextcloudEncryption.fixOption2Desc")}</p>
                  <div className="space-y-1">
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption2Step1")}</p>
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption2Step2")}</p>
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption2Step3")}</p>
                  </div>
                </div>

                <div className="notice notice-warning font-sans">
                  <AlertTriangle aria-hidden="true" />
                  <p className="font-medium">{t("help.troubleshooting.nextcloudEncryption.importantNote")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sync-issues">
              <AccordionTrigger className={TOPIC}>
                {t("help.troubleshooting.syncIssues.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <p>{t("help.troubleshooting.syncIssues.intro")}</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t("help.troubleshooting.syncIssues.tip1")}</li>
                  <li>{t("help.troubleshooting.syncIssues.tip2")}</li>
                  <li>{t("help.troubleshooting.syncIssues.tip3")}</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="password-recovery">
              <AccordionTrigger className={TOPIC}>
                {t("help.troubleshooting.passwordRecovery.title")}
              </AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <div className="notice notice-error font-sans">
                  <AlertTriangle aria-hidden="true" />
                  <p className="font-medium">{t("help.troubleshooting.passwordRecovery.warning")}</p>
                </div>
                <p>{t("help.troubleshooting.passwordRecovery.desc")}</p>
                <div className={ASIDE}>
                  <h4>{t("help.troubleshooting.passwordRecovery.actionTitle")}</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>{t("help.troubleshooting.passwordRecovery.action1")}</li>
                    <li>{t("help.troubleshooting.passwordRecovery.action2")}</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );

      case "faq":
        return (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="data-location">
              <AccordionTrigger className={TOPIC}>{t("help.faq.dataLocation.question")}</AccordionTrigger>
              <AccordionContent className={ANSWER}>
                {t("help.faq.dataLocation.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="offline">
              <AccordionTrigger className={TOPIC}>{t("help.faq.offline.question")}</AccordionTrigger>
              <AccordionContent className={ANSWER}>
                {t("help.faq.offline.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="devices">
              <AccordionTrigger className={TOPIC}>{t("help.faq.devices.question")}</AccordionTrigger>
              <AccordionContent className={ANSWER}>
                {t("help.faq.devices.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="free">
              <AccordionTrigger className={TOPIC}>{t("help.faq.free.question")}</AccordionTrigger>
              <AccordionContent className={ANSWER}>
                {t("help.faq.free.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pro">
              <AccordionTrigger className={TOPIC}>{t("help.faq.pro.question")}</AccordionTrigger>
              <AccordionContent className={ANSWER}>
                {t("help.faq.pro.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="manage-subscription">
              <AccordionTrigger className={TOPIC}>{t("help.faq.manageSubscription.question")}</AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <SettingsPath t={t} />
                <p>{t("help.faq.manageSubscription.answer")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="invoices">
              <AccordionTrigger className={TOPIC}>{t("help.faq.invoices.question")}</AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <SettingsPath t={t} />
                <p>{t("help.faq.invoices.answer")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cancel-subscription">
              <AccordionTrigger className={TOPIC}>{t("help.faq.cancelSubscription.question")}</AccordionTrigger>
              <AccordionContent className={ANSWER}>
                <SettingsPath t={t} />
                <p>{t("help.faq.cancelSubscription.answer")}</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );

      case "support":
        return (
          <div className="space-y-6">
            <div className="notice">
              <Lightbulb aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <h3 className="font-medium">{t("help.support.beforeContacting.title")}</h3>
                <p className="text-muted-foreground">
                  {t("help.support.beforeContacting.desc")}
                </p>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="text-xl font-semibold">{t("help.support.email.title")}</h3>
              <p className="reading">
                {t("help.support.email.desc")}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <code className="min-w-0 break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
                  {t("help.support.email.address")}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyEmail}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check aria-hidden="true" className="h-4 w-4 text-diagnostic-success" />
                      {t("common.copied")}
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="h-4 w-4" />
                      {t("common.copyEmail")}
                    </>
                  )}
                </Button>
              </div>
              <p className={FOOTNOTE}>
                {t("help.support.responseTime")}
              </p>
            </section>

            <section className="space-y-2 border-t border-border pt-6">
              <h3 className="eyebrow">{t("help.support.links.title")}</h3>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <Link
                  to="/terms"
                  className="inline-flex min-h-10 items-center text-sm underline underline-offset-4 transition-colors hover:text-muted-foreground"
                >
                  {t("help.support.links.terms")}
                </Link>
                <Link
                  to="/privacy"
                  className="inline-flex min-h-10 items-center text-sm underline underline-offset-4 transition-colors hover:text-muted-foreground"
                >
                  {t("help.support.links.privacy")}
                </Link>
              </div>
            </section>

            {/* App Version */}
            <p className="text-xs tabular-nums text-muted-foreground">{t("help.support.version")}: {__APP_VERSION__}</p>
          </div>
        );

      default:
        return null;
    }
  };

  // Desktop help content with tabs
  const desktopHelpContent = (
    <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex flex-row w-full h-full">
      {/* Desktop Sidebar (Vertical TabsList) */}
      <div className="w-60 shrink-0 border-r border-border">
        <ScrollArea className="h-full">
          <TabsList className="flex h-auto w-full flex-col items-stretch gap-0.5 bg-transparent p-3">
            {categories.map((cat) => (
              <SidebarItem key={cat.value} value={cat.value} icon={cat.icon} label={cat.label} />
            ))}
          </TabsList>
        </ScrollArea>
      </div>

      {/* Content Panel */}
      <ScrollArea className="min-w-0 flex-1">
        <div className="mx-auto max-w-2xl px-8 pb-16 pt-8">
          {categories.map((cat) => (
            <TabsContent key={cat.value} value={cat.value} className="mt-0 space-y-5 outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
              <h2 className="text-2xl font-semibold leading-tight">{cat.label}</h2>
              {renderContentSection(cat.value)}
            </TabsContent>
          ))}
        </div>
      </ScrollArea>
    </Tabs>
  );

  // Mobile: Use full-height bottom drawer with drill-down navigation
  if (isMobile) {
    const selectedCategory = categories.find(c => c.value === mobileSelectedCategory);

    return (
      <Drawer open={open} onOpenChange={onOpenChange} modal dismissible={false}>
        <DrawerContent fullHeight hideHandle>
          <DrawerHeader className="flex items-center justify-between gap-2 border-b border-border py-3 pl-5 pr-3 text-left">
            <div className="flex items-center gap-2 min-w-0">
              {mobileSelectedCategory ? (
                // Back button + Category title when viewing content
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMobileBack}
                    className="-ml-3 h-10 shrink-0 gap-1 px-2 text-muted-foreground"
                  >
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    {t("common.back")}
                  </Button>
                  {selectedCategory && (
                    <span className="min-w-0 truncate text-lg font-semibold">{selectedCategory.label}</span>
                  )}
                </>
              ) : (
                // Main header when viewing category list
                <div>
                  <DrawerTitle className="text-2xl font-semibold">
                    {t("help.title")}
                  </DrawerTitle>
                  <DrawerDescription className="mt-0.5 text-sm text-muted-foreground">
                    {t("help.description")}
                  </DrawerDescription>
                </div>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="h-10 w-10 shrink-0 text-muted-foreground"
            >
              <X aria-hidden="true" className="h-5 w-5" />
              <span className="sr-only">{t("common.close")}</span>
            </Button>
          </DrawerHeader>
          
          {/* Mobile navigation container with slide animation */}
          <div className="flex-1 overflow-hidden relative">
            {/* Category List View */}
            <div 
              className={cn(
                "absolute inset-0 transition-transform duration-300 ease-out",
                mobileSelectedCategory ? "-translate-x-full" : "translate-x-0"
              )}
            >
              <ScrollArea className="h-full">
                <div className="flex flex-col">
                  {categories.map((cat) => (
                    <MobileCategoryListItem 
                      key={cat.value}
                      value={cat.value}
                      icon={cat.icon}
                      label={cat.label}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Content View */}
            <div 
              className={cn(
                "absolute inset-0 transition-transform duration-300 ease-out",
                mobileSelectedCategory ? "translate-x-0" : "translate-x-full"
              )}
            >
              <ScrollArea className="h-full" ref={contentRef}>
                <div className="px-5 pb-20 pt-5">
                  {mobileSelectedCategory && renderContentSection(mobileSelectedCategory)}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Keep the familiar dialog modal
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] gap-0 overflow-hidden rounded-2xl border-border bg-background p-0"
        aria-describedby="help-dialog-description"
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-2xl font-semibold">
            {t("help.title")}
          </DialogTitle>
          <p id="help-dialog-description" className="mt-1 text-sm text-muted-foreground">
            {t("help.description")}
          </p>
        </div>

        {/* Main Content Area */}
        <div className="flex h-[70vh]">
          {desktopHelpContent}
        </div>
      </DialogContent>
    </Dialog>
  );
};
