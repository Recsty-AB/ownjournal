import { useTranslation } from "react-i18next";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getDateLocale } from "@/utils/dateLocale";
import type { PeriodPreset } from "@/utils/period";

const PERIOD_OPTIONS = [
  { value: "last30days" as const, label: "trendAnalysis.last30days" },
  { value: "last90days" as const, label: "trendAnalysis.last90days" },
  { value: "thisYear" as const, label: "trendAnalysis.thisYear" },
  { value: "custom" as const, label: "trendAnalysis.customRange" },
];

// On iOS native, Radix UI's portal-based Select doesn't receive touch events
// reliably in Capacitor's WKWebView, so fall back to a native <select>.
const isNativeIOS = !!(window as any).Capacitor?.isNativePlatform?.() &&
  (window as any).Capacitor?.getPlatform?.() === 'ios';

export const PeriodSelect = ({
  value,
  onChange,
  disabled,
}: {
  value: PeriodPreset;
  onChange: (value: PeriodPreset) => void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  if (isNativeIOS) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PeriodPreset)}
        disabled={disabled}
        aria-label={t("trendAnalysis.selectPeriod")}
        className="min-h-11 min-w-[11rem] flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{t(option.label)}</option>
        ))}
      </select>
    );
  }
  return (
    <Select value={value} onValueChange={(next) => onChange(next as PeriodPreset)} disabled={disabled}>
      <SelectTrigger className="min-h-11 min-w-[11rem] flex-1" aria-label={t("trendAnalysis.selectPeriod")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/** Start and end date pickers for a custom period. */
export const CustomPeriodPicker = ({
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  start: Date | undefined;
  end: Date | undefined;
  onStartChange: (date: Date | undefined) => void;
  onEndChange: (date: Date | undefined) => void;
}) => {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const picker = (
    label: string,
    selected: Date | undefined,
    onSelect: (date: Date | undefined) => void,
    isDisabled: (date: Date) => boolean,
  ) => (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal", !selected && "text-muted-foreground")}
          >
            <CalendarIcon aria-hidden="true" className="mr-2 h-4 w-4" />
            {selected ? format(selected, "PPP", { locale: dateLocale }) : t("trendAnalysis.pickDate")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={onSelect}
            disabled={isDisabled}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
      {picker(t("trendAnalysis.startDate"), start, onStartChange, (date) => date > new Date() || (!!end && date > end))}
      {picker(t("trendAnalysis.endDate"), end, onEndChange, (date) => date > new Date() || (!!start && date < start))}
    </div>
  );
};
