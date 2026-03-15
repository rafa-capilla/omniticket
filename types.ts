/**
 * Re-exports all types from their canonical locations in shared/types/.
 * Maintains backward compatibility for existing imports from './types'.
 */
export type {
  CategoryStatus,
  SettingKey,
  OmniSettings,
  SyncStatus,
  SyncResult,
  TicketItem,
  TicketData,
  HistoryTicket,
  Rule,
  Category,
  DashboardStats,
  AIAnalysisResult,
  AggregatedData,
  GastosRow,
  ViewState,
  LensType,
} from './shared/types/domain';

export type {
  SheetsValuesResponse,
  SheetsMetadataResponse,
  DriveFilesResponse,
} from './shared/types/google-api';
