import { endOfDay, startOfDay, startOfYear, subDays } from "date-fns";

/** The periods Trend Analysis and Dream patterns can cover. */
export type PeriodPreset = "last30days" | "last90days" | "thisYear" | "custom";

/**
 * Start and end of a period, as of `now`. A custom period without both dates
 * falls back to the last 30 days.
 */
export function periodRange(
  preset: PeriodPreset,
  customStart: Date | undefined,
  customEnd: Date | undefined,
  now: Date = new Date(),
): { start: Date; end: Date } {
  switch (preset) {
    case "last90days":
      return { start: subDays(now, 90), end: now };
    case "thisYear":
      return { start: startOfYear(now), end: now };
    case "custom":
      if (customStart && customEnd) return { start: startOfDay(customStart), end: endOfDay(customEnd) };
      return { start: subDays(now, 30), end: now };
    case "last30days":
    default:
      return { start: subDays(now, 30), end: now };
  }
}
