import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscreetPlanBanner } from '../DiscreetPlanBanner';

const MILESTONES_KEY = 'plus_banner_milestones';
// Mirrors BANNER_MILESTONES in DiscreetPlanBanner.tsx (not exported to keep
// the component file fast-refresh compatible).
const FIRST_MILESTONE = 10;

const renderBanner = (props: { entryCount: number; showTrialHint?: boolean }) =>
  render(
    <DiscreetPlanBanner {...props}>
      <div data-testid="full-banner">full upgrade surface</div>
    </DiscreetPlanBanner>
  );

describe('DiscreetPlanBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the collapsed row by default, without the full banner', () => {
    renderBanner({ entryCount: 0 });
    expect(screen.getByText('subscription.freePlan')).toBeInTheDocument();
    expect(screen.queryByTestId('full-banner')).not.toBeInTheDocument();
  });

  it('shows the trial hint when showTrialHint is true', () => {
    renderBanner({ entryCount: 0, showTrialHint: true });
    expect(screen.getByText('subscription.planRow.trialHint')).toBeInTheDocument();
  });

  it('shows the generic unlock hint when showTrialHint is false', () => {
    renderBanner({ entryCount: 0 });
    expect(screen.getByText('subscription.planRow.unlockHint')).toBeInTheDocument();
  });

  it('expands to the full banner when the row is tapped', async () => {
    const user = userEvent.setup();
    renderBanner({ entryCount: 0 });
    await user.click(screen.getByRole('button', { name: /freePlan/ }));
    expect(screen.getByTestId('full-banner')).toBeInTheDocument();
  });

  it('collapses back to the row via the collapse button', async () => {
    const user = userEvent.setup();
    renderBanner({ entryCount: 0 });
    await user.click(screen.getByRole('button', { name: /freePlan/ }));
    await user.click(
      screen.getByRole('button', { name: 'subscription.planRow.collapse' })
    );
    expect(screen.queryByTestId('full-banner')).not.toBeInTheDocument();
    expect(screen.getByText('subscription.freePlan')).toBeInTheDocument();
  });

  it('auto-expands when a milestone is crossed for the first time', () => {
    renderBanner({ entryCount: FIRST_MILESTONE });
    expect(screen.getByTestId('full-banner')).toBeInTheDocument();
  });

  it('marks every crossed milestone as shown, not just the first', () => {
    renderBanner({ entryCount: 47 });
    expect(screen.getByTestId('full-banner')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(MILESTONES_KEY)!)).toEqual(
      expect.arrayContaining([10, 30])
    );
  });

  it('does not re-expand for a milestone that was already shown', () => {
    localStorage.setItem(MILESTONES_KEY, JSON.stringify([10]));
    renderBanner({ entryCount: 12 });
    expect(screen.queryByTestId('full-banner')).not.toBeInTheDocument();
  });

  it('auto-expands again when the next milestone is crossed', () => {
    localStorage.setItem(MILESTONES_KEY, JSON.stringify([10]));
    renderBanner({ entryCount: 30 });
    expect(screen.getByTestId('full-banner')).toBeInTheDocument();
  });

  it('recovers from corrupt persisted milestone state', () => {
    localStorage.setItem(MILESTONES_KEY, 'not json');
    renderBanner({ entryCount: 10 });
    expect(screen.getByTestId('full-banner')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(MILESTONES_KEY)!)).toContain(10);
  });

  it('stays collapsed below the first milestone', () => {
    renderBanner({ entryCount: FIRST_MILESTONE - 1 });
    expect(screen.queryByTestId('full-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem(MILESTONES_KEY)).toBeNull();
  });
});
