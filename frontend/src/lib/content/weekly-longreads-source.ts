import { loadSheetCached, isActive, type SheetRow } from '../sheets-loader';
import { SHEET_NAMES } from '../sheets-config';

export interface WeeklyLongread {
  weekStart: Date;
  weekEnd: Date;
  title: string;
  shortDescription: string;
  logoEmoji: string;
  text: string;
}

/** Parse YYYY-MM-DD or DD.MM.YYYY into a Date at UTC midnight. Returns null on failure. */
function parseDate(input: string): Date | null {
  const v = (input ?? '').trim();
  if (!v) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Date.UTC(+y, +mo - 1, +d));
  }
  // DD.MM.YYYY or DD/MM/YYYY
  m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return new Date(Date.UTC(+y, +mo - 1, +d));
  }
  const ts = Date.parse(v);
  if (!Number.isNaN(ts)) return new Date(ts);
  return null;
}

function rowToWeekly(row: SheetRow): WeeklyLongread | null {
  const weekStart = parseDate(row.week_start);
  const weekEnd = parseDate(row.week_end);
  const title = (row.title ?? '').trim();
  const text = (row.text ?? '').trim();
  if (!weekStart || !weekEnd || !title || !text) return null;
  return {
    weekStart,
    weekEnd,
    title,
    shortDescription: (row.short_description ?? '').trim(),
    logoEmoji: (row.logo_emoji ?? '').trim() || '✨',
    text,
  };
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Returns the weekly longread to feature:
 * 1. Active row where week_start <= today <= week_end.
 * 2. Otherwise the latest previous active row by week_start.
 * 3. Otherwise the nearest upcoming active row by week_start.
 * 4. Otherwise null.
 */
export async function getCurrentWeeklyLongread(): Promise<WeeklyLongread | null> {
  const rows = await loadSheetCached(SHEET_NAMES.weeklyLongreads);
  const active = rows.filter(isActive).map(rowToWeekly).filter((r): r is WeeklyLongread => !!r);
  if (active.length === 0) return null;

  const today = todayUtc().getTime();

  const current = active.find(
    (r) => r.weekStart.getTime() <= today && today <= r.weekEnd.getTime()
  );
  if (current) return current;

  const past = active
    .filter((r) => r.weekStart.getTime() <= today)
    .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  if (past[0]) return past[0];

  const upcoming = active
    .filter((r) => r.weekStart.getTime() > today)
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  return upcoming[0] ?? null;
}

export function splitWeeklyParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
