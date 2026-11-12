import { GuardianHomeScreen } from '../../features/guardian-home/GuardianHomeScreen';

/**
 * Guardian: Parent Home (docs/design/parent-home-spec.md). Children, guardianships and attendance arrive in D2/D3;
 * until then no child can be linked to an account, so the screen shows the specified empty state — never sample data.
 * D2 replaces the fixed state with the authorized children query.
 */
export default function GuardianHome() {
  return <GuardianHomeScreen state="empty" data={null} />;
}
