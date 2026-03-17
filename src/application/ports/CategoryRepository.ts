import type { Category } from '@/shared/types/domain';

/**
 * Port for category persistence operations.
 * Abstracts how categories are stored and retrieved.
 */
export interface CategoryRepository {
  getCategories(spreadsheetId: string): Promise<Category[]>;
  addCategory(spreadsheetId: string, cat: Category): Promise<void>;
  updateCategory(spreadsheetId: string, rowIndex: number, cat: Category): Promise<void>;
  deleteCategory(spreadsheetId: string, rowIndex: number): Promise<void>;
  updateCategoryInGastos(spreadsheetId: string, oldName: string, newName: string): Promise<void>;
}
