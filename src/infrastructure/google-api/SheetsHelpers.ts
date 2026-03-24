import type { SheetsMetadataResponse } from '@/shared/types/google-api';
import { SHEETS_API } from '@/lib/constants';
import { authHeaders, jsonAuthHeaders, catchNonAuth } from '@/lib/utils';
import { apiFetch } from '@/infrastructure/google-api/apiFetch';

/**
 * Shared helpers for Google Sheets row-level operations.
 * Eliminates duplication of deleteRow() and getSheetNumericId() across repos.
 */
export class SheetsHelpers {
  constructor(private accessToken: string) {}

  private get auth()     { return authHeaders(this.accessToken); }
  private get jsonAuth() { return jsonAuthHeaders(this.accessToken); }

  async deleteRow(spreadsheetId: string, sheetId: number, rowIndex: number): Promise<void> {
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

  async getSheetNumericId(spreadsheetId: string, sheetName: string, context: string): Promise<number | null> {
    try {
      const response = await apiFetch(
        `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`,
        { headers: this.auth }
      );
      const data: SheetsMetadataResponse = await response.json();
      const sheet = (data.sheets ?? []).find(s => s.properties?.title === sheetName);
      return sheet?.properties?.sheetId ?? null;
    } catch (err: unknown) {
      return catchNonAuth(err, `[${context}] getSheetNumericId('${sheetName}') failed:`, null);
    }
  }
}
