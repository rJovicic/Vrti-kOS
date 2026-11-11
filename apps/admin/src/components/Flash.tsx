import { readFlash } from '@/lib/flash';

export function Flash({ params }: { params: Record<string, string | string[] | undefined> }) {
  const flash = readFlash(params);
  if (!flash) return null;
  return (
    <p className={`flash ${flash.kind}`} role={flash.kind === 'error' ? 'alert' : 'status'}>
      {flash.text}
    </p>
  );
}
