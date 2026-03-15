import { OmniSettings, SettingKey } from '../../shared/types/domain';

/**
 * Port for configuration persistence operations.
 * Abstracts how app configuration is stored and retrieved.
 */
export interface ConfigRepository {
  getOrFindId(): Promise<string>;
  ensureDatabase(): Promise<{ settings: OmniSettings; dbId: string }>;
  getSettings(forcedId?: string): Promise<OmniSettings>;
  updateSetting(key: Exclude<SettingKey, 'LAST_SYNC'>, value: string): Promise<void>;
  updateLastSync(): Promise<void>;
}
