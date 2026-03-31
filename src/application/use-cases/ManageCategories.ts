import type { CategoryRepository } from '@/application/ports/CategoryRepository';
import type { RuleRepository } from '@/application/ports/RuleRepository';
import { SHEET_HEADER_OFFSET } from '@/lib/constants';

/**
 * Use case: Delete a category with cascading updates.
 * When a category with associated products is deleted:
 * 1. Reassign all products in Gastos to the replacement category
 * 2. Update all rules pointing to the old category
 * 3. Delete the category row
 */
export class ManageCategories {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly rules: RuleRepository,
  ) {}

  async deleteWithCascade(
    spreadsheetId: string,
    rowIndex: number,
    categoryName: string,
    replacement: string,
  ): Promise<void> {
    if (replacement) {
      const [, allRules] = await Promise.all([
        this.categories.updateCategoryInGastos(spreadsheetId, categoryName, replacement),
        this.rules.getRules(spreadsheetId),
      ]);

      const ruleUpdates = allRules.flatMap((rule, i) =>
        rule.category === categoryName
          ? [this.rules.updateRule(spreadsheetId, i + SHEET_HEADER_OFFSET, { ...rule, category: replacement })]
          : []
      );
      await Promise.all(ruleUpdates);
    }

    await this.categories.deleteCategory(spreadsheetId, rowIndex);
  }
}
