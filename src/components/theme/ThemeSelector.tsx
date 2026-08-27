import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { APP_THEMES, useAppTheme } from '@/hooks/useAppTheme';
import { ThemeIcon } from './ThemeIcon';

/** Three-way theme picker for the Appearance section of Settings. */
export function ThemeSelector() {
  const { t } = useTranslation();
  const { activeTheme, setTheme } = useAppTheme();

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={t('theme.label')} className="grid grid-cols-3 gap-2">
        {APP_THEMES.map((theme) => {
          const selected = activeTheme === theme;
          return (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(theme)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border hover:bg-muted'
              )}
            >
              <ThemeIcon theme={theme} aria-hidden="true" className="h-5 w-5" />
              {t(`theme.${theme}`)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('theme.paperHint')}</p>
    </div>
  );
}
