// Public Google Spreadsheet that hosts MVP content.
// Sheet must be "Published to web" (File → Share → Publish to web → CSV).
// To swap source: change the ID or sheet names below.
export const SHEETS_SPREADSHEET_ID =
  '1Sjj2dEv6Zz_QnYB4BB0ON-4e9TepUnyrjXUjjKwNzEM';

export const SHEET_NAMES = {
  daily: 'daily_tips',
  longreads: 'longreads',
  weeklyLongreads: 'weekly_longreads',
  void: 'void_questions',
} as const;

export const SHEET_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const SHEET_CACHE_PREFIX = 'zvezdnik-sheet-v1:';
