import { loadSheetCached, isActive, type SheetRow } from '../sheets-loader';
import { SHEET_NAMES } from '../sheets-config';

export interface DailyTip {
  date: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  do: string[];
  dont: string[];
}

type Style = 'soft' | 'direct';

function styleFromUser(style: string | null | undefined): Style {
  return style === 'blunt' ? 'direct' : 'soft';
}

function rowToTip(row: SheetRow, style: Style): DailyTip | null {
  const date = (row.date ?? '').trim();
  if (!date) return null;

  const title = (row[`${style}_title`] ?? row.direct_title ?? row.soft_title ?? '').trim();
  const shortDescription = (
    row[`${style}_short_description`] ??
    row.direct_short_description ??
    row.soft_short_description ??
    ''
  ).trim();
  const fullDescription = (row.neutral_full_description ?? '').trim();
  if (!title || !shortDescription) return null;

  const pick = (prefix: 'do' | 'dont') =>
    [row[`${prefix}_1`], row[`${prefix}_2`], row[`${prefix}_3`]]
      .map((v) => (v ?? '').trim())
      .filter(Boolean);

  return {
    date,
    title,
    shortDescription,
    fullDescription,
    do: pick('do'),
    dont: pick('dont'),
  };
}

function todayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getTipForDate(
  userStyle: string | null | undefined,
  dateISO: string
): Promise<DailyTip | null> {
  const rows = await loadSheetCached(SHEET_NAMES.daily);
  const active = rows.filter(isActive);
  if (active.length === 0) return null;

  const style = styleFromUser(userStyle);

  const exact = active.find((r) => (r.date ?? '').trim() === dateISO);
  if (exact) return rowToTip(exact, style);

  const past = active
    .filter((r) => (r.date ?? '').trim() <= dateISO)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  if (past[0]) return rowToTip(past[0], style);

  return null;
}

export async function getDailyTipForToday(
  userStyle: string | null | undefined
): Promise<DailyTip | null> {
  return getTipForDate(userStyle, todayYmd());
}
