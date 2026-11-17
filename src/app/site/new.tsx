import { Stack } from 'expo-router';

import { SiteForm } from '@/components/site-form';

export default function NewSite() {
  return (
    <>
      <Stack.Screen options={{ title: 'Add a site' }} />
      <SiteForm />
    </>
  );
}
