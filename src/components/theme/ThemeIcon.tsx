import { Sun, Moon, FileText, Monitor, type LucideProps } from 'lucide-react';
import type { ThemePreference } from '@/hooks/useAppTheme';

const THEME_ICONS: Record<ThemePreference, React.ComponentType<LucideProps>> = {
  light: Sun,
  dark: Moon,
  paper: FileText,
  system: Monitor,
};

interface ThemeIconProps extends LucideProps {
  theme: ThemePreference;
}

/** The icon that stands for a given theme, shared by the header and settings. */
export function ThemeIcon({ theme, ...props }: ThemeIconProps) {
  const Icon = THEME_ICONS[theme];
  return <Icon {...props} />;
}
