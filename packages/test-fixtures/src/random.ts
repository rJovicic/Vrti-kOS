/** Deterministic PRNG (mulberry32) so the synthetic world is identical on every machine and in CI. */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const uuid = (): string => {
    const hex = Array.from({ length: 32 }, () => Math.floor(next() * 16).toString(16)).join('');
    // RFC 4122 v4 layout (version 4, variant 10xx); values are synthetic, not random-secure.
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[Math.floor(next() * 4)]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  };
  return { next, pick, uuid };
}
