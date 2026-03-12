export const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

/** Formats a Date as YYYY-MM-DD using local timezone (no UTC shift). */
export const toLocalDateString = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Extracts a human-readable message from an unknown caught error. */
export const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const safeText = (val: unknown): string =>
  val === null || val === undefined ? '' : String(val);

export const safeNum = (val: unknown): number => {
  if (typeof val === 'number') return val;
  const clean = String(val ?? '0').replace(/\s/g, '').replace(',', '.').replace(/[^-0-9.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};
