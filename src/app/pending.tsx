import { useState } from 'react';

import { InstallBanner } from '@/components/install-banner';
import { BrandScreen, Button, LinkText, Message } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Pending() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  async function check() {
    setBusy(true);
    await refreshProfile();
    setBusy(false);
    setChecked(true);
  }

  if (!profile) {
    return (
      <BrandScreen title="Couldn’t load your account" subtitle="Check your signal and try again.">
        <Button title="Try again" onPress={check} busy={busy} />
        <LinkText onPress={signOut}>Sign out</LinkText>
      </BrandScreen>
    );
  }

  return (
    <BrandScreen
      title={`Thanks${profile.name ? `, ${profile.name}` : ''}!`}
      subtitle="Your account is waiting for an admin to approve it. Once they have, you’ll see the sites here.">
      <Message>Signed in as {session?.user.email}. Let a Societree admin know you’ve signed up.</Message>
      <InstallBanner />
      <Button title="Check again" onPress={check} busy={busy} />
      {checked && !busy ? <Message>Not approved yet.</Message> : null}
      <LinkText onPress={signOut}>Sign out</LinkText>
    </BrandScreen>
  );
}
