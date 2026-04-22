// Single source of truth for mood color classes. Consumers:
//   - JournalEntry badges (MOOD_BADGE_COLORS)
//   - MoodCalendar cells (MOOD_CELL_COLORS)
//   - Timeline mood filter outlines (MOOD_BORDER_COLORS)
// Classes are listed as literal strings so Tailwind's JIT discovers them at build time.

export const MOOD_CELL_COLORS: Record<string, string> = {
  great: "bg-emerald-400 dark:bg-emerald-500",
  good: "bg-blue-400 dark:bg-blue-500",
  okay: "bg-yellow-400 dark:bg-yellow-500",
  poor: "bg-orange-400 dark:bg-orange-500",
  terrible: "bg-red-400 dark:bg-red-500",
};

// text-* used with border-current on the outlined mood filter chips.
export const MOOD_BORDER_COLORS: Record<string, string> = {
  great: "text-emerald-400 dark:text-emerald-500",
  good: "text-blue-400 dark:text-blue-500",
  okay: "text-yellow-500 dark:text-yellow-500",
  poor: "text-orange-400 dark:text-orange-500",
  terrible: "text-red-400 dark:text-red-500",
};

export const MOOD_BADGE_COLORS: Record<string, string> = {
  great: "bg-emerald-100 text-emerald-800 border-emerald-200",
  good: "bg-blue-100 text-blue-800 border-blue-200",
  okay: "bg-yellow-100 text-yellow-800 border-yellow-200",
  poor: "bg-orange-100 text-orange-800 border-orange-200",
  terrible: "bg-red-100 text-red-800 border-red-200",
};
