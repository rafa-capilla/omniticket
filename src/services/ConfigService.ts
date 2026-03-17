import type { OmniSettings, SettingKey } from '@/shared/types/domain';
import { SheetsConfigRepo } from '@/infrastructure/google-api/SheetsConfigRepo';
import { DatabaseBootstrap } from '@/infrastructure/bootstrap/DatabaseBootstrap';
import { runMigrations } from '@/infrastructure/bootstrap/migrations';

/**
 * Servicio de gestión de configuración persistente en Google Sheets.
 * Facade that delegates to SheetsConfigRepo (settings) and DatabaseBootstrap (creation/migrations).
 */
export class ConfigService {
  private spreadsheetId: string | null = null;
  private readonly configRepo: SheetsConfigRepo;
  private readonly bootstrap: DatabaseBootstrap;

  constructor(private accessToken: string) {
    this.configRepo = new SheetsConfigRepo(accessToken);
    this.bootstrap = new DatabaseBootstrap(accessToken);
  }

  async getOrFindId(): Promise<string> {
    if (this.spreadsheetId) return this.spreadsheetId;
    const id = await this.bootstrap.findSpreadsheet();
    this.spreadsheetId = id;
    return id;
  }

  /**
   * Asegura que la base de datos (spreadsheet) existe, está inicializada
   * y tiene las migraciones aplicadas (hoja Categories, col J en Gastos).
   */
  async ensureDatabase(): Promise<{ settings: OmniSettings, dbId: string }> {
    let id: string;
    try {
      id = await this.getOrFindId();
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "401") throw e;
      if (!(e instanceof Error) || e.message !== "NOT_FOUND") throw e;

      id = await this.bootstrap.createSpreadsheet();
      this.spreadsheetId = id;
    }

    await runMigrations(this.accessToken, id);
    const settings = await this.getSettings(id);
    return { settings, dbId: id };
  }

  async getSettings(forcedId?: string): Promise<OmniSettings> {
    const id = forcedId || await this.getOrFindId();
    return this.configRepo.getSettings(id);
  }

  async updateSetting(key: Exclude<SettingKey, 'LAST_SYNC'>, value: string): Promise<void> {
    const id = await this.getOrFindId();
    return this.configRepo.updateSetting(id, key, value);
  }

  async updateGeminiKey(key: string): Promise<void> {
    return this.updateSetting('GEMINI_API_KEY', key);
  }

  async updateLastSync(): Promise<void> {
    const id = await this.getOrFindId();
    return this.configRepo.updateLastSync(id);
  }
}
