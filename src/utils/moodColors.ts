// Single source of truth for mood colour classes: MoodCalendar cells and the
// mood dots on entries and timeline filters.
// Classes are listed as literal strings so Tailwind's JIT discovers them at build time.

export const MOOD_CELL_COLORS: Record<string, string> = {
  great: "bg-emerald-400 dark:bg-emerald-500",
  good: "bg-blue-400 dark:bg-blue-500",
  okay: "bg-yellow-400 dark:bg-yellow-500",
  poor: "bg-orange-400 dark:bg-orange-500",
  terrible: "bg-red-400 dark:bg-red-500",
};
