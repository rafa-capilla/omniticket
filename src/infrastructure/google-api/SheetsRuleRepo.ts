import type { Rule } from '@/shared/types/domain';
import type { SheetsValuesResponse } from '@/shared/types/google-api';
import { SHEETS_API, SheetName } from '@/lib/constants';
import { authHeaders, jsonAuthHeaders, catchNonAuth } from '@/lib/utils';
import { apiFetch } from '@/infrastructure/google-api/apiFetch';
import { SheetsHelpers } from '@/infrastructure/google-api/SheetsHelpers';
import type { RuleRepository } from '@/application/ports/RuleRepository';

/**
 * Implements RuleRepository using Google Sheets API.
 */
export class SheetsRuleRepo implements RuleRepository {
  private readonly helpers: SheetsHelpers;

  constructor(private accessToken: string) {
    this.helpers = new SheetsHelpers(accessToken);
  }

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
    const sheetId = await this.helpers.getSheetNumericId(spreadsheetId, SheetName.RULES, 'SheetsRuleRepo');
    if (sheetId === null) return;
    await this.helpers.deleteRow(spreadsheetId, sheetId, rowIndex);
  }
}
