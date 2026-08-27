import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TouchSelect } from '../touch-select';

const OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'de', label: 'Deutsch' },
];

const setup = (onValueChange = vi.fn(), value = 'en') => {
  render(
    <TouchSelect
      value={value}
      onValueChange={onValueChange}
      options={OPTIONS}
      aria-label="Language"
    />
  );
  return onValueChange;
};

describe('TouchSelect', () => {
  it('shows the selected label and keeps the list closed until asked', () => {
    setup();

    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveTextContent('English');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens on click and reports the chosen value', async () => {
    const user = userEvent.setup();
    const onValueChange = setup();

    await user.click(screen.getByRole('combobox', { name: 'Language' }));
    expect(screen.getAllByRole('option')).toHaveLength(OPTIONS.length);

    await user.click(screen.getByRole('option', { name: '日本語' }));

    expect(onValueChange).toHaveBeenCalledWith('ja');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('marks the current value as selected', async () => {
    const user = userEvent.setup();
    setup(vi.fn(), 'de');

    await user.click(screen.getByRole('combobox', { name: 'Language' }));

    expect(screen.getByRole('option', { name: 'Deutsch' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute('aria-selected', 'false');
  });

  it('closes on Escape and on an outside pointer press', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('combobox', { name: 'Language' });

    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
