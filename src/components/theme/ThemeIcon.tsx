import { Sun, Moon, FileText, type LucideProps } from 'lucide-react';
import type { AppTheme } from '@/hooks/useAppTheme';

const THEME_ICONS: Record<AppTheme, React.ComponentType<LucideProps>> = {
  light: Sun,
  dark: Moon,
  paper: FileText,
};

interface ThemeIconProps extends LucideProps {
  theme: AppTheme;
}

/** The icon that stands for a given theme, shared by the header and settings. */
export function ThemeIcon({ theme, ...props }: ThemeIconProps) {
  const Icon = THEME_ICONS[theme];
  return <Icon {...props} />;
}
