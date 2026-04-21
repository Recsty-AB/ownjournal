import { useState, useEffect, useRef, useCallback } from "react";
import { JournalEntry, JournalEntryData } from "./JournalEntry";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Search, Calendar, Tag, ArrowUp, ChevronDown, ChevronRight } from "lucide-react";
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
import { PREDEFINED_ACTIVITIES, getActivityEmoji } from "@/utils/activities";
import { Activity } from "lucide-react";

const TAGS_COLLAPSED_KEY = 'ownjournal:tags-collapsed';
const ACTIVITIES_COLLAPSED_KEY = 'ownjournal:activities-collapsed';

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
  isPro?: boolean;
  isDemo?: boolean;
  hideFooter?: boolean;
}

export const Timeline = ({ entries, onSaveEntry, onDeleteEntry, onEditingChange, isPro = false, isDemo = false, hideFooter = false }: TimelineProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isTagsCollapsed, setIsTagsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(TAGS_COLLAPSED_KEY);
    return stored === 'true';
  });
  const [isActivitiesCollapsed, setIsActivitiesCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(ACTIVITIES_COLLAPSED_KEY);
    return stored === 'true';
  });
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const newEntryRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Persist tags collapsed state
  useEffect(() => {
    localStorage.setItem(TAGS_COLLAPSED_KEY, String(isTagsCollapsed));
  }, [isTagsCollapsed]);

  // Persist activities collapsed state
  useEffect(() => {
    localStorage.setItem(ACTIVITIES_COLLAPSED_KEY, String(isActivitiesCollapsed));
  }, [isActivitiesCollapsed]);

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

  const handleViewportScroll = useCallback(() => {
    updateShowBackToTop();
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
    };
  }, [handleViewportScroll, updateShowBackToTop, findScrollContainer, entries.length]);

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

  // Filter entries based on search, tags, moods, and date range
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = searchQuery === "" || 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.body.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.some(tag => entry.tags.includes(tag));
    
    const matchesMoods = selectedMoods.length === 0 ||
      (entry.mood && selectedMoods.includes(entry.mood));

    const matchesActivities = selectedActivities.length === 0 ||
      (entry.activities && selectedActivities.some(activity => entry.activities!.includes(activity)));

    const matchesDateRange = (!dateFilter.start && !dateFilter.end) ||
      ((!dateFilter.start || entry.date >= new Date(dateFilter.start)) &&
       (!dateFilter.end || entry.date <= new Date(dateFilter.end + 'T23:59:59')));

    return matchesSearch && matchesTags && matchesMoods && matchesActivities && matchesDateRange;
  });

  const sortedFilteredEntries = [...filteredEntries].sort((a, b) => {
    const dateA = a.date?.getTime() || 0;
    const dateB = b.date?.getTime() || 0;
    if (dateB !== dateA) return dateB - dateA;
    const createdA = a.createdAt?.getTime() || 0;
    const createdB = b.createdAt?.getTime() || 0;
    if (createdB !== createdA) return createdB - createdA;
    return b.id.localeCompare(a.id);
  });

  const groupedEntries = groupEntriesByDate(sortedFilteredEntries, t, currentLocale);
  // Sort groups by the most recent entry date in each group (desc)
  const sortedGroups = Object.entries(groupedEntries).sort((a, b) => {
    const maxA = Math.max(...a[1].map(e => e.date?.getTime() || 0), 0);
    const maxB = Math.max(...b[1].map(e => e.date?.getTime() || 0), 0);
    if (maxB !== maxA) return maxB - maxA;
    return b[0].localeCompare(a[0]);
  });
  const allTags = Array.from(new Set(entries.flatMap(entry => entry.tags)));
  const allMoods = Array.from(new Set(entries.map(entry => entry.mood).filter(Boolean))) as string[];
  const allActivities = Array.from(new Set(entries.flatMap(entry => entry.activities || [])));

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

  return (
    <div className="h-full flex flex-col">
      {/* Header - Mobile-First Design */}
      <div className="p-4 sm:p-6 border-b border-border bg-gradient-paper">
        {/* New Entry Button - Full width on mobile */}
        <Button 
          onClick={() => {
            if (editingEntryId) {
              toast({
                title: t('timeline.finishCurrent'),
                description: t('timeline.finishCurrentDesc'),
                variant: "destructive",
              });
              return;
            }
            setShowNewEntry(true);
            onEditingChange?.(true);
          }}
          className="w-full sm:w-auto mb-4 bg-gradient-primary shadow-glow"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('timeline.newEntry')}
        </Button>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('timeline.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Date range filter - Stack on mobile */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <Calendar className="mr-2 h-4 w-4" />
                {dateFilter.start ? format(new Date(dateFilter.start), 'PPP', { locale: currentLocale }) : t('timeline.startDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent
                mode="single"
                selected={dateFilter.start ? new Date(dateFilter.start) : undefined}
                onSelect={(date) => setDateFilter(prev => ({ ...prev, start: date ? format(date, 'yyyy-MM-dd') : '' }))}
                initialFocus
              />
              {dateFilter.start && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateFilter(prev => ({ ...prev, start: '' }))}>
                    {t('calendar.clear')}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <Calendar className="mr-2 h-4 w-4" />
                {dateFilter.end ? format(new Date(dateFilter.end), 'PPP', { locale: currentLocale }) : t('timeline.endDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent
                mode="single"
                selected={dateFilter.end ? new Date(dateFilter.end) : undefined}
                onSelect={(date) => setDateFilter(prev => ({ ...prev, end: date ? format(date, 'yyyy-MM-dd') : '' }))}
                initialFocus
              />
              {dateFilter.end && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateFilter(prev => ({ ...prev, end: '' }))}>
                    {t('calendar.clear')}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Tags filter */}
        {allTags.length > 0 && (
          <Collapsible open={!isTagsCollapsed} onOpenChange={(open) => setIsTagsCollapsed(!open)}>
            <div className="mb-4">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex items-center gap-2 p-0 h-auto hover:bg-transparent"
                >
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t('journalEntry.tags', 'Tags')} ({allTags.length})
                  </span>
                  {isTagsCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              {/* Show selected tags even when collapsed */}
              {isTagsCollapsed && selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedTags.map(tag => (
                    <Button
                      key={tag}
                      variant="default"
                      size="sm"
                      onClick={() => toggleTag(tag)}
                      className="text-xs h-7"
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              )}
              
              <CollapsibleContent>
                <div className="flex flex-wrap gap-2 mt-2">
                  {allTags.map(tag => (
                    <Button
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleTag(tag)}
                      className="text-xs h-7"
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Activity filter */}
        {allActivities.length > 0 && (
          <Collapsible open={!isActivitiesCollapsed} onOpenChange={(open) => setIsActivitiesCollapsed(!open)}>
            <div className="mb-4">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 p-0 h-auto hover:bg-transparent"
                >
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t('activities.label')} ({allActivities.length})
                  </span>
                  {isActivitiesCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>

              {/* Show selected activities even when collapsed */}
              {isActivitiesCollapsed && selectedActivities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedActivities.map(activity => (
                    <Button
                      key={activity}
                      variant="default"
                      size="sm"
                      onClick={() => toggleActivity(activity)}
                      className="text-xs h-7"
                      aria-label={PREDEFINED_ACTIVITIES.some(p => p.key === activity) ? t(`activities.${activity}`) : activity}
                    >
                      {getActivityEmoji(activity)}{' '}{PREDEFINED_ACTIVITIES.some(p => p.key === activity) ? t(`activities.${activity}`) : activity}
                    </Button>
                  ))}
                </div>
              )}

              <CollapsibleContent>
                <div className="flex flex-wrap gap-2 mt-2">
                  {allActivities.map(activity => (
                    <Button
                      key={activity}
                      variant={selectedActivities.includes(activity) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleActivity(activity)}
                      className="text-xs h-7"
                      aria-label={PREDEFINED_ACTIVITIES.some(p => p.key === activity) ? t(`activities.${activity}`) : activity}
                    >
                      {getActivityEmoji(activity)}{' '}{PREDEFINED_ACTIVITIES.some(p => p.key === activity) ? t(`activities.${activity}`) : activity}
                    </Button>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Mood filter */}
        {allMoods.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-muted-foreground self-center">{t('journalEntry.mood')}:</span>
            {allMoods.map(mood => (
              <Button
                key={mood}
                variant={selectedMoods.includes(mood) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleMood(mood)}
                className="text-xs h-7 capitalize"
                aria-label={t(`journalEntry.moods.${mood}`)}
              >
                {MOOD_EMOJI[mood]}{' '}{t(`journalEntry.moods.${mood}`, mood)}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 overflow-x-hidden">
          {/* New Entry Form */}
          {showNewEntry && (
            <div className="mb-8" ref={newEntryRef}>
              <JournalEntry
                isEditing
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
            <Card className="p-6 sm:p-12 text-center bg-gradient-paper">
              <img src={logo} alt="OwnJournal" className="w-12 h-12 object-contain mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery || selectedTags.length > 0 || selectedMoods.length > 0 || selectedActivities.length > 0 || dateFilter.start || dateFilter.end ? t('timeline.noEntries') : t('timeline.startJourney')}
              </h3>
              <p className="text-muted-foreground mb-6">
                 {searchQuery || selectedTags.length > 0 || selectedMoods.length > 0 || selectedActivities.length > 0 || dateFilter.start || dateFilter.end
                  ? t('timeline.tryAdjusting')
                  : t('timeline.beginDocumenting')
                }
              </p>
              {!searchQuery && selectedTags.length === 0 && selectedMoods.length === 0 && selectedActivities.length === 0 && !dateFilter.start && !dateFilter.end && (
                <Button onClick={() => setShowNewEntry(true)} className="bg-gradient-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('timeline.writeFirst')}
                </Button>
              )}
            </Card>
          ) : (
            sortedGroups.map(([group, groupEntries]) => (
              <div key={group} className="space-y-4">
                <div className="flex items-center gap-3 sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">{group}</h2>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
                
                <div className="space-y-4">
                  {groupEntries
                    .sort((a, b) => {
                      const dateA = a.date?.getTime() || 0;
                      const dateB = b.date?.getTime() || 0;
                      if (dateB !== dateA) return dateB - dateA;
                      const createdA = a.createdAt?.getTime() || 0;
                      const createdB = b.createdAt?.getTime() || 0;
                      if (createdB !== createdA) return createdB - createdA;
                      return b.id.localeCompare(a.id);
                    })
                    .map(entry => (
                      <div key={entry.id} data-entry-id={entry.id}>
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

      {/* Back to Top – icon-only FAB (modern pattern); tooltip + aria-label for clarity and a11y */}
      {showBackToTop && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={scrollToTop}
              size="icon"
              style={{
                bottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
                // On viewports wider than the content column (max-w-4xl = 56rem),
                // hug the content's right edge instead of the viewport edge so
                // the FAB stays visually connected to the journal entries.
                right: 'max(calc(1.5rem + env(safe-area-inset-right)), calc(50vw - 28rem + 1.5rem))',
              }}
              className="fixed z-50 size-11 rounded-full shadow-lg bg-primary hover:bg-primary/90 animate-in fade-in duration-200"
              aria-label={t('timeline.backToTop', 'Back to top')}
            >
              <ArrowUp className="h-5 w-5" />
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