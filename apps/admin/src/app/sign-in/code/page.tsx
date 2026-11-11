import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { Flash } from '@/components/Flash';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { verifyCode } from '../actions';

export const dynamic = 'force-dynamic';

export default async function CodePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <AuthCard title={t('auth.codeTitle')} lede={t('auth.codeLede')}>
      <Flash params={params} />
      <form action={verifyCode} className="stack">
        <label className="field">
          {t('auth.code')}
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="code" />
        </label>
        <button className="btn primary" type="submit">
          {t('auth.confirm')}
        </button>
      </form>
      <Link href="/sign-in">{t('auth.otherEmail')}</Link>
    </AuthCard>
  );
}
