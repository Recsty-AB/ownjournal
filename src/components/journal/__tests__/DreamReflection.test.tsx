import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { JournalEntryData } from '../JournalEntry';
import { hashDreamInput, type DreamReflection as DreamReflectionData } from '@/types/dream';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  requestDreamReflection: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
// Like the global mock, but shows the remaining count so the tests can read it.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'remaining' in opts ? `${key}:${opts.remaining}/${opts.limit}` : key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  },
}));
vi.mock('@/services/dreamService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/dreamService')>();
  return { ...actual, requestDreamReflection: mocks.requestDreamReflection };
});

import { DreamReflection } from '../DreamReflection';
import { DreamRequestError, setDreamConsent } from '@/services/dreamService';
import { resetDreamReflectionRequests } from '@/hooks/useDreamReflectionRequest';
import { setCurrentUserId } from '@/utils/userScope';

const DREAM_TEXT = 'I was walking through a house I did not know, and every room had a window looking onto the sea.';

const reflection = (overrides: Partial<DreamReflectionData> = {}): DreamReflectionData => ({
  version: 1,
  createdAt: '2026-11-19T07:00:00.000Z',
  contentHash: hashDreamInput(DREAM_TEXT, { feelings: ['curiosity'] }),
  summary: 'You walked through an unfamiliar house with sea views.',
  themes: [{ title: 'Exploring', note: 'Perhaps something new is opening up.' }],
  images: [{ image: 'Windows onto the sea', possibilities: 'Maybe a sense of openness.' }],
  wakingLinks: [],
  questions: ['Where in your life are you exploring?'],
  coded: { characters: [], settings: ['house', 'sea'], emotions: ['curiosity'], themes: ['exploring'] },
  care: 'none',
  ...overrides,
});

const dream = (overrides: Partial<JournalEntryData> = {}): JournalEntryData => ({
  id: 'dream-1',
  date: new Date('2026-11-19T06:30:00Z'),
  title: 'The house by the sea',
  body: DREAM_TEXT,
  tags: [],
  mood: 'okay',
  createdAt: new Date('2026-11-19T06:30:00Z'),
  updatedAt: new Date('2026-11-19T06:30:00Z'),
  type: 'dream',
  dream: { feelings: ['curiosity'] },
  ...overrides,
});

// Like the page: a saved reflection comes back into the entry prop.
function Harness({ entry, onSaveReflection, ...rest }: React.ComponentProps<typeof DreamReflection>) {
  const [current, setCurrent] = useState(entry);
  return (
    <DreamReflection
      {...rest}
      entry={current}
      onSaveReflection={async (value) => {
        await onSaveReflection(value);
        setCurrent((e) => ({ ...e, dreamReflection: value }));
      }}
    />
  );
}

function renderCard(props: Partial<React.ComponentProps<typeof DreamReflection>> = {}) {
  const onSaveReflection = props.onSaveReflection ?? vi.fn().mockResolvedValue(undefined);
  const view = render(
    <Harness entry={dream()} allEntries={[]} isPro {...props} onSaveReflection={onSaveReflection} />,
  );
  return { onSaveReflection, ...view };
}

beforeEach(() => {
  localStorage.clear();
  setCurrentUserId(null);
  resetDreamReflectionRequests();
  mocks.toast.mockReset();
  mocks.requestDreamReflection.mockReset();
});

