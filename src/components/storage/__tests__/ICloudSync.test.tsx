import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ICloudSync } from '../ICloudSync';

describe('ICloudSync', () => {
  const mockOnConfigChange = vi.fn();
  const mockOnRequirePassword = vi.fn();
  const mockMasterKey = {} as CryptoKey;

  it('should render successfully', () => {
    const { container } = render(
      <ICloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should show coming soon message', () => {
    const { container } = render(
      <ICloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container.textContent).toContain('Coming Soon');
  });

  it('should mention iCloud Storage in title', () => {
    const { container } = render(
      <ICloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container.textContent).toContain('iCloud Storage');
  });

  it('should suggest alternative providers', () => {
    const { container } = render(
      <ICloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container.textContent).toContain('Nextcloud');
    expect(container.textContent).toContain('Google Drive');
    expect(container.textContent).toContain('Dropbox');
  });

  it('should render with null master key', () => {
    const { container } = render(
      <ICloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render without optional callbacks', () => {
    const { container } = render(
      <ICloudSync masterKey={mockMasterKey} />
    );
    expect(container).toBeInTheDocument();
  });
});
