// Money, months and invoice layout for the Hours tab. No React imports, so the
// rules can be unit tested with `node --test`.

export type Day = { date: string; hours: number; miles: number; description: string };
export type Material = { date: string; description: string; amount: number };
export type Contractor = {
  name: string;
  address: string;
  phone: string;
  email: string;
  bank_account_name: string;
  bank_sort_code: string;
  bank_account_number: string;
};

export type Totals = {
  hours: number;
  labour: number;
  miles: number;
  mileage: number;
  materials: number;
  total: number;
};

export const DEFAULT_MILEAGE_RATE = 0.45;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Same sums as the database's submit_invoice(), for the running total before sending. */
export function invoiceTotals(days: Day[], materials: Material[], hourlyRate: number, mileageRate = DEFAULT_MILEAGE_RATE): Totals {
  const hours = round2(days.reduce((n, d) => n + Number(d.hours), 0));
  const miles = Math.round(days.reduce((n, d) => n + Number(d.miles), 0) * 10) / 10;
  const mats = round2(materials.reduce((n, m) => n + Number(m.amount), 0));
  const labour = round2(hours * hourlyRate);
  const mileage = round2(miles * mileageRate);
  return { hours, labour, miles, mileage, materials: mats, total: round2(labour + mileage + mats) };
}

export function gbp(n: number): string {
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function hoursText(h: number): string {
  const n = Number(h);
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')} h`;
}

/** First day of the month containing an ISO date (YYYY-MM-DD). */
export function monthOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(monthIso: string, n: number): string {
  const [y, m] = monthIso.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[m - 1]} ${y}`;
}

export function lastDayOfMonth(monthIso: string): string {
  const [y, m] = monthIso.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Thu 6 Nov" */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${wd} ${d} ${mon}`;
}

export type InvoiceStatus = 'draft' | 'submitted' | 'approved' | 'paid' | 'returned';

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Not sent yet',
  submitted: 'Sent, waiting for sign-off',
  approved: 'Signed off, waiting for payment',
  paid: 'Paid',
  returned: 'Sent back for changes',
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>');

/** A complete, printable A4 invoice (used for "Print / save as PDF"). */
export function invoiceHtml(inv: {
  number: string;
  month: string;
  issued: string; // YYYY-MM-DD
  to: string;
  contractor: Contractor;
  hourlyRate: number;
  mileageRate: number;
  days: Day[];
  materials: Material[];
  totals: Totals;
  status?: InvoiceStatus;
  draft?: boolean;
}): string {
  const c = inv.contractor;
  const bank = c.bank_account_name || c.bank_sort_code || c.bank_account_number;
  const dayRows = inv.days
    .map(
      (d) =>
        `<tr><td>${esc(dayLabel(d.date))}</td><td>${esc(d.description)}</td><td class="n">${esc(hoursText(d.hours))}</td><td class="n">${Number(d.miles) ? esc(d.miles) : ''}</td></tr>`,
    )
    .join('');
  const matRows = inv.materials
    .map((m) => `<tr><td>${esc(dayLabel(m.date))}</td><td>${esc(m.description)}</td><td class="n" colspan="2">${gbp(m.amount)}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Invoice ${esc(inv.number)} – ${esc(c.name)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font: 13px/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #14281f; margin: 0; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .muted { color: #5d7066; }
  .top { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
  .box { margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #dde6e0; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #5d7066; }
  .n { text-align: right; white-space: nowrap; }
  .sum td { border: 0; padding: 3px 8px; }
  .sum .total td { font-size: 16px; font-weight: 700; border-top: 2px solid #14281f; padding-top: 8px; }
  .draft { background: #fff4e5; border: 1px solid #d9822b; color: #8a4b0f; padding: 8px 12px; border-radius: 8px; margin-bottom: 16px; }
  .print { margin: 16px 0; }
  @media print { .print { display: none; } .wrap { padding: 0; } }
</style></head><body><div class="wrap">
${inv.draft ? '<div class="draft">Draft: not sent yet. Figures may still change.</div>' : ''}
<div class="print"><button onclick="window.print()" style="font:inherit;padding:10px 16px;border-radius:10px;border:0;background:#1f7a4d;color:#fff">Print / save as PDF</button></div>
<div class="top">
  <div><h1>Invoice</h1><div class="muted">${esc(inv.number)}</div></div>
  <div style="text-align:right"><strong>${esc(c.name)}</strong><br>${c.address ? nl2br(c.address) + '<br>' : ''}${c.phone ? esc(c.phone) + '<br>' : ''}${c.email ? esc(c.email) : ''}</div>
</div>
<div class="top">
  <div class="box"><div class="muted">To</div><strong>${esc(inv.to)}</strong></div>
  <div class="box" style="text-align:right"><div class="muted">Date</div>${esc(dayLabel(inv.issued))} ${esc(inv.issued.slice(0, 4))}<div class="muted" style="margin-top:6px">For work in</div>${esc(monthLabel(inv.month))}</div>
</div>
<table><thead><tr><th>Day</th><th>Work</th><th class="n">Hours</th><th class="n">Miles</th></tr></thead><tbody>${dayRows || '<tr><td colspan="4" class="muted">No days</td></tr>'}</tbody></table>
${matRows ? `<table><thead><tr><th>Date</th><th>Materials bought</th><th class="n" colspan="2">Cost</th></tr></thead><tbody>${matRows}</tbody></table>` : ''}
<table class="sum">
  <tr><td>Labour: ${esc(hoursText(inv.totals.hours))} × ${gbp(inv.hourlyRate)}/h</td><td class="n">${gbp(inv.totals.labour)}</td></tr>
  <tr><td>Mileage: ${esc(inv.totals.miles)} miles × ${esc(Math.round(inv.mileageRate * 100))}p</td><td class="n">${gbp(inv.totals.mileage)}</td></tr>
  <tr><td>Materials</td><td class="n">${gbp(inv.totals.materials)}</td></tr>
  <tr class="total"><td>Total due</td><td class="n">${gbp(inv.totals.total)}</td></tr>
</table>
<p class="muted">No VAT charged.</p>
${bank ? `<div class="box"><div class="muted">Payment to</div>${c.bank_account_name ? esc(c.bank_account_name) + '<br>' : ''}${c.bank_sort_code ? 'Sort code ' + esc(c.bank_sort_code) + '<br>' : ''}${c.bank_account_number ? 'Account ' + esc(c.bank_account_number) : ''}</div>` : ''}
</div></body></html>`;
}
