import { AuthCard } from '@/components/AuthCard';
import { Flash } from '@/components/Flash';
import { env } from '@/lib/env';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { requestCode } from './actions';

export const dynamic = 'force-dynamic';

async function apiReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, { headers: { apikey: env.supabasePublishableKey }, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const up = await apiReachable();
  return (
    <AuthCard title={t('auth.signInTitle')} lede={t('auth.signInLede')}>
      {up ? null : (
        <p className="flash error" role="alert">
          {t('health.apiDown')}
        </p>
      )}
      <Flash params={params} />
      <form action={requestCode} className="stack">
        <label className="field">
          {t('auth.email')}
          <input name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
        </label>
        <button className="btn primary" type="submit">
          {t('auth.sendCode')}
        </button>
      </form>
    </AuthCard>
  );
}
