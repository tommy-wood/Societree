import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { Button, Field, Message, Screen, SectionTitle } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Details = {
  invoice_name: string;
  address: string;
  phone: string;
  email: string;
  bank_account_name: string;
  bank_sort_code: string;
  bank_account_number: string;
};

export default function InvoiceDetails() {
  const c = useColors();
  const { session, profile } = useAuth();
  const [v, setV] = useState<Details | null>(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    supabase
      .from('contractor_details')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setExists(!!data);
        setV({
          invoice_name: data?.invoice_name || profile?.name || '',
          address: data?.address ?? '',
          phone: data?.phone ?? '',
          email: data?.email || session.user.email || '',
          bank_account_name: data?.bank_account_name ?? '',
          bank_sort_code: data?.bank_sort_code ?? '',
          bank_account_number: data?.bank_account_number ?? '',
        });
      });
  }, [session, profile?.name]);

  if (!v) {
    return (
      <Screen center>
        <ActivityIndicator color={c.accent} />
      </Screen>
    );
  }

  const set = (k: keyof Details) => (t: string) => setV((x) => (x ? { ...x, [k]: t } : x));

  async function save() {
    if (!v || !session) return;
    setError('');
    const clean = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()])) as Details;
    if (!clean.invoice_name) return setError('Please add the name to put on your invoices.');
    if (clean.bank_sort_code && !/^\d{2}-?\d{2}-?\d{2}$/.test(clean.bank_sort_code)) return setError('Sort code should be 6 digits, e.g. 12-34-56.');
    if (clean.bank_account_number && !/^\d{8}$/.test(clean.bank_account_number.replace(/\s/g, ''))) return setError('Account number should be 8 digits.');
    if (clean.bank_sort_code) clean.bank_sort_code = clean.bank_sort_code.replace(/-/g, '').replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');
    clean.bank_account_number = clean.bank_account_number.replace(/\s/g, '');
    setBusy(true);
    const res = exists
      ? await supabase.from('contractor_details').update(clean).eq('user_id', session.user.id)
      : await supabase.from('contractor_details').insert(clean);
    setBusy(false);
    if (res.error) return setError('Couldn’t save, please try again.');
    router.back();
  }

  return (
    <Screen>
      <Message>These appear on your invoices. Only you and whoever signs off invoices (Bethan) can see them.</Message>
      <Field label="Name on invoices (your name or business name)" value={v.invoice_name} onChangeText={set('invoice_name')} autoComplete="name" />
      <Field label="Address" value={v.address} onChangeText={set('address')} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <Field label="Phone" value={v.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Email" value={v.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

      <SectionTitle>Bank details (optional)</SectionTitle>
      <Text style={{ color: c.muted, marginBottom: 10 }}>Leave these empty if Bethan already has them; they’ll only be printed on the invoice if you fill them in.</Text>
      <Field label="Account name" value={v.bank_account_name} onChangeText={set('bank_account_name')} />
      <Field label="Sort code" value={v.bank_sort_code} onChangeText={set('bank_sort_code')} keyboardType="number-pad" placeholder="12-34-56" />
      <Field label="Account number" value={v.bank_account_number} onChangeText={set('bank_account_number')} keyboardType="number-pad" placeholder="12345678" />

      {error ? <Message tone="error">{error}</Message> : null}
      <Button title="Save" onPress={save} busy={busy} />
      <Text style={{ color: c.muted, fontSize: 13, marginTop: 12 }}>Changes apply to invoices you send from now on. Invoices already sent keep the details they were sent with.</Text>
    </Screen>
  );
}
