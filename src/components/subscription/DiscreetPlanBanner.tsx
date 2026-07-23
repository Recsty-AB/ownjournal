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
import { ChevronRight, X } from "lucide-react";
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
        className="w-full rounded-lg border border-border bg-muted/40 px-4 py-2.5 flex items-center justify-between gap-2 text-left transition-colors hover:bg-muted/70"
      >
        <span className="text-sm text-muted-foreground">
          {t("subscription.freePlan")}
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-primary">
          {showTrialHint
            ? t("subscription.planRow.trialHint")
            : t("subscription.planRow.unlockHint")}
          <ChevronRight className="w-4 h-4" />
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
        className="absolute right-1 top-1 z-10 h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </Button>
      {children}
    </div>
  );
};
