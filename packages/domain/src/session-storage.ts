/**
 * Splits values across several entries of a small key-value store (the OS keychain/keystore via
 * expo-secure-store) whose per-value size is limited. UI-free so it is unit-tested here; the mobile app
 * supplies the SecureStore backend (SR-SESS-01, SR-MOB-01).
 *
 * Layout for key K: `K` holds the manifest `chunks:<n>`, `K.0` … `K.<n-1>` hold the parts.
 */
export interface KeyValueBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface ChunkedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const MANIFEST = /^chunks:(\d{1,3})$/;
const encoder = new TextEncoder();

/** Splits on code-point boundaries so no part exceeds `maxBytes` of UTF-8. */
export function splitUtf8(value: string, maxBytes: number): string[] {
  if (maxBytes < 4) throw new Error('maxBytes too small');
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of value) {
    const n = encoder.encode(ch).length;
    if (size + n > maxBytes) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  if (current !== '' || parts.length === 0) parts.push(current);
  return parts;
}

export function createChunkedStorage(backend: KeyValueBackend, maxBytes = 1800): ChunkedStorage {
  const count = async (key: string): Promise<number> => {
    const m = MANIFEST.exec((await backend.get(key)) ?? '');
    return m ? Number(m[1]) : 0;
  };
  const removeParts = async (key: string, from: number, to: number) => {
    for (let i = from; i < to; i++) await backend.delete(`${key}.${i}`);
  };
  return {
    async getItem(key) {
      const n = await count(key);
      if (n === 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await backend.get(`${key}.${i}`);
        if (part === null) return null; // torn write: treat as signed out rather than use a corrupt session
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key, value) {
      const previous = await count(key);
      const parts = splitUtf8(value, maxBytes);
      for (let i = 0; i < parts.length; i++) await backend.set(`${key}.${i}`, parts[i]!);
      await backend.set(key, `chunks:${parts.length}`);
      await removeParts(key, parts.length, previous);
    },
    async removeItem(key) {
      const n = await count(key);
      await backend.delete(key);
      await removeParts(key, 0, n);
    },
  };
}
