import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../use-mobile';

describe('useIsMobile', () => {
  let listeners: Array<(event: MediaQueryListEvent) => void> = [];
  let mockMQL: Partial<MediaQueryList>;

  beforeEach(() => {
    listeners = [];
    
    mockMQL = {
      matches: false,
      addEventListener: vi.fn((event, listener) => {
        if (event === 'change') {
          listeners.push(listener as (event: MediaQueryListEvent) => void);
        }
      }),
      removeEventListener: vi.fn((event, listener) => {
        if (event === 'change') {
          const index = listeners.indexOf(listener as (event: MediaQueryListEvent) => void);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      }),
    };

    window.matchMedia = vi.fn(() => mockMQL as MediaQueryList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with undefined', () => {
    const { result } = renderHook(() => useIsMobile());
    
    // Initially undefined, then set based on window width
    expect(typeof result.current).toBe('boolean');
  });

  it('should detect mobile viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    const { result } = renderHook(() => useIsMobile());
    
    expect(result.current).toBe(true);
  });

  it('should detect desktop viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());
    
    expect(result.current).toBe(false);
  });

  it('should update when viewport changes', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());
    
    expect(result.current).toBe(false);

    // Simulate viewport resize
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      
      // Trigger change listeners
      listeners.forEach(listener => {
        listener({} as MediaQueryListEvent);
      });
    });

    expect(result.current).toBe(true);
  });

  it('should use 768px as breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 767,
    });

    const { result: resultMobile } = renderHook(() => useIsMobile());
    
    expect(resultMobile.current).toBe(true);

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    const { result: resultDesktop } = renderHook(() => useIsMobile());
    
    expect(resultDesktop.current).toBe(false);
  });

  it('should cleanup event listeners on unmount', () => {
    const { unmount } = renderHook(() => useIsMobile());
    
    expect(listeners.length).toBeGreaterThan(0);
    
    unmount();
    
    expect(mockMQL.removeEventListener).toHaveBeenCalled();
  });

  it('should handle multiple viewport changes', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());
    
    expect(result.current).toBe(false);

    // First change to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      listeners.forEach(listener => listener({} as MediaQueryListEvent));
    });

    expect(result.current).toBe(true);

    // Change back to desktop
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      listeners.forEach(listener => listener({} as MediaQueryListEvent));
    });

    expect(result.current).toBe(false);
  });

  it('should always return boolean', () => {
    const { result } = renderHook(() => useIsMobile());
    
    expect(typeof result.current).toBe('boolean');
  });
});
