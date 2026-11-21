import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { JournalEntry, JournalEntryData } from "./JournalEntry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Plus, Search, Calendar, ArrowUp, SlidersHorizontal, X, Moon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import type { Locale } from "date-fns/locale";
import { getDateLocale } from "@/utils/dateLocale";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import logo from "@/assets/logo.png";
import { MOOD_EMOJI } from "@/utils/moodEmoji";
import { MOOD_CELL_COLORS } from "@/utils/moodColors";
import { cn } from "@/lib/utils";
import { PREDEFINED_ACTIVITIES, getActivityEmoji } from "@/utils/activities";
import { withoutDreams, type DreamReflection } from "@/types/dream";
import { FeatureTip } from "./FeatureTip";
import { isJournalLocked } from "@/services/dreamService";
import { hasSeenFeatureTip, setFeatureTipSeen } from "@/utils/featureTip";

const groupEntriesByDate = (entries: JournalEntryData[], t: (key: string) => string, locale: Locale) => {
  const groups: { [key: string]: JournalEntryData[] } = {};
  
  entries.forEach(entry => {
    let groupKey = "";
    
    if (isToday(entry.date)) {
      groupKey = t('timeline.today');
    } else if (isYesterday(entry.date)) {
      groupKey = t('timeline.yesterday');
    } else if (isThisWeek(entry.date)) {
      groupKey = t('timeline.thisWeek');
    } else if (isThisMonth(entry.date)) {
      groupKey = t('timeline.thisMonth');
    } else {
      groupKey = format(entry.date, 'MMMM yyyy', { locale });
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(entry);
  });
  
  return groups;
};

interface TimelineProps {
  entries: JournalEntryData[];
  onSaveEntry: (entry: Omit<JournalEntryData, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteEntry: (id: string) => void;
  onEditingChange?: (isEditing: boolean) => void;
  onSaveReflection?: (entry: JournalEntryData, reflection: DreamReflection) => Promise<void>;
  onSaveDreamThoughts?: (entry: JournalEntryData, thoughts: string) => Promise<void>;
  isPro?: boolean;
  isDemo?: boolean;
  hideFooter?: boolean;
}

export const Timeline = ({ entries, onSaveEntry, onDeleteEntry, onEditingChange, onSaveReflection, onSaveDreamThoughts, isPro = false, isDemo = false, hideFooter = false }: TimelineProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewEntry, setShowNewEntry] = useState(false);
  // The new entry opened from the feature tip starts as a dream.
  const [newEntryIsDream, setNewEntryIsDream] = useState(false);
  // Re-renders the timeline once the tip is dismissed; the flag itself is read
  // from storage on every render (see hasSeenFeatureTip).
  const [, setTipDismissed] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [dreamsOnly, setDreamsOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  // Filters stay folded away until asked for, so the page opens on the
  // writing, not on the controls for narrowing it down.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const newEntryRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Walk up from this component's root to find the nearest ancestor that
  // actually scrolls vertically. Depending on layout this can be the Radix
  // ScrollArea viewport, a parent <main>, or the document scrolling element.
  const findScrollContainer = useCallback((): HTMLElement | null => {
    if (typeof window === 'undefined') return null;
    const radixViewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const candidates: (HTMLElement | null)[] = [radixViewport];
    let node: HTMLElement | null = scrollAreaRef.current;
    while (node && node !== document.body) {
      candidates.push(node);
      node = node.parentElement;
    }
    for (const el of candidates) {
      if (!el) continue;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const canScroll = overflowY === 'auto' || overflowY === 'scroll';
      if (canScroll && el.scrollHeight > el.clientHeight) return el;
    }
    return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
  }, []);

  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const updateShowBackToTop = useCallback(() => {
    const el = scrollContainerRef.current;
    const elScrolled = el ? el.scrollTop > 300 : false;
    const windowScrolled = typeof window !== 'undefined' && window.scrollY > 300;
    setShowBackToTop(elScrolled || windowScrolled);
  }, []);

  // rAF-throttle so scroll events don't trigger a setState each frame tick.
  const scrollRafRef = useRef<number | null>(null);
  const handleViewportScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      updateShowBackToTop();
    });
  }, [updateShowBackToTop]);

  const scrollToTop = useCallback(() => {
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = prefersReducedMotion ? ('auto' as const) : ('smooth' as const);
    const el = scrollContainerRef.current ?? findScrollContainer();
    if (el) el.scrollTo({ top: 0, behavior });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior });
    }
  }, [findScrollContainer]);

  // Resolve the actual scroll container (may be Radix viewport, <main>, or
  // the document) and attach the scroll listener there. Window scroll is
  // also observed because some layouts scroll the document itself.
  useEffect(() => {
    const el = findScrollContainer();
    scrollContainerRef.current = el;
    if (el && el !== document.documentElement && el !== document.body) {
      el.addEventListener('scroll', handleViewportScroll, { passive: true });
    }
    window.addEventListener('scroll', handleViewportScroll, { passive: true });
    updateShowBackToTop();
    return () => {
      if (el && el !== document.documentElement && el !== document.body) {
        el.removeEventListener('scroll', handleViewportScroll);
      }
      window.removeEventListener('scroll', handleViewportScroll);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [handleViewportScroll, updateShowBackToTop, findScrollContainer]);

  // Scroll to new entry form when it appears
  useEffect(() => {
    if (showNewEntry) {
      // Use requestAnimationFrame to ensure DOM is rendered first
      requestAnimationFrame(() => {
        scrollToTop();
        // Backup: ensure the new entry form is visible
        if (newEntryRef.current) {
          newEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }, [showNewEntry, scrollToTop]);

  const currentLocale = getDateLocale(i18n.language);

  // Handle global back action to exit edit/new entry
  useEffect(() => {
    const onBack = () => {
      if (showNewEntry) {
        setShowNewEntry(false);
        onEditingChange?.(false);
      }
    };
    window.addEventListener('app:back', onBack as EventListener);
    return () => window.removeEventListener('app:back', onBack as EventListener);
  }, [showNewEntry, onEditingChange]);

  // Filter entries based on search, tags, moods, and date range.
  // Memoized so a keystroke in search doesn't trigger redundant filter+sort+group
  // when unrelated props/state change.
  const sortedFilteredEntries = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
    const endDate = dateFilter.end ? new Date(dateFilter.end + 'T23:59:59') : null;
    const filtered = entries.filter(entry => {
      const matchesSearch = needle === "" ||
        entry.title.toLowerCase().includes(needle) ||
        entry.body.toLowerCase().includes(needle);
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.some(tag => entry.tags.includes(tag));
      const isDream = entry.type === 'dream';
      // Dreams carry no mood or activities, so those filters never match them.
      const matchesMoods = selectedMoods.length === 0 ||
        (!isDream && entry.mood && selectedMoods.includes(entry.mood));
      const matchesActivities = selectedActivities.length === 0 ||
        (!isDream && entry.activities && selectedActivities.some(activity => entry.activities!.includes(activity)));
      const matchesKind = !dreamsOnly || isDream;
      const matchesDateRange = (!startDate && !endDate) ||
        ((!startDate || entry.date >= startDate) && (!endDate || entry.date <= endDate));
      return matchesSearch && matchesTags && matchesMoods && matchesActivities && matchesKind && matchesDateRange;
    });
    filtered.sort((a, b) => {
      const dateA = a.date?.getTime() || 0;
      const dateB = b.date?.getTime() || 0;
      if (dateB !== dateA) return dateB - dateA;
      const createdA = a.createdAt?.getTime() || 0;
      const createdB = b.createdAt?.getTime() || 0;
      if (createdB !== createdA) return createdB - createdA;
      return b.id.localeCompare(a.id);
    });
    return filtered;
  }, [entries, searchQuery, selectedTags, selectedMoods, selectedActivities, dreamsOnly, dateFilter.start, dateFilter.end]);

  const groupedEntries = useMemo(
    () => groupEntriesByDate(sortedFilteredEntries, t, currentLocale),
    [sortedFilteredEntries, t, currentLocale]
  );

  const sortedGroups = useMemo(() => {
    return Object.entries(groupedEntries).sort((a, b) => {
      const maxA = Math.max(...a[1].map(e => e.date?.getTime() || 0), 0);
      const maxB = Math.max(...b[1].map(e => e.date?.getTime() || 0), 0);
      if (maxB !== maxA) return maxB - maxA;
      return b[0].localeCompare(a[0]);
    });
  }, [groupedEntries]);

  const allTags = useMemo(
    () => Array.from(new Set(entries.flatMap(entry => entry.tags))),
    [entries]
  );
  // Moods in fixed valence order (best → worst) so the filter row is predictable
  // regardless of which moods happen to exist in the current entry set.
  const allMoods = useMemo(() => {
    const VALENCE_ORDER = ['great', 'good', 'okay', 'poor', 'terrible'];
    const present = new Set(withoutDreams(entries).map(entry => entry.mood).filter(Boolean) as string[]);
    return VALENCE_ORDER.filter(m => present.has(m));
  }, [entries]);
  const allActivities = useMemo(
    () => Array.from(new Set(withoutDreams(entries).flatMap(entry => entry.activities || []))),
    [entries]
  );
  const hasDreams = useMemo(() => entries.some(entry => entry.type === 'dream'), [entries]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const toggleMood = (mood: string) => {
    setSelectedMoods(prev =>
      prev.includes(mood)
        ? prev.filter(m => m !== mood)
        : [...prev, mood]
    );
  };

  const toggleActivity = (activity: string) => {
    setSelectedActivities(prev =>
      prev.includes(activity)
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    );
  };

  const activeFilterCount =
    selectedTags.length + selectedMoods.length + selectedActivities.length +
    (dreamsOnly ? 1 : 0) +
    (dateFilter.start ? 1 : 0) + (dateFilter.end ? 1 : 0);
  const isFiltering = searchQuery !== "" || activeFilterCount > 0;

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedMoods([]);
    setSelectedActivities([]);
    setDreamsOnly(false);
    setDateFilter({ start: "", end: "" });
  };

  const startNewEntry = () => {
    if (editingEntryId) {
      toast({
        title: t('timeline.finishCurrent'),
        description: t('timeline.finishCurrentDesc'),
        variant: "destructive",
      });
      return;
    }
    setNewEntryIsDream(false);
    setShowNewEntry(true);
    onEditingChange?.(true);
  };

  // One-time tip about dreams and voice entry for a journal that is already
  // in use. Someone who finishes the tour has just read about the dream
  // journal, so the tour marks the tip as seen (see Index). Not while writing,
  // and not while an encrypted journal is locked.
  const showFeatureTip =
    !isDemo && !showNewEntry && !editingEntryId && !hasSeenFeatureTip() && entries.length > 0 && !isJournalLocked();

  const dismissFeatureTip = () => {
    setFeatureTipSeen();
    setTipDismissed(true);
  };

  const writeDreamFromTip = () => {
    dismissFeatureTip();
    setNewEntryIsDream(true);
    setShowNewEntry(true);
    onEditingChange?.(true);
  };

  const activityLabel = (activity: string) =>
    PREDEFINED_ACTIVITIES.some(p => p.key === activity) ? t(`activities.${activity}`) : activity;

  const renderDateFilter = (edge: 'start' | 'end') => (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="chip" aria-pressed={!!dateFilter[edge]}>
          <Calendar aria-hidden="true" className="h-4 w-4" />
          {dateFilter[edge]
            ? format(new Date(dateFilter[edge]), 'PP', { locale: currentLocale })
            : t(edge === 'start' ? 'timeline.startDate' : 'timeline.endDate')}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={dateFilter[edge] ? new Date(dateFilter[edge]) : undefined}
          onSelect={(date) => setDateFilter(prev => ({ ...prev, [edge]: date ? format(date, 'yyyy-MM-dd') : '' }))}
          initialFocus
        />
        {dateFilter[edge] && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateFilter(prev => ({ ...prev, [edge]: '' }))}>
              {t('calendar.clear')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar: find, narrow, write. */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('timeline.searchPlaceholder')}
              aria-label={t('timeline.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-full border-border bg-card pl-11 pr-4 shadow-soft"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(open => !open)}
            aria-expanded={filtersOpen}
            aria-controls="timeline-filters"
            aria-label={t('timeline.filters')}
            className={cn(
              "h-11 shrink-0 rounded-full border-border bg-card px-3.5 shadow-soft sm:px-4",
              (filtersOpen || activeFilterCount > 0) && "border-primary"
            )}
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">{t('timeline.filters')}</span>
            {activeFilterCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-medium tabular-nums text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {/* On phones the floating button below is the way to write. */}
          <Button onClick={startNewEntry} className="hidden h-11 shrink-0 rounded-full px-5 bg-gradient-primary shadow-glow sm:inline-flex">
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t('timeline.newEntry')}
          </Button>
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent
            id="timeline-filters"
            className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up"
          >
            <div className="mt-3 space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                {renderDateFilter('start')}
                {renderDateFilter('end')}
                {hasDreams && (
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={dreamsOnly}
                    onClick={() => setDreamsOnly(on => !on)}
                  >
                    <Moon aria-hidden="true" className="h-4 w-4" />
                    {t('dream.filter')}
                  </button>
                )}
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto rounded-full text-muted-foreground">
                    <X aria-hidden="true" className="h-4 w-4" />
                    {t('timeline.clearFilters')}
                  </Button>
                )}
              </div>

              {allMoods.length > 0 && (
                <div role="group" aria-labelledby="timeline-filter-mood" className="space-y-2">
                  <p id="timeline-filter-mood" className="eyebrow">{t('journalEntry.mood')}</p>
                  <div className="flex flex-wrap gap-2">
                    {allMoods.map(mood => (
                      <button
                        key={mood}
                        type="button"
                        className="chip"
                        aria-pressed={selectedMoods.includes(mood)}
                        onClick={() => toggleMood(mood)}
                      >
                        {/* Colour is a second cue only; the label carries the meaning. */}
                        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", MOOD_CELL_COLORS[mood])} />
                        {t(`journalEntry.moods.${mood}`, mood)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {allActivities.length > 0 && (
                <div role="group" aria-labelledby="timeline-filter-activities" className="space-y-2">
                  <p id="timeline-filter-activities" className="eyebrow">{t('activities.label')}</p>
                  <div className="flex flex-wrap gap-2">
                    {allActivities.map(activity => (
                      <button
                        key={activity}
                        type="button"
                        className="chip"
                        aria-pressed={selectedActivities.includes(activity)}
                        onClick={() => toggleActivity(activity)}
                      >
                        <span aria-hidden="true">{getActivityEmoji(activity)}</span>
                        {activityLabel(activity)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {allTags.length > 0 && (
                <div role="group" aria-labelledby="timeline-filter-tags" className="space-y-2">
                  <p id="timeline-filter-tags" className="eyebrow">{t('journalEntry.tags', 'Tags')}</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className="chip"
                        aria-pressed={selectedTags.includes(tag)}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 overflow-x-hidden">
          {showFeatureTip && <FeatureTip onWriteDream={writeDreamFromTip} onDismiss={dismissFeatureTip} />}

          {/* New Entry Form */}
          {showNewEntry && (
            <div className="mb-8" ref={newEntryRef}>
              <JournalEntry
                isEditing
                startAsDream={newEntryIsDream}
                editingEntryId={editingEntryId}
                onEditStart={() => setEditingEntryId('new-entry')}
                onEditEnd={() => setEditingEntryId(null)}
                onSave={(entry) => {
                  onSaveEntry(entry);
                  setShowNewEntry(false);
                  setEditingEntryId(null);
                  onEditingChange?.(false);
                }}
                onCancel={() => {
                  setShowNewEntry(false);
                  setEditingEntryId(null);
                  onEditingChange?.(false);
                }}
                allEntries={entries}
                isPro={isPro}
                isDemo={isDemo}
              />
            </div>
          )}

          {/* Grouped Entries */}
          {Object.keys(groupedEntries).length === 0 ? (
            <div className="mx-auto max-w-md px-2 py-12 text-center sm:py-20">
              <img src={logo} alt="" className="mx-auto mb-6 h-12 w-12 object-contain opacity-60 dark:invert" />
              <h3 className="text-2xl font-semibold text-foreground mb-2">
                {isFiltering ? t('timeline.noEntries') : t('timeline.startJourney')}
              </h3>
              <p className="text-muted-foreground mb-8">
                {isFiltering ? t('timeline.tryAdjusting') : t('timeline.beginDocumenting')}
              </p>
              {isFiltering ? (
                activeFilterCount > 0 && (
                  <Button variant="outline" onClick={clearFilters} className="rounded-full">
                    {t('timeline.clearFilters')}
                  </Button>
                )
              ) : (
                <Button onClick={startNewEntry} className="h-11 rounded-full px-6 bg-gradient-primary shadow-glow">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  {t('timeline.writeFirst')}
                </Button>
              )}
            </div>
          ) : (
            sortedGroups.map(([group, groupEntries]) => (
              <div key={group} className="space-y-4">
                <div className="sticky top-0 z-10 flex items-center gap-4 bg-background/90 py-2 backdrop-blur-sm">
                  <h2 className="eyebrow">{group}</h2>
                  <div aria-hidden="true" className="h-px flex-1 bg-border" />
                </div>
                
                <div className="space-y-4">
                  {/* entries already sorted in sortedFilteredEntries; groupEntries preserves that order */}
                  {groupEntries.map(entry => (
                      <div key={entry.id} data-entry-id={entry.id} className="animate-settle">
                      <JournalEntry
                        entry={entry}
                        editingEntryId={editingEntryId}
                        onEditStart={() => setEditingEntryId(entry.id)}
                        onEditEnd={() => setEditingEntryId(null)}
                        onSave={(updatedEntry) => {
                          onSaveEntry(updatedEntry);
                          setEditingEntryId(null);
                          onEditingChange?.(false);
                        }}
                        onDelete={onDeleteEntry}
                        onCancel={() => {
                          setEditingEntryId(null);
                          onEditingChange?.(false);
                        }}
                        onEditingChange={onEditingChange}
                        onSaveReflection={onSaveReflection}
                        onSaveDreamThoughts={onSaveDreamThoughts}
                        allEntries={entries}
                        isPro={isPro}
                        isDemo={isDemo}
                      />
                      </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Footer - conditionally rendered */}
          {!hideFooter && (
            <footer className="border-t border-border pt-4 sm:pt-6 mt-6 sm:mt-8 pb-6 sm:pb-8 bg-background">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                <span>© {new Date().getFullYear()} OwnJournal</span>
                <span className="hidden sm:inline">·</span>
                <a href="/terms" className="hover:text-primary hover:underline">
                  {t('legal.terms.title')}
                </a>
                <span className="hidden sm:inline">·</span>
                <a href="/privacy" className="hover:text-primary hover:underline">
                  {t('legal.privacy.title')}
                </a>
              </div>
            </footer>
          )}
        </div>
      </ScrollArea>

      {/* New Entry – floating button. Always there on phones; on wider screens the
          toolbar button does the job until it has scrolled out of view. */}
      {!showNewEntry && !editingEntryId && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={startNewEntry}
              size="icon"
              style={{
                bottom: 'calc(1.5rem + var(--safe-area-inset-bottom))',
              }}
              // Hug the content column's right edge (where the ScrollArea scrollbar sits) so the
              // FAB stays visually connected to the entries instead of drifting to the viewport corner
              // on wide monitors. Breakpoints mirror the main container's max-w-4xl / xl:5xl / 2xl:6xl.
              className={cn(
                "fixed z-50 size-14 rounded-full shadow-large bg-primary text-primary-foreground hover:bg-primary/90 right-[max(calc(1.5rem_+_var(--safe-area-inset-right)),calc(50vw_-_28rem_+_1.5rem))]",
                !showBackToTop && "sm:hidden"
              )}
              aria-label={t('timeline.newEntry')}
            >
              <Plus aria-hidden="true" className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            {t('timeline.newEntry')}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Back to Top – stacks above the New Entry FAB so neither overlaps */}
      {showBackToTop && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={scrollToTop}
              size="icon"
              style={{
                bottom: 'calc(5.75rem + var(--safe-area-inset-bottom))',
              }}
              // Stacks above the size-14 New Entry FAB; +0.375rem centers this size-11 button over it.
              className="fixed z-50 size-11 rounded-full border border-border bg-card text-foreground shadow-medium hover:bg-accent animate-in fade-in duration-200
                right-[calc(max(calc(1.5rem_+_var(--safe-area-inset-right)),calc(50vw_-_28rem_+_1.5rem))_+_0.375rem)]"
              aria-label={t('timeline.backToTop', 'Back to top')}
            >
              <ArrowUp aria-hidden="true" className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            {t('timeline.backToTop', 'Back to top')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
