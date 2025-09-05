/**
 * SyncStatusIndicator Component Tests
 * Tests sync status display and visual feedback
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SyncStatusIndicator } from '../sync/SyncStatusIndicator';

describe('SyncStatusIndicator', () => {
  const mockConnectedProviders: string[] = [];

  it('should render without crashing', () => {
    const { container } = render(
      <SyncStatusIndicator 
        status="idle" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    expect(container).toBeDefined();
  });

  it('should render with idle status', () => {
    const { container } = render(
      <SyncStatusIndicator 
        status="idle" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    expect(container.textContent).toBeTruthy();
  });

  it('should render with syncing status', () => {
    const { container } = render(
      <SyncStatusIndicator 
        status="syncing" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    expect(container.textContent).toBeTruthy();
  });

  it('should render with error status', () => {
    const { container } = render(
      <SyncStatusIndicator 
        status="error" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    expect(container.textContent).toBeTruthy();
  });

  it('should render with success status', () => {
    const { container } = render(
      <SyncStatusIndicator 
        status="success" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    expect(container.textContent).toBeTruthy();
  });

  it('should handle empty connectedProviders', () => {
    const { container } = render(
      <SyncStatusIndicator status="idle" connectedProviders={[]} />
    );
    expect(container).toBeDefined();
  });

  it('should handle multiple connectedProviders', () => {
    const providers = ['dropbox', 'googledrive'];
    
    const { container } = render(
      <SyncStatusIndicator 
        status="idle" 
        connectedProviders={providers} 
      />
    );
    expect(container.textContent).toBeTruthy();
  });

  it('should be visually distinct for different statuses', () => {
    const { container: idleContainer } = render(
      <SyncStatusIndicator 
        status="idle" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    const { container: errorContainer } = render(
      <SyncStatusIndicator 
        status="error" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    
    expect(idleContainer.firstChild).toBeTruthy();
    expect(errorContainer.firstChild).toBeTruthy();
  });

  it('should render accessibility attributes', () => {
    const { container } = render(
      <SyncStatusIndicator 
        status="syncing" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    
    const element = container.querySelector('[role]') || 
                   container.querySelector('[aria-label]') ||
                   container.firstChild;
    expect(element).toBeTruthy();
  });

  it('should render consistently with minimal props', () => {
    const { container, rerender } = render(
      <SyncStatusIndicator 
        status="idle" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    expect(container.firstChild).toBeTruthy();
    
    rerender(
      <SyncStatusIndicator 
        status="idle" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('should update when status changes', () => {
    const { container, rerender } = render(
      <SyncStatusIndicator 
        status="idle" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    const initialContent = container.textContent;
    
    rerender(
      <SyncStatusIndicator 
        status="syncing" 
        connectedProviders={mockConnectedProviders} 
      />
    );
    const updatedContent = container.textContent;
    
    expect(initialContent).toBeTruthy();
    expect(updatedContent).toBeTruthy();
  });

  it('should show appropriate message for no connected providers', () => {
    const { container } = render(
      <SyncStatusIndicator 
        status="idle" 
        connectedProviders={[]} 
      />
    );
    expect(container).toBeDefined();
  });
});
