// Pure rules from CLAUDE.md "Screens". No imports, so tests run with plain `node --test`.

export type Priority = 'low' | 'medium' | 'urgent';

type SiteLike = { priority: string | null; last_visit: string | null };
type StockLike = { quantity: number; low_at: number };

export const DEFAULT_OVERDUE_DAYS = 35;

/** Today's date as YYYY-MM-DD in the device's local time zone. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

/** Whole days between a YYYY-MM-DD date and today (local), or null if never. */
export function daysSince(date: string | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  const then = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86_400_000);
}

/** Overdue = no visit for more than `overdueDays` days, or never visited. */
export function isOverdue(site: SiteLike, overdueDays = DEFAULT_OVERDUE_DAYS, now?: Date): boolean {
  const d = daysSince(site.last_visit, now);
  return d === null || d > overdueDays;
}

/**
 * Sort key for "Needs attention" and the Sites list:
 * urgent 300, medium 200, overdue +100, +10 per open job, plus up to 6 for days since the last visit.
 */
export function score(site: SiteLike, openJobs: number, overdueDays = DEFAULT_OVERDUE_DAYS, now?: Date): number {
  const p = site.priority === 'urgent' ? 300 : site.priority === 'medium' ? 200 : 0;
  const days = daysSince(site.last_visit, now);
  return p + (isOverdue(site, overdueDays, now) ? 100 : 0) + openJobs * 10 + Math.min(days ?? 60, 60) / 10;
}

export function needsAttention(site: SiteLike, openJobs: number, overdueDays = DEFAULT_OVERDUE_DAYS, now?: Date): boolean {
  return site.priority === 'urgent' || site.priority === 'medium' || isOverdue(site, overdueDays, now) || openJobs > 0;
}

export function isLowStock(item: StockLike): boolean {
  return item.low_at > 0 && item.quantity < item.low_at;
}

/** "5 Nov", or "5 Nov 2025" when not this year. */
export function formatDate(date: string | null | undefined, now: Date = new Date()): string {
  if (!date) return 'never';
  const [y, m, d] = date.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]}${y !== now.getFullYear() ? ` ${y}` : ''}`;
}

export function visitedText(lastVisit: string | null, now?: Date): string {
  const d = daysSince(lastVisit, now);
  if (d === null) return 'Never visited';
  const ago = d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
  return `Visited ${formatDate(lastVisit, now)} · ${ago}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Google Maps link (opens the maps app on phones). Uses GPS if we have it. */
export function directionsUrl(site: { name: string; address: string; lat: number | null; lng: number | null }): string {
  const query = site.lat != null && site.lng != null ? `${site.lat},${site.lng}` : `${site.name} ${site.address || 'Plymouth'}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
