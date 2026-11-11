import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { isDemo } from '@/lib/env';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'VrtićOS — administracija',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hr">
      <body>
        {isDemo ? (
          <div className="demo-banner" role="note">
            {t('common.demoBanner')}
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
