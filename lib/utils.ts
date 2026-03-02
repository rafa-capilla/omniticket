export const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export const safeText = (val: unknown): string =>
  val === null || val === undefined ? '' : String(val);

export const safeNum = (val: unknown): number => {
  if (typeof val === 'number') return val;
  const clean = String(val ?? '0').replace(/\s/g, '').replace(',', '.').replace(/[^-0-9.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};
