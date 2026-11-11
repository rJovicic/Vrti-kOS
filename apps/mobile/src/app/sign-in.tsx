import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space, type } from '@vrticos/tokens';
import { zEmailInput, zOtpInput } from '@vrticos/validation';
import { env } from '../lib/env';
import { supabase } from '../lib/supabase';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { TextField } from '../ui/TextField';
import { useColors } from '../ui/theme';

type Step = 'email' | 'code';

/** E-mail one-time code sign-in (SR-AUTHN-01). Known and unknown addresses get the same next step. */
export default function SignIn() {
  const { t } = useTranslation();
  const c = useColors();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    const parsed = zEmailInput.safeParse({ email });
    if (!parsed.success) return setError(t('errors.VALIDATION_FAILED'));
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false } });
      if (e?.status === 429) return setError(t('errors.RATE_LIMITED'));
      setEmail(parsed.data.email);
      setStep('code');
    } catch {
      setError(t('health.apiDown'));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const parsed = zOtpInput.safeParse({ email, code: code.trim() });
    if (!parsed.success) return setError(t('auth.codeInvalid'));
    setBusy(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: 'email' });
      if (e || !data.session) return setError(e?.status === 429 ? t('errors.RATE_LIMITED') : t('auth.codeInvalid'));
      // Links any pending invitation for this verified address (single use, server-side). Failure is not fatal:
      // the user simply sees no kindergarten data until it succeeds on a later sign-in.
      await fetch(`${env.supabaseUrl}/functions/v1/accept-invitations`, {
        method: 'POST',
        headers: { apikey: env.supabasePublishableKey, authorization: `Bearer ${data.session.access_token}` },
      }).catch(() => undefined);
      setCode('');
      router.replace('/home');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[styles.title, { color: c.textPrimary }]}>
          {step === 'email' ? t('auth.signInTitle') : t('auth.codeTitle')}
        </Text>
        <Text style={[styles.lede, { color: c.textSecondary }]}>{step === 'email' ? t('mobile.signInLede') : t('mobile.codeSentTo')}</Text>
        {error ? <Notice tone="error" title={error} /> : null}
        {step === 'email' ? (
          <>
            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              maxLength={254}
            />
            <Button label={t('auth.sendCode')} onPress={() => void requestCode()} busy={busy} />
          </>
        ) : (
          <>
            <TextField
              label={t('auth.code')}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
            />
            <Button label={t('auth.confirm')} onPress={() => void verify()} busy={busy} />
            <Button
              variant="text"
              label={t('auth.otherEmail')}
              onPress={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space[6], gap: space[4] },
  title: { fontSize: type.title1.size, lineHeight: type.title1.lineHeight, fontWeight: type.title1.weight, letterSpacing: type.title1.tracking },
  lede: { fontSize: type.body.size, lineHeight: type.body.lineHeight },
});
