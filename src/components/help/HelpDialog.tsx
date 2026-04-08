import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Shield,
  Cloud,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  Play,
  Key,
  Lock,
  Database,
  RefreshCw,
  FileText,
  Tag,
  TrendingUp,
  Download,
  ChevronRight,
  ChevronLeft,
  Heart,
  Lightbulb,
  Calendar as CalendarIcon,
  Server,
  Smartphone,
  HardDrive,
  Mail,
  ExternalLink,
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
      className={cn(
        "w-full justify-start gap-3 px-4 py-3 h-auto text-sm font-medium transition-all relative overflow-hidden",
        "data-[state=active]:bg-primary/5 data-[state=active]:text-primary border-r-2 border-transparent data-[state=active]:border-primary rounded-none hover:bg-muted/50",
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="truncate">{label}</span>
      {activeTab === value && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
    </TabsTrigger>
  );

  // Mobile category list item - native-style vertical list
  const MobileCategoryListItem = ({ value, icon: Icon, label }: { value: string; icon: any; label: string }) => (
    <button
      onClick={() => handleMobileCategorySelect(value)}
      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted/50 active:bg-muted transition-colors border-b border-border last:border-b-0 text-left"
    >
      <Icon className="w-5 h-5 text-primary shrink-0" />
      <span className="flex-1 font-medium text-sm">{label}</span>
      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
    </button>
  );

  // Content sections - shared between mobile and desktop
  const renderContentSection = (tabValue: string) => {
    switch (tabValue) {
      case "getting-started":
        return (
          <div className="space-y-4">
            {/* Tour Section */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-sm">{t("help.gettingStarted.tourTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("help.gettingStarted.tourDesc")}</p>
                </div>
                <Button size="sm" onClick={handleStartTour} className="gap-2 shrink-0">
                  <Play className="w-4 h-4" />
                  {t("help.gettingStarted.startTour")}
                </Button>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="first-entry">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    {t("help.gettingStarted.firstEntry.title")}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>{t("help.gettingStarted.firstEntry.step1")}</p>
                  <p>{t("help.gettingStarted.firstEntry.step2")}</p>
                  <p>{t("help.gettingStarted.firstEntry.step3")}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="markdown">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    {t("help.gettingStarted.markdown.title")}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs space-y-1">
                    <p># {t("help.gettingStarted.markdown.heading")}</p>
                    <p>**{t("help.gettingStarted.markdown.bold")}**</p>
                    <p>*{t("help.gettingStarted.markdown.italic")}*</p>
                    <p>- {t("help.gettingStarted.markdown.list")}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sync-setup">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    {t("help.gettingStarted.syncSetup.title")}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>{t("help.gettingStarted.syncSetup.step1")}</p>
                  <p>{t("help.gettingStarted.syncSetup.step2")}</p>
                  <p>{t("help.gettingStarted.syncSetup.step3")}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="account-setup">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" />
                    {t("help.gettingStarted.accountSetup.title")}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>{t("help.gettingStarted.accountSetup.desc")}</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>{t("help.gettingStarted.accountSetup.emailOption")}</li>
                    <li>{t("help.gettingStarted.accountSetup.googleOption")}</li>
                  </ul>
                  <p className="text-xs italic mt-2">{t("help.gettingStarted.accountSetup.tip")}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        );

      case "security":
        return (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="encryption-architecture">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  {t("help.security.encryptionArchitecture.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-4">
                <p>{t("help.security.encryptionArchitecture.desc")}</p>
                
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <h4 className="font-medium text-foreground mb-1">
                      {t("help.security.encryptionArchitecture.algorithm.title")}
                    </h4>
                    <p>{t("help.security.encryptionArchitecture.algorithm.desc")}</p>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-3">
                    <h4 className="font-medium text-foreground mb-1">
                      {t("help.security.encryptionArchitecture.keyDerivation.title")}
                    </h4>
                    <p>{t("help.security.encryptionArchitecture.keyDerivation.desc")}</p>
                  </div>
                  
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <h4 className="font-medium text-foreground mb-2">
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
                
                <p className="font-medium text-foreground">
                  {t("help.security.encryptionArchitecture.summary")}
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="zero-knowledge">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  {t("help.security.zeroKnowledge.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <p>{t("help.security.zeroKnowledge.desc")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="encryption-modes">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  {t("help.security.encryptionModes.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <h4 className="font-medium text-foreground mb-1">
                    {t("help.security.encryptionModes.simpleTitle")}
                  </h4>
                  <p>{t("help.security.encryptionModes.simpleDesc")}</p>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <h4 className="font-medium text-foreground mb-1">
                    {t("help.security.encryptionModes.e2eTitle")}
                  </h4>
                  <p>{t("help.security.encryptionModes.e2eDesc")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="password-tips">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  {t("help.security.passwordTips.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <ul className="list-disc list-inside space-y-1">
                  <li>{t("help.security.passwordTips.tip1")}</li>
                  <li>{t("help.security.passwordTips.tip2")}</li>
                  <li>{t("help.security.passwordTips.tip3")}</li>
                </ul>
                <p className="text-destructive font-medium mt-2 bg-destructive/10 p-2 rounded">
                  {t("help.security.passwordTips.warning")}
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );

      case "storage":
        return (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="google-drive">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  {t("help.storage.googleDrive.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>{t("help.storage.googleDrive.step1")}</p>
                <p>{t("help.storage.googleDrive.step2")}</p>
                <p className="italic text-xs">{t("help.storage.googleDrive.note")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="dropbox">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  {t("help.storage.dropbox.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>{t("help.storage.dropbox.step1")}</p>
                <p>{t("help.storage.dropbox.step2")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="nextcloud">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  {t("help.storage.nextcloud.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>{t("help.storage.nextcloud.step1")}</p>
                <p>{t("help.storage.nextcloud.step2")}</p>
                <p>{t("help.storage.nextcloud.step3")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="transfer">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-primary" />
                  {t("help.storage.transfer.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
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
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">{t('help.sections.proBadge')}</span>
                {t('help.sections.aiPoweredFeatures')}
              </h3>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="tag-suggestions">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      {t("help.features.tagSuggestions.title")}
                      <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        {t('help.sections.proBadge')}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.tagSuggestions.desc")}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("help.features.tagSuggestions.proNote")}
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="title-suggestions">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-primary" />
                      {t("help.features.titleSuggestions.title")}
                      <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        {t('help.sections.proBadge')}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.titleSuggestions.desc")}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("help.features.titleSuggestions.proNote")}
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="ai-analysis">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      {t("help.features.aiAnalysis.title")}
                      <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        {t('help.sections.proBadge')}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.aiAnalysis.desc")}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("help.features.aiAnalysis.proNote")}
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="trends">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      {t("help.features.trends.title")}
                      <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        {t('help.sections.proBadge')}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.trends.desc")}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("help.features.trends.proNote")}
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="activity-insights">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      {t("help.features.activityInsights.title")}
                      <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        {t('help.sections.proBadge')}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.activityInsights.desc")}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("help.features.activityInsights.proNote")}
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="export">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-primary" />
                      {t("help.features.export.title")}
                      <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        {t('help.sections.proBadge')}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.export.desc")}</p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                      <li>{t("help.features.export.pdf")}</li>
                      <li>{t("help.features.export.word")}</li>
                      <li>{t("help.features.export.json")}</li>
                    </ul>
                    
                    {/* Save location section */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <h4 className="font-medium text-foreground text-sm mb-2">
                        {t("help.features.export.saveLocationTitle")}
                      </h4>
                      <ul className="space-y-2 text-xs">
                        <li className="flex items-start gap-2">
                          <Smartphone className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{t("help.features.export.saveLocationMobile")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <HardDrive className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{t("help.features.export.saveLocationWeb")}</span>
                        </li>
                      </ul>
                      <p className="text-xs italic mt-2">{t("help.features.export.shareHint")}</p>
                    </div>
                    
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      {t("help.features.export.proNote")}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Free Features */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">{t('help.sections.freeBadge')}</span>
                {t('help.sections.coreFeatures')}
              </h3>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="mood-tracking">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-primary" />
                      {t("help.features.moodTracking.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.moodTracking.desc")}</p>
                    <div className="flex flex-wrap gap-3 text-xs" aria-hidden="true">
                      {(['great', 'good', 'okay', 'poor', 'terrible'] as const).map(mood => (
                        <span key={mood}>{MOOD_EMOJI[mood]} {t(`journalEntry.moods.${mood}`)}</span>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="activity-tagging">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      {t("help.features.activityTagging.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.activityTagging.desc")}</p>
                    <div className="flex flex-wrap gap-2 text-xs" aria-hidden="true">
                      {PREDEFINED_ACTIVITIES.slice(0, 6).map(a => (
                        <span key={a.key}>{a.emoji} {t(`activities.${a.key}`)}</span>
                      ))}
                      <span className="text-muted-foreground">...</span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("help.features.activityTagging.plusHint")}
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="mood-calendar">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      {t("help.features.moodCalendar.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    <p>{t("help.features.moodCalendar.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="mood-stats">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      {t("help.features.moodStats.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.moodStats.desc")}</p>
                    <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
                      <li>{t("help.features.moodStats.distribution")}</li>
                      <li>{t("help.features.moodStats.overTime")}</li>
                      <li>{t("help.features.moodStats.dayOfWeek")}</li>
                      <li>{t("help.features.moodStats.streaks")}</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="tags">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      {t("help.features.tags.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    <p>{t("help.features.tags.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="e2e-encryption">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      {t("help.features.e2eEncryption.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    <p>{t("help.features.e2eEncryption.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="zero-knowledge">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      {t("help.features.zeroKnowledge.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    <p>{t("help.features.zeroKnowledge.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="self-hosted">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary" />
                      {t("help.features.selfHostedStorage.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    <p>{t("help.features.selfHostedStorage.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="multi-device">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-primary" />
                      {t("help.features.multiDeviceSync.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    <p>{t("help.features.multiDeviceSync.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="offline-backup">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-primary" />
                      {t("help.features.offlineBackup.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    <p>{t("help.features.offlineBackup.desc")}</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="backup-import-export">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-primary" />
                      {t("help.features.backupImportExport.title")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t("help.features.backupImportExport.desc")}</p>
                    
                    {/* Export location section */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <h4 className="font-medium text-foreground text-sm mb-2">
                        {t("help.features.backupImportExport.exportTitle")}
                      </h4>
                      <p className="text-xs">{t("help.features.backupImportExport.exportDesc")}</p>
                    </div>
                    
                    {/* Import location section */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <h4 className="font-medium text-foreground text-sm mb-2">
                        {t("help.features.backupImportExport.importTitle")}
                      </h4>
                      <ul className="space-y-2 text-xs">
                        <li className="flex items-start gap-2">
                          <Smartphone className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{t("help.features.backupImportExport.importMobile")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <HardDrive className="w-3 h-3 mt-0.5 shrink-0" />
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
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-destructive" />
                  {t("help.troubleshooting.nextcloudEncryption.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-4">
                <p>{t("help.troubleshooting.nextcloudEncryption.intro")}</p>
                
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <h4 className="font-medium text-foreground">{t("help.troubleshooting.nextcloudEncryption.whyTitle")}</h4>
                  <p>{t("help.troubleshooting.nextcloudEncryption.why")}</p>
                </div>

                <h4 className="font-semibold text-foreground">{t("help.troubleshooting.nextcloudEncryption.fixTitle")}</h4>
                
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                  <h4 className="font-medium text-foreground">{t("help.troubleshooting.nextcloudEncryption.fixOption1Title")}</h4>
                  <p>{t("help.troubleshooting.nextcloudEncryption.fixOption1Desc")}</p>
                  <div className="space-y-1">
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption1Step1")}</p>
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption1Step2")}</p>
                    <p className="font-mono text-xs bg-muted rounded px-2 py-1">{t("help.troubleshooting.nextcloudEncryption.fixOption1Step3")}</p>
                    <p className="font-mono text-xs bg-muted rounded px-2 py-1">{t("help.troubleshooting.nextcloudEncryption.fixOption1Step4")}</p>
                    <p className="font-mono text-xs bg-muted rounded px-2 py-1">{t("help.troubleshooting.nextcloudEncryption.fixOption1Step5")}</p>
                    <p className="font-mono text-xs bg-muted rounded px-2 py-1">{t("help.troubleshooting.nextcloudEncryption.fixOption1Step6")}</p>
                  </div>
                  <p className="text-xs italic">{t("help.troubleshooting.nextcloudEncryption.fixOption1Note")}</p>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <h4 className="font-medium text-foreground">{t("help.troubleshooting.nextcloudEncryption.fixOption2Title")}</h4>
                  <p>{t("help.troubleshooting.nextcloudEncryption.fixOption2Desc")}</p>
                  <div className="space-y-1">
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption2Step1")}</p>
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption2Step2")}</p>
                    <p>{t("help.troubleshooting.nextcloudEncryption.fixOption2Step3")}</p>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="font-medium text-foreground">{t("help.troubleshooting.nextcloudEncryption.importantNote")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sync-issues">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-destructive" />
                  {t("help.troubleshooting.syncIssues.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>{t("help.troubleshooting.syncIssues.intro")}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t("help.troubleshooting.syncIssues.tip1")}</li>
                  <li>{t("help.troubleshooting.syncIssues.tip2")}</li>
                  <li>{t("help.troubleshooting.syncIssues.tip3")}</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="password-recovery">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-destructive" />
                  {t("help.troubleshooting.passwordRecovery.title")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <p className="text-destructive font-medium bg-destructive/10 p-2 rounded">
                  {t("help.troubleshooting.passwordRecovery.warning")}
                </p>
                <p>{t("help.troubleshooting.passwordRecovery.desc")}</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <h4 className="font-medium text-foreground">{t("help.troubleshooting.passwordRecovery.actionTitle")}</h4>
                  <ul className="list-disc list-inside space-y-1">
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
              <AccordionTrigger className="text-sm">{t("help.faq.dataLocation.question")}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {t("help.faq.dataLocation.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="offline">
              <AccordionTrigger className="text-sm">{t("help.faq.offline.question")}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {t("help.faq.offline.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="devices">
              <AccordionTrigger className="text-sm">{t("help.faq.devices.question")}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {t("help.faq.devices.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="free">
              <AccordionTrigger className="text-sm">{t("help.faq.free.question")}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {t("help.faq.free.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pro">
              <AccordionTrigger className="text-sm">{t("help.faq.pro.question")}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {t("help.faq.pro.answer")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="manage-subscription">
              <AccordionTrigger className="text-sm">{t("help.faq.manageSubscription.question")}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <div className="flex flex-wrap items-center gap-1.5 py-2 px-3 rounded-md bg-muted/50 border border-border/50">
                  <span className="font-medium text-foreground">{t("help.faq.path.step1")}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t("help.faq.path.step2")}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t("help.faq.path.step3")}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t("help.faq.path.step4")}</span>
                </div>
                <p>{t("help.faq.manageSubscription.answer")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="invoices">
              <AccordionTrigger className="text-sm">{t("help.faq.invoices.question")}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <div className="flex flex-wrap items-center gap-1.5 py-2 px-3 rounded-md bg-muted/50 border border-border/50">
                  <span className="font-medium text-foreground">{t("help.faq.path.step1")}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t("help.faq.path.step2")}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t("help.faq.path.step3")}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t("help.faq.path.step4")}</span>
                </div>
                <p>{t("help.faq.invoices.answer")}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cancel-subscription">
              <AccordionTrigger className="text-sm">{t("help.faq.cancelSubscription.question")}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <div className="flex flex-wrap items-center gap-1.5 py-2 px-3 rounded-md bg-muted/50 border border-border/50">
                  <span className="font-medium text-foreground">{t("help.faq.path.step1")}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t("help.faq.path.step2")}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t("help.faq.path.step3")}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t("help.faq.path.step4")}</span>
                </div>
                <p>{t("help.faq.cancelSubscription.answer")}</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );

      case "support":
        return (
          <div className="space-y-6">
            {/* Before Contacting Tip */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-sm">{t("help.support.beforeContacting.title")}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("help.support.beforeContacting.desc")}
              </p>
            </div>

            {/* Contact Card */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">{t("help.support.email.title")}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("help.support.email.desc")}
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <code className="bg-muted px-3 py-2 rounded-md text-sm font-mono text-center sm:text-left sm:flex-1">
                  {t("help.support.email.address")}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyEmail}
                  className="gap-2 w-full sm:w-auto"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      {t("common.copied")}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {t("common.copyEmail")}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground italic">
                {t("help.support.responseTime")}
              </p>
            </div>

            {/* Legal Links */}
            <div className="bg-muted/50 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">{t("help.support.links.title")}</h3>
              </div>
              <div className="space-y-2">
                <Link
                  to="/terms"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("help.support.links.terms")}
                </Link>
                <Link
                  to="/privacy"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("help.support.links.privacy")}
                </Link>
              </div>
            </div>

            {/* App Version */}
            <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/50">
              <p>{t("help.support.version")}: {__APP_VERSION__}</p>
            </div>
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
      <div className="w-[240px] border-r border-border bg-muted/10 shrink-0">
        <ScrollArea className="h-full py-2">
          <TabsList className="flex flex-col h-auto bg-transparent p-0 w-full space-y-1">
            {categories.map((cat) => (
              <SidebarItem key={cat.value} value={cat.value} icon={cat.icon} label={cat.label} />
            ))}
          </TabsList>
        </ScrollArea>
      </div>

      {/* Content Panel */}
      <ScrollArea className="flex-1 bg-background">
        <div className="p-8 max-w-2xl mx-auto space-y-8 pb-20">
          {categories.map((cat) => (
            <TabsContent key={cat.value} value={cat.value} className="mt-0 space-y-4 outline-none">
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
      <Drawer open={open} onOpenChange={onOpenChange} modal={false}>
        <DrawerContent fullHeight hideHandle>
          <DrawerHeader className="text-left flex items-center justify-between pr-4 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              {mobileSelectedCategory ? (
                // Back button + Category title when viewing content
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMobileBack}
                    className="gap-1 px-2 shrink-0 -ml-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t("common.back")}
                  </Button>
                  {selectedCategory && (
                    <div className="flex items-center gap-2 min-w-0">
                      <selectedCategory.icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium truncate">{selectedCategory.label}</span>
                    </div>
                  )}
                </>
              ) : (
                // Main header when viewing category list
                <div>
                  <DrawerTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary/80" />
                    {t("help.title")}
                  </DrawerTitle>
                  <DrawerDescription className="text-sm text-muted-foreground">
                    {t("help.description")}
                  </DrawerDescription>
                </div>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 shrink-0"
            >
              <X className="h-4 w-4" />
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
                <div className="p-4 pb-20">
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
        className="max-w-4xl max-h-[85vh] p-0 overflow-hidden gap-0 bg-background"
        aria-describedby="help-dialog-description"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/10">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl font-medium tracking-tight">
              <BookOpen className="w-5 h-5 text-primary/80" />
              {t("help.title")}
            </DialogTitle>
            <p id="help-dialog-description" className="text-sm text-muted-foreground mt-1">
              {t("help.description")}
            </p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex h-[70vh]">
          {desktopHelpContent}
        </div>
      </DialogContent>
    </Dialog>
  );
};
