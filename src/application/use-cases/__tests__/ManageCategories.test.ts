import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManageCategories } from '../ManageCategories';
import type { CategoryRepository } from '@/application/ports/CategoryRepository';
import type { RuleRepository } from '@/application/ports/RuleRepository';
import type { Rule, Category } from '@/shared/types/domain';

function createMockCategoryRepo(overrides?: Partial<CategoryRepository>): CategoryRepository {
  return {
    getCategories: vi.fn<CategoryRepository['getCategories']>().mockResolvedValue([]),
    addCategory: vi.fn<CategoryRepository['addCategory']>().mockResolvedValue(undefined),
    updateCategory: vi.fn<CategoryRepository['updateCategory']>().mockResolvedValue(undefined),
    deleteCategory: vi.fn<CategoryRepository['deleteCategory']>().mockResolvedValue(undefined),
    updateCategoryInGastos: vi.fn<CategoryRepository['updateCategoryInGastos']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockRuleRepo(rules: Rule[] = []): RuleRepository {
  return {
    getRules: vi.fn<RuleRepository['getRules']>().mockResolvedValue(rules),
    addRule: vi.fn<RuleRepository['addRule']>().mockResolvedValue(undefined),
    updateRule: vi.fn<RuleRepository['updateRule']>().mockResolvedValue(undefined),
    deleteRule: vi.fn<RuleRepository['deleteRule']>().mockResolvedValue(undefined),
  };
}

const SPREADSHEET_ID = 'sheet-123';

describe('ManageCategories', () => {
  describe('deleteWithCascade', () => {
    it('deletes category row after cascading updates', async () => {
      const catRepo = createMockCategoryRepo();
      const ruleRepo = createMockRuleRepo();
      const uc = new ManageCategories(catRepo, ruleRepo);

      await uc.deleteWithCascade(SPREADSHEET_ID, 3, 'Limpieza', 'Otros');

      expect(catRepo.updateCategoryInGastos).toHaveBeenCalledWith(SPREADSHEET_ID, 'Limpieza', 'Otros');
      expect(catRepo.deleteCategory).toHaveBeenCalledWith(SPREADSHEET_ID, 3);
    });

    it('updates rules that reference the deleted category', async () => {
      const rules: Rule[] = [
        { pattern: 'lejia', normalized: 'Lejía', category: 'Limpieza' },
        { pattern: 'coca cola', normalized: 'Coca Cola', category: 'Bebidas' },
        { pattern: 'jabon', normalized: 'Jabón', category: 'Limpieza' },
      ];
      const catRepo = createMockCategoryRepo();
      const ruleRepo = createMockRuleRepo(rules);
      const uc = new ManageCategories(catRepo, ruleRepo);

      await uc.deleteWithCascade(SPREADSHEET_ID, 5, 'Limpieza', 'Otros');

      expect(ruleRepo.updateRule).toHaveBeenCalledTimes(2);
      expect(ruleRepo.updateRule).toHaveBeenCalledWith(
        SPREADSHEET_ID, 2, { pattern: 'lejia', normalized: 'Lejía', category: 'Otros' },
      );
      expect(ruleRepo.updateRule).toHaveBeenCalledWith(
        SPREADSHEET_ID, 4, { pattern: 'jabon', normalized: 'Jabón', category: 'Otros' },
      );
    });

    it('does not update rules that reference other categories', async () => {
      const rules: Rule[] = [
        { pattern: 'coca cola', normalized: 'Coca Cola', category: 'Bebidas' },
      ];
      const catRepo = createMockCategoryRepo();
      const ruleRepo = createMockRuleRepo(rules);
      const uc = new ManageCategories(catRepo, ruleRepo);

      await uc.deleteWithCascade(SPREADSHEET_ID, 3, 'Limpieza', 'Otros');

      expect(ruleRepo.updateRule).not.toHaveBeenCalled();
    });

    it('skips cascade when replacement is empty string', async () => {
      const catRepo = createMockCategoryRepo();
      const ruleRepo = createMockRuleRepo();
      const uc = new ManageCategories(catRepo, ruleRepo);

      await uc.deleteWithCascade(SPREADSHEET_ID, 3, 'Limpieza', '');

      expect(catRepo.updateCategoryInGastos).not.toHaveBeenCalled();
      expect(ruleRepo.getRules).not.toHaveBeenCalled();
      expect(catRepo.deleteCategory).toHaveBeenCalledWith(SPREADSHEET_ID, 3);
    });

    it('runs gastos update and rules fetch in parallel', async () => {
      const callOrder: string[] = [];
      const catRepo = createMockCategoryRepo({
        updateCategoryInGastos: vi.fn<CategoryRepository['updateCategoryInGastos']>().mockImplementation(async () => {
          callOrder.push('updateGastos');
        }),
      });
      const ruleRepo = createMockRuleRepo();
      (ruleRepo.getRules as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('getRules');
        return [];
      });
      const uc = new ManageCategories(catRepo, ruleRepo);

      await uc.deleteWithCascade(SPREADSHEET_ID, 3, 'Limpieza', 'Otros');

      // Both should have been called (Promise.all)
      expect(callOrder).toContain('updateGastos');
      expect(callOrder).toContain('getRules');
    });

    it('always deletes the category row even with no rules to update', async () => {
      const catRepo = createMockCategoryRepo();
      const ruleRepo = createMockRuleRepo([]);
      const uc = new ManageCategories(catRepo, ruleRepo);

      await uc.deleteWithCascade(SPREADSHEET_ID, 7, 'Higiene', 'Otros');

      expect(catRepo.deleteCategory).toHaveBeenCalledWith(SPREADSHEET_ID, 7);
    });

    it('propagates errors from category repository', async () => {
      const catRepo = createMockCategoryRepo({
        updateCategoryInGastos: vi.fn<CategoryRepository['updateCategoryInGastos']>().mockRejectedValue(new Error('API error')),
      });
      const ruleRepo = createMockRuleRepo();
      const uc = new ManageCategories(catRepo, ruleRepo);

      await expect(uc.deleteWithCascade(SPREADSHEET_ID, 3, 'Limpieza', 'Otros'))
        .rejects.toThrow('API error');
    });

    it('propagates errors from rule repository', async () => {
      const catRepo = createMockCategoryRepo();
      const ruleRepo = createMockRuleRepo();
      (ruleRepo.getRules as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('401'));
      const uc = new ManageCategories(catRepo, ruleRepo);

      await expect(uc.deleteWithCascade(SPREADSHEET_ID, 3, 'Limpieza', 'Otros'))
        .rejects.toThrow('401');
    });
  });
});
