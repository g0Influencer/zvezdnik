import {
  SHEETS_SPREADSHEET_ID,
  SHEET_CACHE_PREFIX,
  SHEET_CACHE_TTL_MS,
} from './sheets-config';

export type SheetRow = Record<string, string>;

function buildUrl(sheetName: string): string {
  const id = encodeURIComponent(SHEETS_SPREADSHEET_ID);
  const sheet = encodeURIComponent(sheetName);
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${sheet}`;
}

/**
 * Minimal CSV parser supporting quoted fields, embedded commas/newlines,
 * and "" escapes. Returns an array of records keyed by the header row.
 */
function parseCsv(text: string): SheetRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      // handle CRLF
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      // skip blank lines
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  // flush trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const rec: SheetRow = {};
    headers.forEach((h, idx) => {
      rec[h] = (cols[idx] ?? '').trim();
    });
    return rec;
  });
}

const TRUTHY = new Set(['true', '1', 'yes', 'да', 'y', 'on']);
export function isActive(row: SheetRow): boolean {
  const v = (row.is_active ?? '').toString().trim().toLowerCase();
  // If the column is missing entirely, treat as active (lenient default).
  if (v === '') return !('is_active' in row);
  return TRUTHY.has(v);
}

interface CacheEntry {
  ts: number;
  rows: SheetRow[];
}

function cacheKey(sheetName: string) {
  return `${SHEET_CACHE_PREFIX}${sheetName}`;
}

function readCache(sheetName: string): CacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(sheetName));
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(sheetName: string, rows: SheetRow[]) {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { ts: Date.now(), rows };
    window.localStorage.setItem(cacheKey(sheetName), JSON.stringify(entry));
  } catch {
    /* ignore quota errors */
  }
}

export function clearSheetCache(sheetName?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (sheetName) {
      window.localStorage.removeItem(cacheKey(sheetName));
      return;
    }
    // Clear all known sheet caches
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(SHEET_CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export async function fetchSheet(sheetName: string): Promise<SheetRow[]> {
  const res = await fetch(buildUrl(sheetName), { credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`Sheet "${sheetName}" responded ${res.status}`);
  }
  const text = await res.text();
  // If sheet isn't published, Google returns an HTML login page.
  if (text.trimStart().toLowerCase().startsWith('<!doctype') ||
      text.trimStart().startsWith('<html')) {
    throw new Error(`Sheet "${sheetName}" is not published to web`);
  }
  return parseCsv(text);
}

/**
 * Load sheet rows with 10-minute localStorage cache and graceful degradation.
 * Falls back to the last cached value on error, then to the supplied fallback.
 */
export async function loadSheetCached(
  sheetName: string,
  fallback: SheetRow[] = []
): Promise<SheetRow[]> {
  const cached = readCache(sheetName);
  const fresh = cached && Date.now() - cached.ts < SHEET_CACHE_TTL_MS;
  if (fresh) return cached!.rows;

  try {
    const rows = await fetchSheet(sheetName);
    writeCache(sheetName, rows);
    return rows;
  } catch (err) {
    console.warn(`[sheets] failed to load ${sheetName}:`, err);
    if (cached) return cached.rows;
    return fallback;
  }
}
