// Transactional e-mail transport (ADR-0010). Locally: Mailpit's HTTP send API — nothing leaves the machine.
// A production provider is added here after ADR-0010 is approved; there is deliberately no other transport yet.
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  const transport = Deno.env.get('EMAIL_TRANSPORT') ?? 'mailpit';
  if (transport !== 'mailpit') throw new Error('EMAIL_TRANSPORT_NOT_CONFIGURED');
  const base = Deno.env.get('MAILPIT_URL') ?? 'http://supabase_inbucket_vrticos:8025';
  const res = await fetch(`${base}/api/v1/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      From: { Email: 'no-reply@demo.vrtic.test', Name: 'VrtićOS' },
      To: [{ Email: mail.to }],
      Subject: mail.subject,
      Text: mail.text,
    }),
  });
  if (!res.ok) throw new Error(`EMAIL_SEND_FAILED_${res.status}`);
}
