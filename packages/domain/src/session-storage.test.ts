import { describe, expect, it } from 'vitest';
import { createChunkedStorage, splitUtf8, type KeyValueBackend } from './session-storage.ts';

function memory(limit: number): KeyValueBackend & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => {
      if (new TextEncoder().encode(v).length > limit) throw new Error('value too large');
      map.set(k, v);
    },
    delete: async (k) => void map.delete(k),
  };
}

describe('chunked session storage', () => {
  it('stores values larger than the backend limit and reads them back', async () => {
    const backend = memory(100);
    const store = createChunkedStorage(backend, 100);
    const session = JSON.stringify({ access_token: 'a'.repeat(950), user: { name: 'Šime Đurić' } });
    await store.setItem('sb-auth', session);
    expect(await store.getItem('sb-auth')).toBe(session);
    expect(backend.map.get('sb-auth')).toMatch(/^chunks:\d+$/);
  });
  it('removes stale parts when a value shrinks, and everything on removeItem', async () => {
    const backend = memory(50);
    const store = createChunkedStorage(backend, 50);
    await store.setItem('k', 'x'.repeat(400));
    await store.setItem('k', 'short');
    expect([...backend.map.keys()].sort()).toEqual(['k', 'k.0']);
    await store.removeItem('k');
    expect(backend.map.size).toBe(0);
    expect(await store.getItem('k')).toBeNull();
  });
  it('treats a missing part as no session', async () => {
    const backend = memory(20);
    const store = createChunkedStorage(backend, 20);
    await store.setItem('k', 'y'.repeat(60));
    backend.map.delete('k.1');
    expect(await store.getItem('k')).toBeNull();
  });
  it('never splits a multi-byte character', () => {
    const parts = splitUtf8('ččččč', 5);
    expect(parts.join('')).toBe('ččččč');
    expect(parts.every((p) => new TextEncoder().encode(p).length <= 5)).toBe(true);
  });
});
