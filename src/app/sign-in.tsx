import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { InstallBanner } from '@/components/install-banner';
import { BrandScreen, Button, Field, LinkText, Message } from '@/components/ui';
import { authRedirectUrl, friendlyAuthError } from '@/lib/auth';
import { openedFromFailedEmailLink, supabase, supabaseConfigured } from '@/lib/supabase';

export default function SignIn() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const signup = mode === 'signup';

  const linkError = openedFromFailedEmailLink
    ? 'That email link has expired or was already used. If you’ve confirmed your email, just sign in below. Otherwise, sign in to get a new confirmation email.'
    : '';

  async function submit() {
    setError('');
    setNotice('');
    const e = email.trim().toLowerCase();
    if (!e || !password) return setError('Please enter your email and password.');
    if (signup && !name.trim()) return setError('Please enter your name, so the team knows who logged each visit.');
    if (signup && password.length < 8) return setError('Please choose a password of at least 8 characters.');

    setBusy(true);
    try {
      if (signup) {
        const { data, error: err } = await supabase.auth.signUp({
          email: e,
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: authRedirectUrl('/') },
        });
        if (err) throw err;
        if (!data.session) {
          // Email confirmation is switched on in Supabase.
          setNotice(`We’ve sent a confirmation link to ${e}. Open it, then come back and sign in.`);
          setMode('signin');
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: e, password });
        if (err) throw err;
      }
      // On success the root layout switches screens automatically.
    } catch (err) {
      setError(friendlyAuthError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BrandScreen
      title={signup ? 'Create your account' : 'Sign in'}
      subtitle={signup ? 'An admin will approve your account before you can see the sites.' : 'Log visits, see what needs doing and keep track of stock.'}>
      <InstallBanner />
      {linkError ? <Message tone="error">{linkError}</Message> : null}
      {!supabaseConfigured && <Message tone="error">The app isn’t connected to Supabase yet (missing .env.local).</Message>}
      {signup && <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder="e.g. Sam Green" />}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        inputMode="email"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={signup ? 'new-password' : 'current-password'}
        textContentType={signup ? 'newPassword' : 'password'}
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      {error ? <Message tone="error">{error}</Message> : null}
      {notice ? <Message tone="success">{notice}</Message> : null}
      <Button title={signup ? 'Create account' : 'Sign in'} onPress={submit} busy={busy} style={{ marginTop: 4 }} />
      <View style={{ marginTop: 12 }}>
        <LinkText
          onPress={() => {
            setMode(signup ? 'signin' : 'signup');
            setError('');
            setNotice('');
          }}>
          {signup ? 'I already have an account' : 'New here? Create an account'}
        </LinkText>
        {!signup && <LinkText onPress={() => router.push('/forgot-password')}>Forgot password?</LinkText>}
      </View>
    </BrandScreen>
  );
}
