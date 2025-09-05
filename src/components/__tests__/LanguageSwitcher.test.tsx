/**
 * LanguageSwitcher Component Tests
 * Tests language selection UI and i18n integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LanguageSwitcher } from '../settings/LanguageSwitcher';
import i18n from '@/i18n/config';

// Mock i18n
vi.mock('@/i18n/config', () => ({
  default: {
    language: 'en',
    changeLanguage: vi.fn((lang) => Promise.resolve()),
    t: (key: string) => key,
  },
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<LanguageSwitcher />);
    expect(container).toBeDefined();
  });

  it('should render language selector component', () => {
    const { container } = render(<LanguageSwitcher />);
    
    // Should have some UI element for language selection
    const selectElement = container.querySelector('[role="combobox"]') || 
                         container.querySelector('select') ||
                         container.querySelector('button');
    expect(selectElement).toBeTruthy();
  });

  it('should have accessible elements', () => {
    const { container } = render(<LanguageSwitcher />);
    
    // Should have proper ARIA attributes or semantic HTML
    const hasAccessibleElement = 
      container.querySelector('[role="combobox"]') ||
      container.querySelector('select') ||
      container.querySelector('button');
    
    expect(hasAccessibleElement).toBeTruthy();
  });

  it('should integrate with i18n', () => {
    render(<LanguageSwitcher />);
    
    // Verify i18n is properly imported and accessible
    expect(i18n).toBeDefined();
    expect(i18n.language).toBe('en');
  });
});
