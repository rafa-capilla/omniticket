
import { TicketData, Rule, Category } from '../types';
import { SheetsExpenseRepo } from '../infrastructure/google-api/SheetsExpenseRepo';
import { SheetsCategoryRepo } from '../infrastructure/google-api/SheetsCategoryRepo';
import { SheetsRuleRepo } from '../infrastructure/google-api/SheetsRuleRepo';

/**
 * Facade that delegates to specialized repositories.
 * Maintains the original public API for backward compatibility.
 */
export class SheetsService {
  private readonly expenses: SheetsExpenseRepo;
  private readonly categories: SheetsCategoryRepo;
  private readonly rules: SheetsRuleRepo;

  constructor(accessToken: string) {
    this.expenses = new SheetsExpenseRepo(accessToken);
    this.categories = new SheetsCategoryRepo(accessToken);
    this.rules = new SheetsRuleRepo(accessToken);
  }

  // ─── GASTOS ───────────────────────────────────────────────────────────────

  async appendExpense(spreadsheetId: string, data: TicketData): Promise<void> {
    return this.expenses.appendExpense(spreadsheetId, data);
  }

  async fetchAllLineItems(spreadsheetId: string): Promise<string[][]> {
    return this.expenses.fetchAllLineItems(spreadsheetId);
  }

  // ─── CATEGORIES ───────────────────────────────────────────────────────────

  async getCategories(spreadsheetId: string): Promise<Category[]> {
    return this.categories.getCategories(spreadsheetId);
  }

  async addCategory(spreadsheetId: string, cat: Category): Promise<void> {
    return this.categories.addCategory(spreadsheetId, cat);
  }

  async updateCategory(spreadsheetId: string, rowIndex: number, cat: Category): Promise<void> {
    return this.categories.updateCategory(spreadsheetId, rowIndex, cat);
  }

  async deleteCategory(spreadsheetId: string, rowIndex: number): Promise<void> {
    return this.categories.deleteCategory(spreadsheetId, rowIndex);
  }

  async updateCategoryInGastos(spreadsheetId: string, oldName: string, newName: string): Promise<void> {
    return this.categories.updateCategoryInGastos(spreadsheetId, oldName, newName);
  }

  // ─── RULES ────────────────────────────────────────────────────────────────

  async getRules(spreadsheetId: string): Promise<Rule[]> {
    return this.rules.getRules(spreadsheetId);
  }

  async addRule(spreadsheetId: string, rule: Rule): Promise<void> {
    return this.rules.addRule(spreadsheetId, rule);
  }

  async updateRule(spreadsheetId: string, rowIndex: number, rule: Rule): Promise<void> {
    return this.rules.updateRule(spreadsheetId, rowIndex, rule);
  }

  async deleteRule(spreadsheetId: string, rowIndex: number): Promise<void> {
    return this.rules.deleteRule(spreadsheetId, rowIndex);
  }
}
