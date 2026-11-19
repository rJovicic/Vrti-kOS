// Operator helper: print a one-time sign-in code for a SYNTHETIC staging account (admin web or iPhone).
//
//   cd tests/integration
//   STAGING_PUBLISHABLE_KEY=sb_publishable_… STAGING_SECRET_KEY=sb_secret_… \
//     node --experimental-strip-types src/staging/code.ts odgojitelj.alfa.1@demo.vrtic.test
//
// Then type the code on the sign-in screen within 10 minutes. Refuses non-staging URLs and non-synthetic addresses.
import { mintCode } from './target.ts';

const email = process.argv[2];
if (!email) {
  console.error('usage: code.ts <synthetic-email>');
  process.exit(2);
}
console.log(await mintCode(email));
