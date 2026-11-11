import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Session cookies are httpOnly: the admin app never creates a browser Supabase client, so page scripts never
 * need the tokens (SR-WEB-03). SameSite=Lax keeps the e-mail-free sign-in flow working; Secure outside localhost.
 */
export const sessionCookieOptions: CookieOptionsWithName = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production' && !(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http://127.0.0.1'),
  path: '/',
};
