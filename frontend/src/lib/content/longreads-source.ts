import { loadSheetCached, isActive } from '../sheets-loader';
import { SHEET_NAMES } from '../sheets-config';

export type LongreadKey =
  | 'natal_chart'
  | 'confidence_path'
  | 'intimacy_formula'
  | 'money_and_chart'
  | 'inner_resource'
  | 'career_ceiling'
  | 'week_energy';

export type LongreadsByKey = Partial<Record<LongreadKey, string>>;

const KEYS: LongreadKey[] = [
  'natal_chart',
  'confidence_path',
  'intimacy_formula',
  'money_and_chart',
  'inner_resource',
  'career_ceiling',
  'week_energy',
];

function normalizeGender(g: string | null | undefined): 'male' | 'female' | null {
  const v = (g ?? '').toLowerCase().trim();
  if (v === 'male' || v === 'm' || v === 'муж' || v === 'мужской') return 'male';
  if (v === 'female' || v === 'f' || v === 'жен' || v === 'женский') return 'female';
  return null;
}

export async function getLongreadsForUser(
  gender: string | null | undefined
): Promise<LongreadsByKey> {
  const rows = await loadSheetCached(SHEET_NAMES.longreads);
  const active = rows.filter(isActive);
  if (active.length === 0) return {};

  const target = normalizeGender(gender);
  const row =
    (target && active.find((r) => normalizeGender(r.gender) === target)) ||
    active.find((r) => normalizeGender(r.gender) === 'female') ||
    active[0];

  const out: LongreadsByKey = {};
  for (const key of KEYS) {
    const v = (row[key] ?? '').trim();
    if (v) out[key] = v;
  }
  return out;
}

/** Split a single long cell value into paragraphs for rendering. */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
