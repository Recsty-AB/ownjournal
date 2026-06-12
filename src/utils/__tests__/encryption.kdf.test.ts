/**
 * Real-crypto tests for the cloud crypto v2 key-wrapping rollout.
 *
 * Unlike the other encryption test files (which run against the static
 * crypto.subtle mock in test/setup.ts), these install Node's real WebCrypto so
 * the actual round-trips are exercised end-to-end.
 *
 * Covers both sides of the FEATURES.CLOUD_CRYPTO_V2_WRITE gate:
 *  - default writes stay PBKDF2 and remain readable by the LEGACY decrypt path
 *    (what a not-yet-updated client runs) — the deployability guarantee;
 *  - Argon2id wrapping (the v2 format) round-trips, ready for activation.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  generateMasterKey,
  encryptMasterKey,
  decryptMasterKey,
  encryptData,
  decryptData,
  generateSalt,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../encryption';
import { FEATURES } from '@/config/features';

const realCrypto = webcrypto as unknown as Crypto;

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: realCrypto,
    configurable: true,
    writable: true,
  });
});

/**
 * Decrypt a wrapped master key exactly the way a PRE-v2 build does:
 * PBKDF2-SHA256/100k, no knowledge of any kdf field. If this succeeds, an
 * old client can read the file.
 */
async function legacyClientDecrypt(
  encryptedKey: string,
  salt: string,
  iv: string,
  password: string
): Promise<CryptoKey> {
  const passwordKey = await realCrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const wrapKey = await realCrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(base64ToArrayBuffer(salt)),
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const decrypted = await realCrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(base64ToArrayBuffer(iv)) },
    wrapKey,
    base64ToArrayBuffer(encryptedKey)
  );
  return realCrypto.subtle.importKey('raw', decrypted, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

describe('Cloud crypto v2 rollout gate', () => {
  it('v2 writes are disabled in this release', () => {
    // Deployability guarantee: shared cloud artifacts keep their current
    // format until read support has saturated all platforms. Flipping this
    // flag must be a deliberate release decision — see features.ts.
    expect(FEATURES.CLOUD_CRYPTO_V2_WRITE).toBe(false);
  });

  it('default wrap is PBKDF2 and a LEGACY (pre-v2) client can decrypt it', async () => {
    const password = 'existing-user-password';
    const masterKey = await generateMasterKey();

    const wrapped = await encryptMasterKey(masterKey, password); // flag-driven default

    expect(wrapped.kdf).toBe('pbkdf2');

    // Simulate an old build reading this file with hardcoded PBKDF2-100k.
    const recoveredByOldClient = await legacyClientDecrypt(
      wrapped.encryptedKey,
      wrapped.salt,
      wrapped.iv,
      password
    );

    const { encrypted, iv } = await encryptData('entry body', masterKey);
    const out = await decryptData(encrypted, recoveredByOldClient, iv);
    expect(out).toBe('entry body');
  }, 20000);

  it('default wrap also round-trips through the new decrypt path (with and without spec)', async () => {
    const password = 'a-strong-password';
    const masterKey = await generateMasterKey();
    const wrapped = await encryptMasterKey(masterKey, password);

    for (const spec of [undefined, { kdf: wrapped.kdf, kdfParams: wrapped.kdfParams }]) {
      const recovered = await decryptMasterKey(
        wrapped.encryptedKey,
        wrapped.salt,
        wrapped.iv,
        password,
        spec
      );
      const { encrypted, iv } = await encryptData('secret journal body', masterKey);
      expect(await decryptData(encrypted, recovered, iv)).toBe('secret journal body');
    }
  }, 20000);
});

describe('Argon2id key wrapping (v2 format, read-ready)', () => {
  it('wraps with Argon2id and records the KDF descriptor', async () => {
    const masterKey = await generateMasterKey();
    const wrapped = await encryptMasterKey(masterKey, 'correct horse battery staple', 'argon2id');

    expect(wrapped.kdf).toBe('argon2id');
    expect(wrapped.kdfParams).toMatchObject({
      iterations: expect.any(Number),
      memorySize: expect.any(Number),
      parallelism: expect.any(Number),
    });
  }, 20000);

  it('round-trips: the unwrapped key is the same master key', async () => {
    const password = 'a-strong-password';
    const masterKey = await generateMasterKey();
    const wrapped = await encryptMasterKey(masterKey, password, 'argon2id');

    const recovered = await decryptMasterKey(
      wrapped.encryptedKey,
      wrapped.salt,
      wrapped.iv,
      password,
      { kdf: wrapped.kdf, kdfParams: wrapped.kdfParams }
    );

    const { encrypted, iv } = await encryptData('secret journal body', masterKey);
    const out = await decryptData(encrypted, recovered, iv);
    expect(out).toBe('secret journal body');
  }, 20000);

  it('rejects the wrong password', async () => {
    const masterKey = await generateMasterKey();
    const wrapped = await encryptMasterKey(masterKey, 'right-password', 'argon2id');

    await expect(
      decryptMasterKey(wrapped.encryptedKey, wrapped.salt, wrapped.iv, 'wrong-password', {
        kdf: wrapped.kdf,
        kdfParams: wrapped.kdfParams,
      })
    ).rejects.toBeTruthy();
  }, 20000);

  it('still decrypts a legacy PBKDF2 key file (no kdf field)', async () => {
    // Build a legacy-format wrapped key the old code would have produced:
    // wrap key = PBKDF2-SHA256(password, salt, 100000).
    const password = 'legacy-password';
    const masterKey = await generateMasterKey();
    const salt = generateSalt();

    const passwordKey = await realCrypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const legacyWrapKey = await realCrypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const rawMaster = await realCrypto.subtle.exportKey('raw', masterKey);
    const iv = realCrypto.getRandomValues(new Uint8Array(12));
    const encryptedKey = await realCrypto.subtle.encrypt({ name: 'AES-GCM', iv }, legacyWrapKey, rawMaster);

    // Decrypt with NO kdf spec — this is how every existing call site reads an
    // old file. It must default to PBKDF2 and succeed.
    const recovered = await decryptMasterKey(
      arrayBufferToBase64(encryptedKey),
      arrayBufferToBase64(salt.buffer),
      arrayBufferToBase64(iv.buffer),
      password
    );

    const { encrypted, iv: dataIv } = await encryptData('legacy entry', masterKey);
    const out = await decryptData(encrypted, recovered, dataIv);
    expect(out).toBe('legacy entry');
  }, 20000);
});
