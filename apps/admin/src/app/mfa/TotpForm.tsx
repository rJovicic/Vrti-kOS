'use client';

import { useActionState } from 'react';
import { verifyTotp, type TotpState } from './actions';

interface Labels {
  code: string;
  confirm: string;
  errors: Record<'MFA_INVALID' | 'RATE_LIMITED', string>;
}

export function TotpForm({ factorId, labels }: { factorId: string; labels: Labels }) {
  const [state, action, pending] = useActionState<TotpState, FormData>(verifyTotp, null);
  return (
    <form action={action} className="stack">
      {state ? (
        <p className="flash error" role="alert">
          {labels.errors[state.error]}
        </p>
      ) : null}
      <input type="hidden" name="factorId" value={factorId} />
      <label className="field">
        {labels.code}
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="code" />
      </label>
      <button className="btn primary" type="submit" disabled={pending}>
        {labels.confirm}
      </button>
    </form>
  );
}
