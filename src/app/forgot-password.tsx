import { router } from 'expo-router';
import { useState } from 'react';

import { BrandScreen, Button, Field, LinkText, Message } from '@/components/ui';
import { authRedirectUrl, friendlyAuthError } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function send() {
    setError('');
    const e = email.trim().toLowerCase();
    if (!e) return setError('Please enter your email.');
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: authRedirectUrl('/reset-password') });
    setBusy(false);
    if (err) setError(friendlyAuthError(err.message));
    else setSent(true);
  }

  return (
    <BrandScreen title="Reset your password" subtitle="We’ll email you a link to choose a new one.">
      {sent ? (
        <Message tone="success">If there’s an account for {email.trim()}, a reset link is on its way. Open it on this device.</Message>
      ) : (
        <>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            onSubmitEditing={send}
          />
          {error ? <Message tone="error">{error}</Message> : null}
          <Button title="Send reset link" onPress={send} busy={busy} />
        </>
      )}
      <LinkText onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}>Back to sign in</LinkText>
    </BrandScreen>
  );
}
