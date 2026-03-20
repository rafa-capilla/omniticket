import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../ConfigService';
import { AuthExpiredError, NotFoundError } from '@/domain/errors';

vi.mock('@/infrastructure/google-api/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/infrastructure/google-api/apiFetch';
const mockApiFetch = vi.mocked(apiFetch);

const TOKEN = 'test-token';
const SPREADSHEET_ID = 'spreadsheet-123';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

// ─── getOrFindId ────────────────────────────────────────────────────────────

describe('ConfigService.getOrFindId', () => {
  it('searches Drive and returns the spreadsheet ID', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );

    const config = new ConfigService(TOKEN);
    const id = await config.getOrFindId();

    expect(id).toBe(SPREADSHEET_ID);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch.mock.calls[0]![0]).toContain('drive/v3/files');
  });

  it('caches the ID after first lookup', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );

    const config = new ConfigService(TOKEN);
    await config.getOrFindId();
    await config.getOrFindId();

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when no spreadsheet exists', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ files: [] }));

    const config = new ConfigService(TOKEN);
    await expect(config.getOrFindId()).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when files array is absent', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}));

    const config = new ConfigService(TOKEN);
    await expect(config.getOrFindId()).rejects.toThrow(NotFoundError);
  });
});

// ─── getSettings ────────────────────────────────────────────────────────────

describe('ConfigService.getSettings', () => {
  it('parses settings rows into OmniSettings with correct defaults', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        values: [
          ['GMAIL_SEARCH_LABEL', 'MiLabel'],
          ['GMAIL_PROCESSED_LABEL', 'MiLabel/Procesado'],
          ['GEMINI_API_KEY', 'api-key-123'],
          ['LAST_SYNC', '2025-01-15 10:30'],
        ],
      })
    );

    const config = new ConfigService(TOKEN);
    const settings = await config.getSettings(SPREADSHEET_ID);

    expect(settings).toEqual({
      GMAIL_SEARCH_LABEL: 'MiLabel',
      GMAIL_PROCESSED_LABEL: 'MiLabel/Procesado',
      GEMINI_API_KEY: 'api-key-123',
      LAST_SYNC: '2025-01-15 10:30',
    });
  });

  it('returns defaults when settings sheet is empty', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}));

    const config = new ConfigService(TOKEN);
    const settings = await config.getSettings(SPREADSHEET_ID);

    expect(settings).toEqual({
      GMAIL_SEARCH_LABEL: 'OmniTicket',
      GMAIL_PROCESSED_LABEL: 'OmniTicket/Procesado',
      GEMINI_API_KEY: '',
      LAST_SYNC: 'Nunca',
    });
  });

  it('trims whitespace from keys and values', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        values: [
          ['  GEMINI_API_KEY  ', '  key-with-spaces  '],
        ],
      })
    );

    const config = new ConfigService(TOKEN);
    const settings = await config.getSettings(SPREADSHEET_ID);

    expect(settings.GEMINI_API_KEY).toBe('key-with-spaces');
  });

  it('uses cached spreadsheet ID when no forcedId provided', async () => {
    // First call: Drive lookup
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );
    // Second call: Settings fetch
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ values: [] }));

    const config = new ConfigService(TOKEN);
    await config.getOrFindId();
    await config.getSettings();

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(mockApiFetch.mock.calls[1]![0]).toContain(`spreadsheets/${SPREADSHEET_ID}/values/Settings`);
  });

  it('ignores unrecognized setting keys', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        values: [
          ['UNKNOWN_KEY', 'some value'],
          ['GEMINI_API_KEY', 'real-key'],
        ],
      })
    );

    const config = new ConfigService(TOKEN);
    const settings = await config.getSettings(SPREADSHEET_ID);

    expect(settings.GEMINI_API_KEY).toBe('real-key');
    expect(settings.GMAIL_SEARCH_LABEL).toBe('OmniTicket');
  });
});

// ─── updateSetting ──────────────────────────────────────────────────────────

