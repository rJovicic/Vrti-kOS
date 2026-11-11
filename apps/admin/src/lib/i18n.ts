import { hr } from '@vrticos/i18n';

type Leaf = string;
/** Minimal server-side translator over the shared Croatian catalog (no client bundle needed for D0). */
export function t(path: string, vars: Record<string, string | number> = {}): string {
  const value = path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], hr);
  if (typeof value !== 'string') return path;
  return (value as Leaf).replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''));
}
