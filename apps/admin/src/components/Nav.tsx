'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Nav({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="nav">
      {items.map((i) => {
        const current = i.href.split('/').length === 2 ? path === i.href : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href as Route} aria-current={current ? 'page' : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