describe('ConfigService.updateSetting', () => {
  it('writes to the correct row for GEMINI_API_KEY (row 3)', async () => {
    // Drive lookup
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );
    // PUT update
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

    const config = new ConfigService(TOKEN);
    await config.updateSetting('GEMINI_API_KEY', '  new-key  ');

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    const [url, init] = mockApiFetch.mock.calls[1]!;
    expect(url).toContain('Settings!B3');
    expect(init?.method).toBe('PUT');
    const body = JSON.parse(init?.body as string);
    expect(body.values).toEqual([['new-key']]);
  });

  it('writes to the correct row for GMAIL_SEARCH_LABEL (row 1)', async () => {
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

    const config = new ConfigService(TOKEN);
    await config.updateSetting('GMAIL_SEARCH_LABEL', 'MyLabel');

    const [url] = mockApiFetch.mock.calls[1]!;
    expect(url).toContain('Settings!B1');
  });

  it('writes to the correct row for GMAIL_PROCESSED_LABEL (row 2)', async () => {
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

    const config = new ConfigService(TOKEN);
    await config.updateSetting('GMAIL_PROCESSED_LABEL', 'MyLabel/Done');

    const [url] = mockApiFetch.mock.calls[1]!;
    expect(url).toContain('Settings!B2');
  });
});

// ─── updateGeminiKey ────────────────────────────────────────────────────────

describe('ConfigService.updateGeminiKey', () => {
  it('delegates to updateSetting with GEMINI_API_KEY', async () => {
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

    const config = new ConfigService(TOKEN);
    await config.updateGeminiKey('my-api-key');

    const [url] = mockApiFetch.mock.calls[1]!;
    expect(url).toContain('Settings!B3');
    const body = JSON.parse(mockApiFetch.mock.calls[1]![1]?.body as string);
    expect(body.values).toEqual([['my-api-key']]);
  });
});

// ─── updateLastSync ─────────────────────────────────────────────────────────

describe('ConfigService.updateLastSync', () => {
  it('writes current timestamp to Settings!B4', async () => {
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

    const config = new ConfigService(TOKEN);
    await config.updateLastSync();

    const [url, init] = mockApiFetch.mock.calls[1]!;
    expect(url).toContain('Settings!B4');
    expect(init?.method).toBe('PUT');
    const body = JSON.parse(init?.body as string);
    expect(body.values[0]![0]).toBeTruthy();
  });
});

// ─── ensureDatabase ─────────────────────────────────────────────────────────

