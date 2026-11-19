/**
 * DiscreetPlanBanner
 *
 * Collapses the full upgrade surface (SubscriptionBanner on web/desktop,
 * NativePaywall on iOS/Android) into a one-line "Free Plan · <hint> →" row
 * so the home screen isn't dominated by promotional content on every visit.
 *
 * The full surface (passed as children) is shown when:
 * - the user taps the row (session-only, collapses back on demand), or
 * - a journaling milestone is crossed for the first time — the moments when
 *   Plus features (trend analysis, AI insights) become genuinely useful.
 *   Each milestone auto-expands the banner exactly once per user/device;
 *   which milestones have been shown is persisted user-scoped.
 *
 * Compliance note: this component adds no purchase surface of its own. The
 * render sites in Index.tsx keep their existing platform gates
 * (canShowNativeCheckout / canShowStripeCheckout) around it, and the row is
 * only an entry point to the already-compliant surface passed as children.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChevronRight, Crown, X } from "lucide-react";
import { scopedKey } from "@/utils/userScope";

/**
 * Journal-entry counts that auto-expand the full banner once each.
 * 10 ≈ the habit is forming; 30 ≈ a month of daily journaling (enough data
 * for trend analysis to be compelling); 100 = long-term journaler.
 */
const BANNER_MILESTONES = [10, 30, 100];

const SHOWN_MILESTONES_KEY = "plus_banner_milestones";

function readShownMilestones(): number[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(scopedKey(SHOWN_MILESTONES_KEY)) ?? "[]"
    );
    return Array.isArray(parsed)
      ? parsed.filter((m) => typeof m === "number")
      : [];
  } catch {
    return [];
  }
}

interface DiscreetPlanBannerProps {
  /** Journal entry count (excluding notes) used for milestone checks. */
  entryCount: number;
  /**
   * Show the "try Plus free" hint on the collapsed row. Only pass true when
   * trial eligibility is known locally (web/desktop + !hasUsedTrial). On
   * native the store owns trial eligibility, so the row stays generic and
   * NativePaywall shows store-accurate trial copy after expansion.
   */
  showTrialHint?: boolean;
  /** The full upgrade surface to reveal (SubscriptionBanner / NativePaywall). */
  children: ReactNode;
}

export const DiscreetPlanBanner = ({
  entryCount,
  showTrialHint = false,
  children,
}: DiscreetPlanBannerProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const shown = readShownMilestones();
    const crossed = BANNER_MILESTONES.filter((m) => entryCount >= m);
    if (!crossed.some((m) => !shown.includes(m))) return;
    // Mark every crossed milestone at once so a user arriving with e.g. 47
    // entries gets one auto-expansion, not one queued per milestone.
    try {
      localStorage.setItem(
        scopedKey(SHOWN_MILESTONES_KEY),
        JSON.stringify(Array.from(new Set([...shown, ...crossed])))
      );
    } catch {
      // Persistence failure just means the milestone may show again later.
    }
    setExpanded(true);
  }, [entryCount]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="eyebrow">
          {t("subscription.freePlan")}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
          <Crown aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-seal" />
          {showTrialHint
            ? t("subscription.planRow.trialHint")
            : t("subscription.planRow.unlockHint")}
          <ChevronRight aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </span>
      </button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setExpanded(false)}
        aria-label={t("subscription.planRow.collapse")}
        className="absolute right-2 top-2 z-10 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
      >
        <X aria-hidden="true" className="w-4 h-4" />
      </Button>
      {children}
    </div>
  );
};
