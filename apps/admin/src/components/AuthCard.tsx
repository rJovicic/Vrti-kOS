import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';

/** Centered single-task card used by sign-in and MFA steps. */
export function AuthCard({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-card">
        <p className="brand">{t('common.appName')}</p>
        <h1>{title}</h1>
        {lede ? <p className="muted">{lede}</p> : null}
        {children}
      </div>
    </main>
  );
}
