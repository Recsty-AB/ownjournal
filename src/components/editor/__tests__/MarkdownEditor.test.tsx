import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownEditor } from '../MarkdownEditor';

describe('MarkdownEditor', () => {
  it('should render successfully', () => {
    const { container } = render(
      <MarkdownEditor
        value="Test content"
        onChange={() => {}}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  it('should render with empty value', () => {
    const { container } = render(
      <MarkdownEditor
        value=""
        onChange={() => {}}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  it('should accept placeholder prop', () => {
    const { container } = render(
      <MarkdownEditor
        value=""
        onChange={() => {}}
        placeholder="Custom placeholder"
      />
    );
    
    expect(container).toBeInTheDocument();
  });
});
