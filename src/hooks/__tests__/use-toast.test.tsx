import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, toast } from '../use-toast';

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with empty toasts', () => {
    const { result } = renderHook(() => useToast());
    
    expect(result.current.toasts).toEqual([]);
  });

  it('should add a toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({
        title: 'Test Toast',
        description: 'Test description',
      });
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Test Toast');
    expect(result.current.toasts[0].description).toBe('Test description');
  });

  it('should limit toasts to TOAST_LIMIT', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({ title: 'Toast 1' });
      result.current.toast({ title: 'Toast 2' });
      result.current.toast({ title: 'Toast 3' });
    });
    
    // TOAST_LIMIT is 1 in the implementation
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Toast 3');
  });

  it('should dismiss a specific toast', () => {
    const { result } = renderHook(() => useToast());
    
    let toastId: string;
    
    act(() => {
      const toastResult = result.current.toast({ title: 'Test' });
      toastId = toastResult.id;
    });
    
    act(() => {
      result.current.dismiss(toastId);
    });
    
    expect(result.current.toasts[0].open).toBe(false);
  });

  it('should dismiss all toasts', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({ title: 'Toast 1' });
    });
    
    act(() => {
      result.current.dismiss();
    });
    
    expect(result.current.toasts[0].open).toBe(false);
  });

  it('should update a toast', () => {
    const { result } = renderHook(() => useToast());
    
    let toastController: ReturnType<typeof result.current.toast>;
    
    act(() => {
      toastController = result.current.toast({ title: 'Original' });
    });
    
    act(() => {
      toastController.update({
        id: toastController.id,
        title: 'Updated',
      });
    });
    
    expect(result.current.toasts[0].title).toBe('Updated');
  });

  it('should auto-dismiss toast after delay', () => {
    const { result } = renderHook(() => useToast());
    
    let toastId: string;
    
    act(() => {
      const toastResult = result.current.toast({ title: 'Test' });
      toastId = toastResult.id;
    });
    
    act(() => {
      result.current.dismiss(toastId);
    });
    
    expect(result.current.toasts[0].open).toBe(false);
    
    // Fast-forward time to trigger removal
    act(() => {
      vi.advanceTimersByTime(1000000);
    });
    
    expect(result.current.toasts).toHaveLength(0);
  });

  it('should handle toast with action', () => {
    const { result } = renderHook(() => useToast());
    
    // Create a mock action element
    const action = { type: 'button', props: { children: 'Undo' }, key: null } as unknown as React.ReactElement;
    
    act(() => {
      result.current.toast({
        title: 'Action Toast',
        action: action,
      });
    });
    
    expect(result.current.toasts[0].action).toEqual(action);
  });

  it('should handle toast with variant', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({
        title: 'Error',
        variant: 'destructive',
      });
    });
    
    expect(result.current.toasts[0].variant).toBe('destructive');
  });

  it('should call onOpenChange when dismissing', () => {
    const { result } = renderHook(() => useToast());
    
    let toastId: string;
    
    act(() => {
      const toastResult = result.current.toast({ title: 'Test' });
      toastId = toastResult.id;
    });
    
    const toast = result.current.toasts[0];
    
    act(() => {
      toast.onOpenChange?.(false);
    });
    
    expect(result.current.toasts[0].open).toBe(false);
  });

  it('should use standalone toast function', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      const t = toast({ title: 'Standalone Toast' });
      expect(t).toHaveProperty('id');
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Standalone Toast');
  });

  it('should generate unique IDs for toasts', () => {
    const { result } = renderHook(() => useToast());
    
    const ids = new Set();
    
    act(() => {
      const t1 = result.current.toast({ title: 'Toast 1' });
      ids.add(t1.id);
    });
    
    // Clear first toast
    act(() => {
      result.current.dismiss();
      vi.advanceTimersByTime(1000000);
    });
    
    act(() => {
      const t2 = result.current.toast({ title: 'Toast 2' });
      ids.add(t2.id);
    });
    
    expect(ids.size).toBe(2);
  });

  it('should handle rapid toast additions', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({ title: 'Toast 1' });
      result.current.toast({ title: 'Toast 2' });
      result.current.toast({ title: 'Toast 3' });
      result.current.toast({ title: 'Toast 4' });
    });
    
    // Only the latest toast should remain due to TOAST_LIMIT
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Toast 4');
  });
});
