import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '../NotFound';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'notFound.title': '404',
        'notFound.message': 'Page not found',
        'notFound.returnHome': 'Return to Home',
      };
      return translations[key] || key;
    },
  }),
}));

describe('NotFound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });

  it('should render 404 heading', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(container.textContent).toContain('404');
  });

  it('should render error message', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(container.textContent).toContain('Page not found');
  });

  it('should render return home link', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(container.textContent).toContain('Return to Home');
  });

  it('should render link with correct href', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/');
  });

  it('should have centered layout', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
  });
});
