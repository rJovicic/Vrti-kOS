import { env } from '@/lib/env';
import { t } from '@/lib/i18n';

// Personal-data pages must never be statically generated or cached (SR-WEB-04).
export const dynamic = 'force-dynamic';

async function checkApi(): Promise<'ok' | 'down'> {
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: env.supabasePublishableKey },
      cache: 'no-store',
    });
    return res.ok ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

/** D0 shell: confirms the admin reaches the local Supabase stack. Feature routes arrive in D1+ (admin-app.md). */
export default async function Home() {
  const state = await checkApi();
  return (
    <main className="shell">
      <h1>{t('common.appName')}</h1>
      <p className="muted">{t('health.title')}</p>
      <p className="status" data-state={state} role="status">
        {state === 'ok' ? t('health.apiOk') : t('health.apiDown')}
      </p>
    </main>
  );
}
