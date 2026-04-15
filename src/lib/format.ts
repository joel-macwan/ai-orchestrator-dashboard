import {
  BYTES_PER_KB,
  COST_DECIMAL_PLACES,
  COST_SMALL_DECIMAL_PLACES,
  COST_SMALL_THRESHOLD,
  HOURS_PER_DAY,
  KB_DECIMAL_PLACES,
  LOCALE,
  MARKDOWN_EXTENSIONS,
  MINUTES_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  TOKEN_MILLION,
  TOKEN_THOUSAND,
} from './constants';

export function formatKb(bytes: number): string {
  return `${(bytes / BYTES_PER_KB).toFixed(KB_DECIMAL_PLACES)} KB`;
}

export function isMarkdownFile(name: string): boolean {
  const lower = name.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < COST_SMALL_THRESHOLD) return `$${usd.toFixed(COST_SMALL_DECIMAL_PLACES)}`;
  return `$${usd.toFixed(COST_DECIMAL_PLACES)}`;
}

export function formatTokens(n: number): string {
  if (n === 0) return '0';
  if (n >= TOKEN_MILLION) return `${(n / TOKEN_MILLION).toFixed(1)}M`;
  if (n >= TOKEN_THOUSAND) return `${(n / TOKEN_THOUSAND).toFixed(1)}K`;
  return n.toLocaleString(LOCALE);
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / MS_PER_SECOND);
  const h = Math.floor(s / SECONDS_PER_HOUR);
  const m = Math.floor((s % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const sec = s % SECONDS_PER_MINUTE;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatElapsed(startedAt: string, endedAt?: string): string {
  const start = new Date(startedAt).getTime();
  if (isNaN(start)) return '—';
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (isNaN(end)) return '—';
  return formatDuration(end - start);
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / MS_PER_MINUTE);
  if (minutes < 1) return 'just now';
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours}h ago`;
  const days = Math.floor(hours / HOURS_PER_DAY);
  return `${days}d ago`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '??:??:??';
  return d.toLocaleTimeString(LOCALE, { hour12: false });
}

export function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}