describe('DreamReflection', () => {
  it('shows free users a disabled button and an informational line, no purchase action', () => {
    renderCard({ isPro: false });

    expect(screen.getByRole('button', { name: /dream.reflection.reflect/ })).toBeDisabled();
    expect(screen.getByText('dream.reflection.plusOnly')).toBeInTheDocument();
  });

  it('renders nothing in the demo', () => {
    const { container } = render(
      <DreamReflection entry={dream()} allEntries={[]} isPro isDemo onSaveReflection={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a dream from the startup list, which has no text or details yet', () => {
    // A locked or still-loading journal lists its entries without their content.
    const { container } = render(
      <DreamReflection
        entry={dream({ body: '', dream: undefined, dreamReflection: undefined })}
        allEntries={[]}
        isPro
        onSaveReflection={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('asks for consent before the first reflection, then reflects and saves', async () => {
    mocks.requestDreamReflection.mockResolvedValue({ reflection: reflection(), used: 1 });
    const { onSaveReflection } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));
    expect(await screen.findByText('dream.reflection.consent.title')).toBeInTheDocument();
    expect(mocks.requestDreamReflection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'dream.reflection.consent.accept' }));

    expect(await screen.findByText('You walked through an unfamiliar house with sea views.')).toBeInTheDocument();
    expect(mocks.requestDreamReflection).toHaveBeenCalledWith(expect.objectContaining({ id: 'dream-1' }), [], 'en');
    expect(onSaveReflection).toHaveBeenCalledWith(expect.objectContaining({ summary: reflection().summary }));
  });

  it('does not ask again once consent was given', async () => {
    setDreamConsent();
    mocks.requestDreamReflection.mockResolvedValue({ reflection: reflection(), used: 1 });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));

    await waitFor(() => expect(mocks.requestDreamReflection).toHaveBeenCalledOnce());
    expect(screen.queryByText('dream.reflection.consent.title')).not.toBeInTheDocument();
  });

  it('stops dreams that are too short before anything is sent', () => {
    setDreamConsent();
    renderCard({ entry: dream({ body: 'Falling.' }) });

    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));

    expect(mocks.requestDreamReflection).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'dream.reflection.errors.tooShort' }));
  });

  it('says requests are paused for the month when the failed-request cap is reached', async () => {
    setDreamConsent();
    mocks.requestDreamReflection.mockRejectedValue(new DreamRequestError('failedLimitReached'));
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'dream.reflection.errors.failedLimitReached' }),
      ),
    );
  });

  it('explains the monthly limit when the server reports it', async () => {
    setDreamConsent();
    mocks.requestDreamReflection.mockRejectedValue(new DreamRequestError('limitReached'));
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'dream.reflection.errors.limitReached' })),
    );
  });

  it('shows a saved reflection with its footer and help link', () => {
    renderCard({ entry: dream({ dreamReflection: reflection() }) });

    expect(screen.getByText('Exploring')).toBeInTheDocument();
    expect(screen.getByText('Maybe a sense of openness.')).toBeInTheDocument();
    expect(screen.getByText('Where in your life are you exploring?')).toBeInTheDocument();
    expect(screen.getByText(/dream.reflection.footer/)).toBeInTheDocument();

    const listener = vi.fn();
    window.addEventListener('open-help', listener);
    fireEvent.click(screen.getByRole('button', { name: 'dream.reflection.howThisWorks' }));
    window.removeEventListener('open-help', listener);
    expect(listener.mock.calls[0][0].detail).toEqual({ tab: 'features', accordion: 'dream-method' });
  });

  it('shows first what the dreamer\'s thoughts changed, only for a reflection made with them', () => {
    const { unmount } = renderCard({ entry: dream({ dreamReflection: reflection({ fromThoughts: 'Your "no" sets the sea aside.' }) }) });

    const section = screen.getByText('dream.reflection.fromThoughts');
    expect(screen.getByText('Your "no" sets the sea aside.')).toBeInTheDocument();
    expect(section.compareDocumentPosition(screen.getByText('dream.reflection.summary')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    renderCard({ entry: dream({ dreamReflection: reflection() }) });
    expect(screen.queryByText('dream.reflection.fromThoughts')).not.toBeInTheDocument();
  });

  it('keeps the footer visible when the reflection is folded away', () => {
    renderCard({ entry: dream({ dreamReflection: reflection() }) });

    fireEvent.click(screen.getByRole('button', { name: 'dream.reflection.hide' }));

    expect(screen.queryByText('Exploring')).not.toBeInTheDocument();
    expect(screen.getByText(/dream.reflection.footer/)).toBeInTheDocument();
  });

  it('offers Reflect again only after the dream text changed', () => {
    const { unmount } = render(
      <DreamReflection entry={dream({ dreamReflection: reflection() })} allEntries={[]} isPro onSaveReflection={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /dream.reflection.reflectAgain/ })).toBeDisabled();
    unmount();

    render(
      <DreamReflection
        entry={dream({ body: `${DREAM_TEXT} Then the tide came in.`, dreamReflection: reflection() })}
        allEntries={[]}
        isPro
        onSaveReflection={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /dream.reflection.reflectAgain/ })).toBeEnabled();
  });

  it('offers Reflect again after an edit that keeps the same length', () => {
    renderCard({ entry: dream({ body: DREAM_TEXT.replace('house', 'hotel'), dreamReflection: reflection() }) });

    expect(screen.getByRole('button', { name: /dream.reflection.reflectAgain/ })).toBeEnabled();
  });

  it('offers Reflect again when only the feelings or flags changed', () => {
    renderCard({ entry: dream({ dream: { feelings: ['curiosity', 'fear'] }, dreamReflection: reflection() }) });
    expect(screen.getByRole('button', { name: /dream.reflection.reflectAgain/ })).toBeEnabled();
  });

  it('offers Reflect again when the dream was marked as a nightmare', () => {
    renderCard({ entry: dream({ dream: { feelings: ['curiosity'], nightmare: true }, dreamReflection: reflection() }) });
    expect(screen.getByRole('button', { name: /dream.reflection.reflectAgain/ })).toBeEnabled();
  });

  it('still shows a running reflection after the card was removed and shown again, and sends nothing twice', async () => {
    setDreamConsent();
    let answer!: (value: unknown) => void;
    mocks.requestDreamReflection.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const first = renderCard();
    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));
    await waitFor(() => expect(mocks.requestDreamReflection).toHaveBeenCalledOnce());
    // Edit mode, another view or a filter unmounts the card mid-request.
    first.unmount();

    renderCard();
    const button = screen.getByRole('button', { name: /dream.reflection.reflecting/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.requestDreamReflection).toHaveBeenCalledOnce();

    await act(async () => answer({ reflection: reflection(), used: 1 }));
    await waitFor(() => expect(screen.getByRole('button', { name: /dream.reflection.reflect/ })).toBeEnabled());
  });

  it('keeps an unsaved reflection with Retry after the card was removed and shown again', async () => {
    setDreamConsent();
    mocks.requestDreamReflection.mockResolvedValue({ reflection: reflection(), used: 1 });
    const first = renderCard({ onSaveReflection: vi.fn().mockRejectedValue(new Error('disk full')) });
    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));
    await screen.findByRole('alert');
    first.unmount();

    renderCard();

    expect(screen.getByRole('alert')).toHaveTextContent('dream.reflection.errors.saveFailed');
    expect(screen.getByText('You walked through an unfamiliar house with sea views.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
  });

  it.each([
    ['nobody is signed in', null],
    ['another account has signed in', 'user-b'],
  ])('drops a reflection that arrives when %s', async (_name, nextUser) => {
    setCurrentUserId('user-a');
    setDreamConsent();
    let answer!: (value: { reflection: DreamReflectionData; used: number }) => void;
    mocks.requestDreamReflection.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const first = renderCard();
    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));

    // Sign-out: the card goes, the user changes, the request is still running.
    first.unmount();
    setCurrentUserId(nextUser);
    resetDreamReflectionRequests();
    await act(async () => answer({ reflection: reflection(), used: 7 }));

    // Neither saved nor counted for the account that is on screen now.
    expect(first.onSaveReflection).not.toHaveBeenCalled();
    const { aiUsageLimits } = await import('@/services/aiUsageLimits');
    expect(aiUsageLimits.getUsageStats().dreamReflection.current).toBe(0);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  describe('your thoughts', () => {
    // Like the page: saved thoughts come back into the entry prop.
    function WithThoughts({ onSaveThoughts, ...rest }: React.ComponentProps<typeof DreamReflection>) {
      const [current, setCurrent] = useState(rest.entry);
      return (
        <DreamReflection
          {...rest}
          entry={current}
          onSaveThoughts={async (value) => {
            await onSaveThoughts!(value);
            setCurrent((e) => ({ ...e, dream: { ...e.dream!, ...(value ? { thoughts: value } : { thoughts: undefined }) } }));
          }}
        />
      );
    }
    const renderWithThoughts = (props: Partial<React.ComponentProps<typeof DreamReflection>> = {}) => {
      const onSaveThoughts = vi.fn().mockResolvedValue(undefined);
      render(
        <WithThoughts
          entry={dream({ dreamReflection: reflection() })}
          allEntries={[]}
          isPro
          onSaveReflection={vi.fn()}
          onSaveThoughts={onSaveThoughts}
          {...props}
        />,
      );
      return { onSaveThoughts };
    };
    const field = () => screen.getByLabelText('dream.reflection.thoughts.label') as HTMLTextAreaElement;
    const save = () => screen.getByRole('button', { name: 'common.save' });
    // One in the header, one beside Save.
    const reflectAgainButtons = () => screen.queryAllByRole('button', { name: /dream.reflection.reflectAgain/ });
    const reflectBesideSave = () => reflectAgainButtons()[1];

    it('saves what the dreamer writes under a reflection, which makes Reflect again available', async () => {
      const { onSaveThoughts } = renderWithThoughts();
      expect(save()).toBeDisabled();
      expect(reflectAgainButtons()).toHaveLength(2);
      reflectAgainButtons().forEach((button) => expect(button).toBeDisabled());

      fireEvent.change(field(), { target: { value: '  The house is my grandmother\'s.  ' } });
      fireEvent.click(save());

      await waitFor(() => expect(onSaveThoughts).toHaveBeenCalledWith('The house is my grandmother\'s.'));
      await waitFor(() => reflectAgainButtons().forEach((button) => expect(button).toBeEnabled()));
      expect(save()).toBeDisabled();
      expect(screen.getByText('dream.reflection.thoughts.hint')).toBeInTheDocument();
      expect(field()).toHaveAttribute('aria-describedby', 'dream-thoughts-hint-dream-1');
    });

    it('saves the thoughts on screen and reflects on them with the button beside Save', async () => {
      setDreamConsent();
      mocks.requestDreamReflection.mockResolvedValue({ reflection: reflection({ fromThoughts: 'Your answer points to family.' }), used: 2 });
      const onSaveReflection = vi.fn().mockResolvedValue(undefined);
      const { onSaveThoughts } = renderWithThoughts({ onSaveReflection });

      fireEvent.change(field(), { target: { value: ' 1. My grandmother\'s house ' } });
      // Available before saving: it saves first.
      expect(reflectBesideSave()).toBeEnabled();
      fireEvent.click(reflectBesideSave());

      await waitFor(() => expect(mocks.requestDreamReflection).toHaveBeenCalledOnce());
      expect(onSaveThoughts).toHaveBeenCalledWith('1. My grandmother\'s house');
      // Made from the thoughts just saved, not from the entry as it was.
      expect(mocks.requestDreamReflection.mock.calls[0][0].dream.thoughts).toBe('1. My grandmother\'s house');
      expect(onSaveThoughts.mock.invocationCallOrder[0]).toBeLessThan(mocks.requestDreamReflection.mock.invocationCallOrder[0]);
      await waitFor(() =>
        expect(onSaveReflection).toHaveBeenCalledWith(expect.objectContaining({ fromThoughts: 'Your answer points to family.' })),
      );
    });

    it('shows saved thoughts and lets them be removed', async () => {
      const { onSaveThoughts } = renderWithThoughts({
        entry: dream({ dream: { feelings: ['curiosity'], thoughts: 'Earlier thoughts' }, dreamReflection: reflection() }),
      });
      expect(field().value).toBe('Earlier thoughts');

      fireEvent.change(field(), { target: { value: '' } });
      fireEvent.click(save());

      await waitFor(() => expect(onSaveThoughts).toHaveBeenCalledWith(''));
    });

    it('caps the field at the length the server accepts', () => {
      renderWithThoughts();
      expect(field().maxLength).toBe(2000);
    });

    it('has no thoughts field before there is a reflection, or where thoughts cannot be saved', () => {
      const first = render(
        <DreamReflection entry={dream()} allEntries={[]} isPro onSaveReflection={vi.fn()} onSaveThoughts={vi.fn()} />,
      );
      expect(screen.queryByLabelText('dream.reflection.thoughts.label')).not.toBeInTheDocument();
      first.unmount();

      renderCard({ entry: dream({ dreamReflection: reflection() }) });
      expect(screen.queryByLabelText('dream.reflection.thoughts.label')).not.toBeInTheDocument();
    });

    it('lets a former Plus user keep writing thoughts, without promising Reflect again', () => {
      renderWithThoughts({ isPro: false });

      expect(field()).toBeInTheDocument();
      expect(save()).toBeInTheDocument();
      expect(reflectAgainButtons()).toHaveLength(0);
      expect(screen.queryByText('dream.reflection.thoughts.hint')).not.toBeInTheDocument();
    });
  });

  it('says the AI service would not respond to this dream when the content was refused', async () => {
    setDreamConsent();
    mocks.requestDreamReflection.mockRejectedValue(new DreamRequestError('blocked'));
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'dream.reflection.errors.blocked' })),
    );
  });

  it('keeps an unsaved reflection on screen and lets the user retry the save', async () => {
    setDreamConsent();
    mocks.requestDreamReflection.mockResolvedValue({ reflection: reflection(), used: 1 });
    const onSaveReflection = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    renderCard({ onSaveReflection });

    fireEvent.click(screen.getByRole('button', { name: /dream.reflection.reflect/ }));

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('dream.reflection.errors.saveFailed');
    expect(screen.getByText('You walked through an unfamiliar house with sea views.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(onSaveReflection).toHaveBeenCalledTimes(2);
    // The retry saves the reflection already paid for; it never asks the AI again.
    expect(mocks.requestDreamReflection).toHaveBeenCalledOnce();
  });

  it('asks the server for the current count when the card is shown, so use on another device shows', async () => {
    const { aiUsageLimits } = await import('@/services/aiUsageLimits');
    const sync = vi.spyOn(aiUsageLimits, 'syncIfStale');
    renderCard();
    expect(sync).toHaveBeenCalled();
    sync.mockRestore();
  });

  it('updates the remaining count on every dream card when one of them is used', async () => {
    setDreamConsent();
    mocks.requestDreamReflection.mockResolvedValue({ reflection: reflection(), used: 7 });
    render(
      <>
        <Harness entry={dream()} allEntries={[]} isPro onSaveReflection={vi.fn().mockResolvedValue(undefined)} />
        <div data-testid="other">
          <DreamReflection entry={dream({ id: 'dream-2' })} allEntries={[]} isPro onSaveReflection={vi.fn()} />
        </div>
      </>,
    );

    expect(screen.getAllByText('dream.reflection.remaining:30/30')).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: /dream.reflection.reflect/ })[0]);
    await screen.findByText('You walked through an unfamiliar house with sea views.');

    // The other, untouched card shows the new count too.
    expect(within(screen.getByTestId('other')).getByText('dream.reflection.remaining:23/30')).toBeInTheDocument();
  });

  it('shows the fixed supportive text when the reflection flags distress', () => {
    renderCard({ entry: dream({ dreamReflection: reflection({ care: 'distress' }) }) });

    expect(screen.getByText('dream.reflection.care.title')).toBeInTheDocument();
    expect(screen.getByText('dream.reflection.care.urgent')).toBeInTheDocument();
  });

  it('keeps a reflection from a Plus period readable but without Reflect again', () => {
    renderCard({ isPro: false, entry: dream({ dreamReflection: reflection() }) });

    expect(screen.getByText('Exploring')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dream.reflection.reflectAgain/ })).not.toBeInTheDocument();
  });
});
