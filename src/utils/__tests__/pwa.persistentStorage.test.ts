import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestPersistentStorage } from '../pwa';

describe('requestPersistentStorage', () => {
  const original = navigator.storage;

  afterEach(() => {
    Object.defineProperty(navigator, 'storage', {
      value: original,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  const setStorage = (value: any) => {
    Object.defineProperty(navigator, 'storage', {
      value,
      configurable: true,
    });
  };

  it('returns false when the StorageManager API is unavailable', async () => {
    setStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('returns false when persist/persisted methods are missing', async () => {
    setStorage({});
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('short-circuits to true when storage is already persisted (idempotent)', async () => {
    const persist = vi.fn().mockResolvedValue(false);
    const persisted = vi.fn().mockResolvedValue(true);
    setStorage({ persist, persisted });

    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persisted).toHaveBeenCalledOnce();
    // Must NOT request again when already granted.
    expect(persist).not.toHaveBeenCalled();
  });

  it('requests persistence and returns the granted result when not yet persisted', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const persisted = vi.fn().mockResolvedValue(false);
    setStorage({ persist, persisted });

    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  it('returns the denied result when the browser refuses persistence', async () => {
    const persist = vi.fn().mockResolvedValue(false);
    const persisted = vi.fn().mockResolvedValue(false);
    setStorage({ persist, persisted });

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('never throws when the API rejects', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('boom'));
    const persisted = vi.fn().mockResolvedValue(false);
    setStorage({ persist, persisted });

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
