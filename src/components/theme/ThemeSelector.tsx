import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { THEME_PREFERENCES, useAppTheme } from '@/hooks/useAppTheme';
import { ThemeIcon } from './ThemeIcon';

/** Theme picker for the Appearance section of Settings. */
export function ThemeSelector() {
  const { t } = useTranslation();
  const { theme: preference, setTheme } = useAppTheme();

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label={t('theme.label')}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {THEME_PREFERENCES.map((theme) => {
          // Checked follows the stored preference, not the resolved palette:
          // with `system` picked, `light` must not also read as selected.
          const selected = preference === theme;
          return (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(theme)}
              className={cn(
                'flex flex-col items-center gap-2 whitespace-normal rounded-lg border p-3 text-center text-sm leading-snug transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border hover:bg-muted'
              )}
            >
              <ThemeIcon theme={theme} aria-hidden="true" className="h-5 w-5 shrink-0" />
              {t(`theme.${theme}`)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('theme.paperHint')}</p>
    </div>
  );
}
