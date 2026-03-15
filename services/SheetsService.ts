
import { TicketData, Rule, Category, SheetsValuesResponse, SheetsMetadataResponse } from '../types';
import { TOTAL_TICKET_MARKER, GastosCol, SHEETS_API, SheetName } from '../lib/constants';
import { authHeaders, jsonAuthHeaders, catchNonAuth } from '../lib/utils';
import { apiFetch } from './apiFetch';

export class SheetsService {
  constructor(private accessToken: string) {}

  private get auth()     { return authHeaders(this.accessToken); }
  private get jsonAuth() { return jsonAuthHeaders(this.accessToken); }

  // ─── GASTOS ───────────────────────────────────────────────────────────────

  async appendExpense(spreadsheetId: string, data: TicketData): Promise<void> {
    const itemRows = data.items.map(item => [
      data.id, data.tienda, data.fecha,
      item.nombre, item.categoria,
      item.cantidad, item.precio_unitario, item.descuento, item.precio_total_linea,
      item.nombre_normalizado ?? ''
    ]);
    const totalRow = [
      data.id, data.tienda, data.fecha, TOTAL_TICKET_MARKER, 'TOTAL', '', '', '', data.total_ticket, ''
    ];
    const values = [...itemRows, totalRow];
    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.GASTOS}!A:J:append?valueInputOption=USER_ENTERED`,
      { method: 'POST', headers: this.jsonAuth, body: JSON.stringify({ values }) }
    );
  }

  async fetchAllLineItems(spreadsheetId: string): Promise<string[][]> {
    const response = await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.GASTOS}!A2:J`,
      { headers: this.auth }
    );
    const data: SheetsValuesResponse = await response.json();
    return data.values ?? [];
  }

  // ─── CATEGORIES ───────────────────────────────────────────────────────────

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
    } catch (err) {
      return catchNonAuth(err, '[SheetsService] getCategories failed:', []);
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
    const sheetId = await this.getSheetNumericId(spreadsheetId, SheetName.CATEGORIES);
    if (sheetId === null) return;
    await this.deleteRow(spreadsheetId, sheetId, rowIndex);
  }

  /** Batch-replaces all rows in Gastos!E where category === oldName with newName */
  async updateCategoryInGastos(spreadsheetId: string, oldName: string, newName: string): Promise<void> {
    const rows = await this.fetchAllLineItems(spreadsheetId);
    const batchData: { range: string; values: string[][] }[] = [];

    rows.forEach((row: string[], index: number) => {
      const rowNum = index + 2; // +2: row 1 is header, array is 0-indexed
      if ((row[GastosCol.CATEGORIA] ?? '') === oldName) {
        batchData.push({ range: `${SheetName.GASTOS}!E${rowNum}`, values: [[newName]] });
      }
    });

    if (batchData.length === 0) return;

    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
      { method: 'POST', headers: this.jsonAuth, body: JSON.stringify({ valueInputOption: 'RAW', data: batchData }) }
    );
  }

  // ─── RULES ────────────────────────────────────────────────────────────────

  async getRules(spreadsheetId: string): Promise<Rule[]> {
    try {
      const response = await apiFetch(
        `${SHEETS_API}/${spreadsheetId}/values/${SheetName.RULES}!A2:C1000`,
        { headers: this.auth }
      );
      const data: SheetsValuesResponse = await response.json();
      return (data.values ?? []).map((row: string[]) => ({
        pattern: row[0] || '',
        normalized: row[1] || '',
        category: row[2] || 'Otros'
      }));
    } catch (err) {
      return catchNonAuth(err, '[SheetsService] getRules failed:', []);
    }
  }

  async addRule(spreadsheetId: string, rule: Rule): Promise<void> {
    const values = [[rule.pattern, rule.normalized, rule.category]];
    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.RULES}!A:C:append?valueInputOption=RAW`,
      { method: 'POST', headers: this.jsonAuth, body: JSON.stringify({ values }) }
    );
  }

  async updateRule(spreadsheetId: string, rowIndex: number, rule: Rule): Promise<void> {
    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.RULES}!A${rowIndex}:C${rowIndex}?valueInputOption=RAW`,
      { method: 'PUT', headers: this.jsonAuth, body: JSON.stringify({ values: [[rule.pattern, rule.normalized, rule.category]] }) }
    );
  }

  async deleteRule(spreadsheetId: string, rowIndex: number): Promise<void> {
    const sheetId = await this.getSheetNumericId(spreadsheetId, SheetName.RULES);
    if (sheetId === null) return;
    await this.deleteRow(spreadsheetId, sheetId, rowIndex);
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  /** Deletes a single row by its 1-based index from a sheet identified by numeric ID. */
  private async deleteRow(spreadsheetId: string, sheetId: number, rowIndex: number): Promise<void> {
    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: this.jsonAuth,
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
            }
          }]
        })
      }
    );
  }

  private async getSheetNumericId(spreadsheetId: string, sheetName: string): Promise<number | null> {
    try {
      const response = await apiFetch(
        `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`,
        { headers: this.auth }
      );
      const data: SheetsMetadataResponse = await response.json();
      const sheet = (data.sheets ?? []).find(s => s.properties?.title === sheetName);
      return sheet?.properties?.sheetId ?? null;
    } catch (err) {
      return catchNonAuth(err, `[SheetsService] getSheetNumericId('${sheetName}') failed:`, null);
    }
  }
}
