import { OmniSettings, SettingKey, SheetsValuesResponse } from '../../types';
import { SHEETS_API, SheetName } from '../../lib/constants';
import { authHeaders, jsonAuthHeaders } from '../../lib/utils';
import { apiFetch } from '../../services/apiFetch';
import type { ConfigRepository } from '../../application/ports/ConfigRepository';

/**
 * Implements the settings read/write portion of ConfigRepository using Google Sheets API.
 * Handles reading and updating key-value settings from the Config sheet.
 *
 * Note: This does NOT implement the full ConfigRepository interface — bootstrap
 * and migration logic live in DatabaseBootstrap. ConfigService composes both.
 */
export class SheetsConfigRepo {
  constructor(private accessToken: string) {}

  private get auth()     { return authHeaders(this.accessToken); }
  private get jsonAuth() { return jsonAuthHeaders(this.accessToken); }

  async getSettings(spreadsheetId: string): Promise<OmniSettings> {
    const response = await apiFetch(`${SHEETS_API}/${spreadsheetId}/values/${SheetName.SETTINGS}!A:B`, {
      headers: this.auth
    });
    const data: SheetsValuesResponse = await response.json();
    const rows = data.values ?? [];
    const settings: OmniSettings = { GMAIL_SEARCH_LABEL: 'OmniTicket', GMAIL_PROCESSED_LABEL: 'OmniTicket/Procesado', GEMINI_API_KEY: '', LAST_SYNC: 'Nunca' };

    const validKeys: ReadonlySet<string> = new Set<SettingKey>(['GMAIL_SEARCH_LABEL', 'GMAIL_PROCESSED_LABEL', 'GEMINI_API_KEY', 'LAST_SYNC']);
    for (const row of rows) {
      const key = (row[0] ?? '').trim();
      const val = (row[1] ?? '').trim();
      if (validKeys.has(key)) {
        settings[key as keyof OmniSettings] = val;
      }
    }
    return settings;
  }

  async updateSetting(spreadsheetId: string, key: Exclude<SettingKey, 'LAST_SYNC'>, value: string): Promise<void> {
    const rowMap: Record<Exclude<SettingKey, 'LAST_SYNC'>, number> = {
      GMAIL_SEARCH_LABEL: 1,
      GMAIL_PROCESSED_LABEL: 2,
      GEMINI_API_KEY: 3,
    };
    const row = rowMap[key];
    if (!row) return;
    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.SETTINGS}!B${row}?valueInputOption=RAW`,
      { method: 'PUT', headers: this.jsonAuth, body: JSON.stringify({ values: [[String(value).trim()]] }) }
    );
  }

  async updateLastSync(spreadsheetId: string): Promise<void> {
    const now = new Date().toLocaleString();
    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.SETTINGS}!B4?valueInputOption=RAW`,
      { method: 'PUT', headers: this.jsonAuth, body: JSON.stringify({ values: [[String(now)]] }) }
    );
  }
}
