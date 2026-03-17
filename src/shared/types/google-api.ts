/**
 * Minimal subsets of Google API responses actually consumed by the app.
 * Typing these prevents implicit `any` on `response.json()` call-sites.
 */

/** Google Sheets API - values.get / values.batchGet */
export interface SheetsValuesResponse {
  values?: string[][];
  range?: string;
  majorDimension?: string;
}

/** Google Sheets API - spreadsheets.get (fields=sheets.properties) */
export interface SheetsMetadataResponse {
  sheets?: Array<{
    properties?: {
      title?: string;
      sheetId?: number;
    };
  }>;
}

/** Google Drive API - files.list */
export interface DriveFilesResponse {
  files?: Array<{
    id: string;
    name: string;
  }>;
}

/** Gmail threads.list */
export interface GmailThreadsResponse {
  threads?: Array<{ id: string }>;
}

/** Gmail threads.get */
export interface GmailThreadResponse {
  messages?: Array<{
    payload?: GmailPayload;
  }>;
}

/** Gmail payload structure (recursive for multipart) */
export interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
}

/** Gmail labels.list */
export interface GmailLabelsResponse {
  labels?: Array<{ id: string; name: string }>;
}

/** Gmail labels.create */
export interface GmailLabelResponse {
  id: string;
}