describe('ConfigService.ensureDatabase', () => {
  it('re-throws AuthExpiredError from getOrFindId', async () => {
    mockApiFetch.mockRejectedValue(new AuthExpiredError());

    const config = new ConfigService(TOKEN);
    await expect(config.ensureDatabase()).rejects.toThrow(AuthExpiredError);
  });

  it('re-throws non-NotFoundError errors instead of creating duplicates', async () => {
    mockApiFetch.mockRejectedValue(new Error('Error HTTP 500'));

    const config = new ConfigService(TOKEN);
    await expect(config.ensureDatabase()).rejects.toThrow('Error HTTP 500');
  });

  it('creates a new spreadsheet when NotFoundError', async () => {
    // 1. Drive lookup → no files
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ files: [] }));
    // 2. Create spreadsheet
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ spreadsheetId: SPREADSHEET_ID }));
    // 3. Batch update with initial data
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}));
    // 4-8. Migrations: meta, settings keys, gastos, settings marker, header check
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ sheets: [{ properties: { title: 'Settings' } }, { properties: { title: 'Gastos' } }, { properties: { title: 'Rules' } }, { properties: { title: 'Categories' } }] }));
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ values: [['GMAIL_SEARCH_LABEL'], ['GMAIL_PROCESSED_LABEL'], ['GEMINI_API_KEY'], ['LAST_SYNC']] }));
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ values: [] })); // gastos for migration
    mockApiFetch.mockResolvedValueOnce(jsonResponse({})); // mark migration
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ values: [['Producto Normalizado']] })); // header check
    // 9. getSettings
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({
        values: [
          ['GMAIL_SEARCH_LABEL', 'OmniTicket'],
          ['GMAIL_PROCESSED_LABEL', 'OmniTicket/Procesado'],
          ['GEMINI_API_KEY', ''],
          ['LAST_SYNC', 'Nunca'],
        ],
      })
    );

    const config = new ConfigService(TOKEN);
    const result = await config.ensureDatabase();

    expect(result.dbId).toBe(SPREADSHEET_ID);
    expect(result.settings.GMAIL_SEARCH_LABEL).toBe('OmniTicket');

    // Verify spreadsheet creation call
    const createCall = mockApiFetch.mock.calls[1]!;
    expect(createCall[0]).toContain('sheets.googleapis.com/v4/spreadsheets');
    expect(createCall[1]?.method).toBe('POST');
    const createBody = JSON.parse(createCall[1]?.body as string);
    expect(createBody.properties.title).toBe('OmniTicket_DB');
  });

  it('runs migrations on existing spreadsheet that needs Categories sheet', async () => {
    // 1. Drive lookup → found
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );
    // 2. Migration: fetch sheet metadata (no Categories)
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ sheets: [{ properties: { title: 'Settings' } }, { properties: { title: 'Gastos' } }, { properties: { title: 'Rules' } }] })
    );
    // 3. Create Categories sheet
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}));
    // 4. Populate Categories data
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}));
    // 5. Settings keys for discount migration check
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ values: [['GMAIL_SEARCH_LABEL'], ['GMAIL_PROCESSED_LABEL'], ['GEMINI_API_KEY'], ['LAST_SYNC'], ['MIGRATION_DISCOUNT_FIX']] })
    );
    // 6. Header check Gastos!J1
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ values: [['Producto Normalizado']] }));
    // 7. getSettings
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({
        values: [
          ['GMAIL_SEARCH_LABEL', 'OmniTicket'],
          ['GMAIL_PROCESSED_LABEL', 'OmniTicket/Procesado'],
          ['GEMINI_API_KEY', 'key-123'],
          ['LAST_SYNC', 'Nunca'],
        ],
      })
    );

    const config = new ConfigService(TOKEN);
    const result = await config.ensureDatabase();

    expect(result.dbId).toBe(SPREADSHEET_ID);
    expect(result.settings.GEMINI_API_KEY).toBe('key-123');

    // Verify Categories sheet creation was called
    const batchUpdateCall = mockApiFetch.mock.calls[2]!;
    expect(batchUpdateCall[0]).toContain('batchUpdate');
    const batchBody = JSON.parse(batchUpdateCall[1]?.body as string);
    expect(batchBody.requests[0]!.addSheet.properties.title).toBe('Categories');
  });

  it('skips Categories migration when sheet already exists', async () => {
    // 1. Drive lookup
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );
    // 2. Migration: sheet metadata (Categories already exists)
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ sheets: [{ properties: { title: 'Settings' } }, { properties: { title: 'Gastos' } }, { properties: { title: 'Rules' } }, { properties: { title: 'Categories' } }] })
    );
    // 3. Settings keys (migration already done)
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ values: [['GMAIL_SEARCH_LABEL'], ['GMAIL_PROCESSED_LABEL'], ['GEMINI_API_KEY'], ['LAST_SYNC'], ['MIGRATION_DISCOUNT_FIX']] })
    );
    // 4. Header check (already has header)
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ values: [['Producto Normalizado']] }));
    // 5. getSettings
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ values: [] }));

    const config = new ConfigService(TOKEN);
    const result = await config.ensureDatabase();

    expect(result.dbId).toBe(SPREADSHEET_ID);
    // No addSheet call should have been made - only 5 calls total
    expect(mockApiFetch).toHaveBeenCalledTimes(5);
  });

  it('non-auth migration errors are swallowed (non-fatal)', async () => {
    // 1. Drive lookup
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: SPREADSHEET_ID, name: 'OmniTicket_DB' }] })
    );
    // 2. Migration: metadata fetch fails (non-auth)
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ sheets: [] }));
    // Then internal migration calls may fail
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'));
    // getSettings should still work
    mockApiFetch.mockResolvedValueOnce(jsonResponse({ values: [] }));

    const config = new ConfigService(TOKEN);
    // Should not throw - migration errors are non-fatal
    const result = await config.ensureDatabase();
    expect(result.dbId).toBe(SPREADSHEET_ID);
  });
});
