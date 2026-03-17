import type { Rule } from '@/shared/types/domain';
import type { SheetsValuesResponse, SheetsMetadataResponse } from '@/shared/types/google-api';
import { SHEETS_API, SheetName } from '@/lib/constants';
import { authHeaders, jsonAuthHeaders, catchNonAuth } from '@/lib/utils';
import { apiFetch } from '@/infrastructure/google-api/apiFetch';
import type { RuleRepository } from '@/application/ports/RuleRepository';

/**
 * Implements RuleRepository using Google Sheets API.
 */
export class SheetsRuleRepo implements RuleRepository {
  constructor(private accessToken: string) {}

  private get auth()     { return authHeaders(this.accessToken); }
  private get jsonAuth() { return jsonAuthHeaders(this.accessToken); }

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
      return catchNonAuth(err, '[SheetsRuleRepo] getRules failed:', []);
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
      return catchNonAuth(err, `[SheetsRuleRepo] getSheetNumericId('${sheetName}') failed:`, null);
    }
  }
}
