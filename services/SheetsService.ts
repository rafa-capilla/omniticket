
import { TicketData, Rule, Category, SheetsValuesResponse, SheetsMetadataResponse } from '../types';
import { TOTAL_TICKET_MARKER, GastosCol } from '../lib/constants';
import { apiFetch } from './apiFetch';

export class SheetsService {
  constructor(private accessToken: string) {}

  // ─── GASTOS ───────────────────────────────────────────────────────────────

  async appendExpense(spreadsheetId: string, data: TicketData) {
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
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Gastos!A:J:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values })
      }
    );
  }

  async fetchAllLineItems(spreadsheetId: string): Promise<string[][]> {
    const response = await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Gastos!A2:J`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const data: SheetsValuesResponse = await response.json();
    return data.values ?? [];
  }

  // ─── CATEGORIES ───────────────────────────────────────────────────────────

  async getCategories(spreadsheetId: string): Promise<Category[]> {
    try {
      const response = await apiFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Categories!A2:C1000`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      const data: SheetsValuesResponse = await response.json();
      return (data.values ?? []).map((row: string[]) => ({
        name: String(row[0] || ''),
        description: String(row[1] || ''),
        status: String(row[2] || '').toLowerCase() === 'inactive' ? 'inactive' as const : 'active' as const,
      })).filter((c: Category) => c.name);
    } catch (err) {
      if (err instanceof Error && err.message === '401') throw err;
      console.error('[SheetsService] getCategories failed:', err);
      return [];
    }
  }

  async addCategory(spreadsheetId: string, cat: Category): Promise<void> {
    const values = [[cat.name, cat.description, cat.status]];
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Categories!A:C:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values })
      }
    );
  }

  async updateCategory(spreadsheetId: string, rowIndex: number, cat: Category): Promise<void> {
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Categories!A${rowIndex}:C${rowIndex}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[cat.name, cat.description, cat.status]] })
      }
    );
  }

  async deleteCategory(spreadsheetId: string, rowIndex: number): Promise<void> {
    const sheetId = await this.getSheetNumericId(spreadsheetId, 'Categories');
    if (sheetId === null) return;
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // 0-indexed
                endIndex: rowIndex
              }
            }
          }]
        })
      }
    );
  }

  /** Batch-replaces all rows in Gastos!E where category === oldName with newName */
  async updateCategoryInGastos(spreadsheetId: string, oldName: string, newName: string): Promise<void> {
    const rows = await this.fetchAllLineItems(spreadsheetId);
    const batchData: { range: string; values: string[][] }[] = [];

    rows.forEach((row: string[], index: number) => {
      const rowNum = index + 2; // +2: row 1 is header, array is 0-indexed
      const cat = row[GastosCol.CATEGORIA] ?? '';
      if (cat === oldName) {
        batchData.push({ range: `Gastos!E${rowNum}`, values: [[newName]] });
      }
    });

    if (batchData.length === 0) return;

    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: batchData })
      }
    );
  }

  // ─── RULES ────────────────────────────────────────────────────────────────

  async getRules(spreadsheetId: string): Promise<Rule[]> {
    try {
      const response = await apiFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Rules!A2:C1000`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      const data: SheetsValuesResponse = await response.json();
      return (data.values ?? []).map((row: string[]) => ({
        pattern: row[0] || '',
        normalized: row[1] || '',
        category: row[2] || 'Otros'
      }));
    } catch (err) {
      if (err instanceof Error && err.message === '401') throw err;
      console.error('[SheetsService] getRules failed:', err);
      return [];
    }
  }

  async addRule(spreadsheetId: string, rule: Rule): Promise<void> {
    const values = [[rule.pattern, rule.normalized, rule.category]];
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Rules!A:C:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values })
      }
    );
  }

  async updateRule(spreadsheetId: string, rowIndex: number, rule: Rule): Promise<void> {
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Rules!A${rowIndex}:C${rowIndex}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[rule.pattern, rule.normalized, rule.category]] })
      }
    );
  }

  async deleteRule(spreadsheetId: string, rowIndex: number): Promise<void> {
    const sheetId = await this.getSheetNumericId(spreadsheetId, 'Rules');
    if (sheetId === null) return;
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              }
            }
          }]
        })
      }
    );
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private async getSheetNumericId(spreadsheetId: string, sheetName: string): Promise<number | null> {
    try {
      const response = await apiFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      const data: SheetsMetadataResponse = await response.json();
      const sheet = (data.sheets ?? []).find(s => s.properties?.title === sheetName);
      return sheet?.properties?.sheetId ?? null;
    } catch (err) {
      if (err instanceof Error && err.message === '401') throw err;
      console.error(`[SheetsService] getSheetNumericId('${sheetName}') failed:`, err);
      return null;
    }
  }
}
