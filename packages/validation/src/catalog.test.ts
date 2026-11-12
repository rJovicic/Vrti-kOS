// D1-13: the error code catalog matches the implementation. Scans the repository sources, so a code used in the
// database, Edge Functions, admin or mobile app that is not catalogued — or a catalogued code without a message —
// fails the unit test suite (and CI).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hr } from '../../i18n/src/locales/hr.ts';
import { it as itLocale } from '../../i18n/src/locales/it.ts';
import {
  dbErrorCatalog,
  errorCatalog,
  errorCodes,
  exposedDbErrors,
  fromInvitationInsertError,
  fromPostgrestError,
  isErrorCode,
} from './errors.ts';

const root = join(import.meta.dirname, '..', '..', '..');

function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    if (name === 'node_modules' || name.startsWith('.') || name === 'dist') continue;
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) out.push(...files(rel, ext));
    else if (ext.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}
function matches(paths: string[], pattern: RegExp): { code: string; where: string }[] {
  return paths.flatMap((p) =>
    [...readFileSync(join(root, p), 'utf8').matchAll(pattern)].map((m) => ({ code: m[1]!, where: relative(root, join(root, p)) })),
  );
}
const unknown = (found: { code: string; where: string }[], known: (c: string) => boolean) =>
  found.filter((f) => !known(f.code)).map((f) => `${f.code} (${f.where})`);

describe('error code catalog (D1-13)', () => {
  it('every database exception name is catalogued with a public mapping', () => {
    const raised = matches(files('supabase/migrations', /\.sql$/), /raise exception '([A-Z][A-Z0-9_]+)'/g);
    expect(raised.length).toBeGreaterThan(10);
    expect(unknown(raised, (c) => Object.hasOwn(dbErrorCatalog, c))).toEqual([]);
  });

  it('every error code returned by an Edge Function is catalogued', () => {
    const fns = files('supabase/functions', /\.ts$/);
    const returned = matches(fns, /\berror\(\s*req,\s*'([A-Z_]+)'/g);
    expect(returned.map((r) => r.code)).toEqual(expect.arrayContaining(['METHOD_NOT_ALLOWED', 'AUTH_REQUIRED', 'VALIDATION_FAILED']));
    expect(unknown(returned, isErrorCode)).toEqual([]);
    // the old (status, code) signature with hand-written statuses is gone
    expect(matches(fns, /\berror\(\s*req,\s*(\d{3}),/g)).toEqual([]);
  });

  it('admin and mobile reference only catalogued codes and messages', () => {
    const app = [...files('apps/admin/src', /\.tsx?$/), ...files('apps/mobile/src', /\.tsx?$/)];
    const messageKeys = matches(app, /['`]errors\.([A-Z_]+)['`]/g);
    const failCodes = matches(app, /\bfail\([^)]*?'([A-Z][A-Z_]+)'/g);
    const queryCodes = matches(app, /[?&]e=([A-Z][A-Z_]+)/g);
    const stateCodes = matches(app, /\berror: '([A-Z][A-Z_]+)'/g);
    expect(messageKeys.length + failCodes.length + queryCodes.length).toBeGreaterThan(10);
    expect(unknown([...messageKeys, ...failCodes, ...queryCodes, ...stateCodes], isErrorCode)).toEqual([]);
    // no message for an error lives outside the errors.* namespace any more
    expect(matches(app, /t\('auth\.(codeInvalid|mfaInvalid)'/g)).toEqual([]);
  });

  it('every catalogued code has exactly one Croatian message, and nothing stale', () => {
    expect(Object.keys(hr.errors).sort()).toEqual([...errorCodes].sort());
    for (const code of errorCodes) expect(hr.errors[code].length).toBeGreaterThan(5);
  });

  it('other locales may only translate catalogued codes (Italian is planned, not shipped)', () => {
    const itErrors = (itLocale as { errors?: Record<string, string> }).errors ?? {};
    expect(Object.keys(itErrors).filter((k) => !isErrorCode(k))).toEqual([]);
  });

  it('statuses follow api-conventions §4 and database mappings point at catalogued codes', () => {
    expect(errorCatalog.METHOD_NOT_ALLOWED.status).toBe(405);
    expect(errorCatalog.MEMBERSHIP_SUSPENDED.status).toBe(409);
    expect(errorCatalog.INVITATION_LIMIT_REACHED.status).toBe(429);
    for (const target of Object.values(dbErrorCatalog)) expect(isErrorCode(target)).toBe(true);
    for (const name of exposedDbErrors) expect(isErrorCode(name)).toBe(true);
  });
});

describe('mapping database errors to public codes', () => {
  it('passes through only exposed P0001 exceptions', () => {
    expect(fromPostgrestError({ code: 'P0001', message: 'MEMBERSHIP_SUSPENDED' }).code).toBe('MEMBERSHIP_SUSPENDED');
    expect(fromPostgrestError({ code: 'P0001', message: 'ANYTHING_ELSE' }).code).toBe('INTERNAL');
    expect(fromPostgrestError({ code: '42501', message: 'ONLY_ORG_ADMIN_MAY_CHANGE_ORG_ADMIN' }).code).toBe('NOT_FOUND');
    expect(fromPostgrestError({ code: '22023', message: 'INVALID_ARGUMENTS' }).code).toBe('VALIDATION_FAILED');
    expect(fromPostgrestError({ code: '42501' }, 'corr-12345678')).toEqual({ code: 'NOT_FOUND', message: 'errors.NOT_FOUND', correlationId: 'corr-12345678' });
  });

  it('maps invitation insert outcomes (invite-member)', () => {
    expect(fromInvitationInsertError({ code: '23505' })).toBe('INVITATION_PENDING_EXISTS');
    expect(fromInvitationInsertError(null)).toBe('INVITATION_LIMIT_REACHED');
    expect(fromInvitationInsertError({ code: 'PGRST116' })).toBe('PERMISSION_DENIED');
    expect(fromInvitationInsertError({ code: 'P0001', message: 'MEMBERSHIP_SUSPENDED' })).toBe('MEMBERSHIP_SUSPENDED');
    expect(fromInvitationInsertError({ code: '42501', message: 'PERMISSION_DENIED' })).toBe('PERMISSION_DENIED');
    expect(fromInvitationInsertError({ code: '42501', message: 'MEMBERSHIP_SUSPENDED' })).toBe('PERMISSION_DENIED');
  });
});
