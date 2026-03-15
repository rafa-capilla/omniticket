import { Rule, TicketItem, Category } from '../../shared/types/domain';
import { matchRule } from '../../lib/utils';

/**
 * Pure domain service for applying user-defined categorization rules to ticket items.
 * No I/O dependencies - operates entirely on in-memory data.
 */

/**
 * Applies user rules (highest priority) to ticket items and validates categories.
 * Mutates items in place for compatibility with SyncEngine's existing flow.
 *
 * Used by SyncEngine during ticket processing (write-time rule application).
 */
export function applyRulesToItems(
  items: TicketItem[],
  rules: Rule[],
  validCategories: Category[],
): void {
  const validCategoryNames = new Set(validCategories.map(c => c.name));
  for (const item of items) {
    const match = matchRule(item.nombre, rules);
    if (match) {
      item.nombre_normalizado = match.normalized;
      item.categoria = match.category;
    }
    if (!validCategoryNames.has(item.categoria)) {
      item.categoria = 'Otros';
    }
  }
}

/**
 * Applies user rules to raw spreadsheet rows for display purposes (read-time).
 * Returns new rows (does not mutate input) with normalized names and categories applied.
 *
 * Used by LensesView to override Gemini's categorization with user rules.
 */
export function applyRulesToRows(
  rows: string[][],
  rules: Rule[],
  productCol: number,
  categoryCol: number,
  normalizedCol: number,
  totalMarker: string,
): string[][] {
  return rows.map(row => {
    const originalName = row[productCol] ?? '';
    if (originalName === totalMarker || !originalName) return row;

    const matchedRule = matchRule(originalName, rules);
    const normalizedFromSync = row[normalizedCol] ?? '';
    let normalizedName = normalizedFromSync || originalName;
    let category = row[categoryCol] ?? 'Otros';

    if (matchedRule) {
      normalizedName = matchedRule.normalized;
      category = matchedRule.category;
    }

    const newRow = [...row];
    newRow[productCol] = normalizedName;
    newRow[categoryCol] = category;
    return newRow;
  });
}
