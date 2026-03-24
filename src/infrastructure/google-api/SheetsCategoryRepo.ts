import type { Category } from '@/shared/types/domain';
import type { SheetsValuesResponse } from '@/shared/types/google-api';
import { GastosCol, SHEETS_API, SheetName, GASTOS_CATEGORIA_COL_LETTER } from '@/lib/constants';
import { authHeaders, jsonAuthHeaders, catchNonAuth } from '@/lib/utils';
import { apiFetch } from '@/infrastructure/google-api/apiFetch';
import { SheetsHelpers } from '@/infrastructure/google-api/SheetsHelpers';
import type { CategoryRepository } from '@/application/ports/CategoryRepository';

/**
 * Implements CategoryRepository using Google Sheets API.
 */
export class SheetsCategoryRepo implements CategoryRepository {
  private readonly helpers: SheetsHelpers;

  constructor(private accessToken: string) {
    this.helpers = new SheetsHelpers(accessToken);
  }

  private get auth()     { return authHeaders(this.accessToken); }
  private get jsonAuth() { return jsonAuthHeaders(this.accessToken); }

  async getCategories(spreadsheetId: string): Promise<Category[]> {
    try {
      const response = await apiFetch(
        `${SHEETS_API}/${spreadsheetId}/values/${SheetName.CATEGORIES}!A2:C1000`,
        { headers: this.auth }
      );
      const data: SheetsValuesResponse = await response.json();
      return (data.values ?? []).map((row: string[]) => ({
        name: String(row[0] || ''),
        description: String(row[1] || ''),
        status: String(row[2] || '').toLowerCase() === 'inactive' ? 'inactive' as const : 'active' as const,
      })).filter((c: Category) => c.name);
    } catch (err: unknown) {
      return catchNonAuth(err, '[SheetsCategoryRepo] getCategories failed:', []);
    }
  }

  async addCategory(spreadsheetId: string, cat: Category): Promise<void> {
    const values = [[cat.name, cat.description, cat.status]];
    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.CATEGORIES}!A:C:append?valueInputOption=RAW`,
      { method: 'POST', headers: this.jsonAuth, body: JSON.stringify({ values }) }
    );
  }

  async updateCategory(spreadsheetId: string, rowIndex: number, cat: Category): Promise<void> {
    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.CATEGORIES}!A${rowIndex}:C${rowIndex}?valueInputOption=RAW`,
      { method: 'PUT', headers: this.jsonAuth, body: JSON.stringify({ values: [[cat.name, cat.description, cat.status]] }) }
    );
  }

  async deleteCategory(spreadsheetId: string, rowIndex: number): Promise<void> {
    const sheetId = await this.helpers.getSheetNumericId(spreadsheetId, SheetName.CATEGORIES, 'SheetsCategoryRepo');
    if (sheetId === null) return;
    await this.helpers.deleteRow(spreadsheetId, sheetId, rowIndex);
  }

  async updateCategoryInGastos(spreadsheetId: string, oldName: string, newName: string): Promise<void> {
    const response = await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.GASTOS}!A2:J`,
      { headers: this.auth }
    );
    const data: SheetsValuesResponse = await response.json();
    const rows = data.values ?? [];
    const batchData: { range: string; values: string[][] }[] = [];

    rows.forEach((row: string[], index: number) => {
      const rowNum = index + 2;
      if ((row[GastosCol.CATEGORIA] ?? '') === oldName) {
        batchData.push({ range: `${SheetName.GASTOS}!${GASTOS_CATEGORIA_COL_LETTER}${rowNum}`, values: [[newName]] });
      }
    });

    if (batchData.length === 0) return;

    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
      { method: 'POST', headers: this.jsonAuth, body: JSON.stringify({ valueInputOption: 'RAW', data: batchData }) }
    );
  }

}
