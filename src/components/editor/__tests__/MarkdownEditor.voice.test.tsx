import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../VoiceInputButton', () => ({
  VoiceInputButton: ({ onTranscript }: { onTranscript: (text: string) => void }) => (
    <button type="button" onClick={() => onTranscript('dictated text')}>
      fake-dictate
    </button>
  ),
}));

import { MarkdownEditor } from '../MarkdownEditor';

function ControlledEditor({ initial, voice = true }: { initial: string; voice?: boolean }) {
  const [value, setValue] = useState(initial);
  return <MarkdownEditor value={value} onChange={setValue} voiceInput={voice ? { isPro: true } : undefined} />;
}

describe('MarkdownEditor voice input', () => {
  it('appends dictation to the end before the user has placed a caret', () => {
    render(<ControlledEditor initial="Started the day early." />);

    fireEvent.click(screen.getByText('fake-dictate'));

    expect(screen.getByRole('textbox')).toHaveValue('Started the day early. dictated text');
  });

  it('inserts dictation at the caret', () => {
    render(<ControlledEditor initial="Before after" />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    textarea.setSelectionRange(6, 6);
    fireEvent.select(textarea);
    fireEvent.click(screen.getByText('fake-dictate'));

    expect(textarea).toHaveValue('Before dictated text after');
  });

  it('hides the control when voice input is not enabled', () => {
    render(<ControlledEditor initial="" voice={false} />);

    expect(screen.queryByText('fake-dictate')).not.toBeInTheDocument();
  });
});
