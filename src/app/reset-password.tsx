import { useState } from 'react';

import { BrandScreen, Button, Field, LinkText, Message } from '@/components/ui';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const { finishRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (password.length < 8) return setError('Please choose a password of at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendlyAuthError(err.message));
    finishRecovery(); // root layout moves on to the app
  }

  return (
    <BrandScreen title="Choose a new password">
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Field label="Type it again" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" onSubmitEditing={save} />
      {error ? <Message tone="error">{error}</Message> : null}
      <Button title="Save password" onPress={save} busy={busy} />
      <LinkText
        onPress={async () => {
          finishRecovery();
          await signOut();
        }}>
        Cancel
      </LinkText>
    </BrandScreen>
  );
}
