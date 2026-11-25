// Spec of the hosted Supabase project (supabase/hosted/<env>.json). Pure: no I/O except loadSpec.
import { readFileSync } from 'node:fs';

export const CLASSES = ['security', 'functional', 'informational', 'decision', 'unsupported'] as const;
export type SettingClass = (typeof CLASSES)[number];
export type ApplyMode = 'safe' | 'manual' | 'none';

export type Source =
  | { kind: 'field'; path: string; field: string }
  | { kind: 'legacy-keys' }
  | { kind: 'signing-keys' }
  | { kind: 'functions' }
  | { kind: 'secrets-absent'; names: string[] }
  | { kind: 'sql'; query: string }
  | { kind: 'pooler' }
  | { kind: 'public'; probe: string }
  | { kind: 'none' };

export interface Setting {
  id: string;
  class: SettingClass;
  source: Source;
  expected: unknown;
  apply: ApplyMode;
  decision: string;
  manual?: string;
}

export interface Spec {
  project: { ref: string; name: string; environment: string; region: string; apiUrl: string; adminUrl: string };
  settings: Setting[];
}

/** Only these Management API paths may ever be changed by `apply`, and only for settings marked `safe`. */
export const APPLY_PATHS = ['/config/auth', '/postgrest', '/config/realtime'] as const;

/** Field names that may carry secrets. They are never requested, compared or printed. */
export const SECRET_FIELD = /secret|password$|_pass$|_key$|auth_token$/i;

export function validateSpec(raw: unknown): Spec {
  const s = raw as Spec;
  const fail = (m: string): never => {
    throw new Error(`invalid spec: ${m}`);
  };
  if (!s || typeof s !== 'object' || !s.project || !Array.isArray(s.settings)) fail('missing project or settings');
  const p = s.project;
  if (!/^[a-z]{20}$/.test(p.ref ?? '')) fail('project.ref must be a 20-letter project ref');
  if (p.environment !== 'staging') fail('only staging specs exist; production is not managed by this tool');
  if (p.apiUrl !== `https://${p.ref}.supabase.co`) fail('project.apiUrl must belong to project.ref');
  const ids = new Set<string>();
  for (const x of s.settings) {
    if (!x.id || ids.has(x.id)) fail(`duplicate or empty id ${x.id}`);
    ids.add(x.id);
    if (!(CLASSES as readonly string[]).includes(x.class)) fail(`${x.id}: unknown class ${x.class}`);
    if (!['safe', 'manual', 'none'].includes(x.apply)) fail(`${x.id}: unknown apply mode`);
    if (!x.decision) fail(`${x.id}: every setting must name its decision source`);
    if (x.source.kind === 'field' && SECRET_FIELD.test(x.source.field)) fail(`${x.id}: secret fields are never managed`);
    if (x.apply === 'safe') {
      if (x.source.kind !== 'field' || !(APPLY_PATHS as readonly string[]).includes(x.source.path) || x.source.field.includes('.')) {
        fail(`${x.id}: only top-level fields of ${APPLY_PATHS.join(', ')} can be applied automatically`);
      }
      if (x.class !== 'security' && x.class !== 'functional') fail(`${x.id}: only decided settings can be applied`);
    }
    if ((x.apply === 'manual' || x.class === 'unsupported') && !x.manual && x.source.kind === 'none') fail(`${x.id}: manual procedure missing`);
  }
  return s;
}

export function loadSpec(path: string): Spec {
  return validateSpec(JSON.parse(readFileSync(path, 'utf8')));
}
