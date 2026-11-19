// GET /api/health — liveness check for the hosting platform (Railway staging healthcheck).
// Deliberately static: no database call, no session, no personal data. It reports only the deployment label and the
// Supabase project host that the build was configured with (both already public in the client bundle), so an operator
// can confirm that a staging deployment points at the staging project and never at production.
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export function GET() {
  let supabaseHost = 'invalid';
  try {
    supabaseHost = new URL(env.supabaseUrl).host;
  } catch {
    // keep 'invalid': a misconfigured URL must still answer the healthcheck so the problem is visible
  }
  return Response.json(
    { status: 'ok', appEnv: env.appEnv, supabaseHost },
    { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  );
}
