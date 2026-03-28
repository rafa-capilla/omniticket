import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseBootstrap } from '../DatabaseBootstrap';
import { NotFoundError } from '@/domain/errors';
import { SheetName } from '@/lib/constants';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/infrastructure/google-api/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/infrastructure/google-api/apiFetch';
const mockApiFetch = vi.mocked(apiFetch);

const TOKEN = 'test-token';

// ─── Helpers ───────────────────────────────────────────────────────────────

function jsonResponse(data: unknown): Response {
  return { ok: true, json: () => Promise.resolve(data) } as Response;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('DatabaseBootstrap', () => {
  let bootstrap: DatabaseBootstrap;

  beforeEach(() => {
    mockApiFetch.mockReset();
    bootstrap = new DatabaseBootstrap(TOKEN);
  });

  describe('findSpreadsheet', () => {
    it('returns the spreadsheet ID when found', async () => {
      mockApiFetch.mockResolvedValueOnce(
        jsonResponse({ files: [{ id: 'found-id', name: 'OmniTicket_DB' }] }),
      );

      const id = await bootstrap.findSpreadsheet();

      expect(id).toBe('found-id');
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      const url = mockApiFetch.mock.calls[0]![0] as string;
      expect(url).toContain('drive/v3/files');
      expect(url).toContain('OmniTicket_DB');
    });

    it('throws NotFoundError when no files returned', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({ files: [] }));

      await expect(bootstrap.findSpreadsheet()).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when files array is undefined', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

      await expect(bootstrap.findSpreadsheet()).rejects.toThrow(NotFoundError);
    });

    it('converts non-string file IDs to string', async () => {
      mockApiFetch.mockResolvedValueOnce(
        jsonResponse({ files: [{ id: 12345, name: 'OmniTicket_DB' }] }),
      );

      const id = await bootstrap.findSpreadsheet();

      expect(id).toBe('12345');
      expect(typeof id).toBe('string');
    });
  });

  describe('createSpreadsheet', () => {
    it('creates a spreadsheet with correct sheets and initializes data', async () => {
      const spreadsheetId = 'new-sheet-id';

      // 1. POST to create spreadsheet
      mockApiFetch.mockResolvedValueOnce(
        jsonResponse({ spreadsheetId }),
      );
      // 2. batchUpdate values (initializeSheets)
      mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

      const id = await bootstrap.createSpreadsheet();

      expect(id).toBe(spreadsheetId);

      // Verify spreadsheet creation request
      const createCall = mockApiFetch.mock.calls[0]!;
      expect(createCall[1]!.method).toBe('POST');
      const createBody = JSON.parse(createCall[1]!.body as string);
      expect(createBody.properties.title).toBe('OmniTicket_DB');

      const sheetTitles = createBody.sheets.map((s: { properties: { title: string } }) => s.properties.title);
      expect(sheetTitles).toContain(SheetName.SETTINGS);
      expect(sheetTitles).toContain(SheetName.GASTOS);
      expect(sheetTitles).toContain(SheetName.RULES);
    });

    it('initializes sheets with correct headers and settings', async () => {
      mockApiFetch
        .mockResolvedValueOnce(jsonResponse({ spreadsheetId: 'new-id' }))
        .mockResolvedValueOnce(jsonResponse({}));

      await bootstrap.createSpreadsheet();

      // Verify initializeSheets batchUpdate
      const initCall = mockApiFetch.mock.calls[1]!;
      const initBody = JSON.parse(initCall[1]!.body as string);
      expect(initBody.valueInputOption).toBe('RAW');
      expect(initBody.data).toHaveLength(3); // Settings, Gastos headers, Rules headers

      // Settings data
      const settingsData = initBody.data[0];
      expect(settingsData.values[0]).toEqual(['GMAIL_SEARCH_LABEL', 'OmniTicket']);
      expect(settingsData.values[1]).toEqual(['GMAIL_PROCESSED_LABEL', 'OmniTicket/Procesado']);
      expect(settingsData.values[2]).toEqual(['GEMINI_API_KEY', '']);
      expect(settingsData.values[3]).toEqual(['LAST_SYNC', 'Nunca']);

      // Gastos headers
      const gastosHeaders = initBody.data[1];
      expect(gastosHeaders.values[0]).toHaveLength(10); // A:J

      // Rules headers
      const rulesHeaders = initBody.data[2];
      expect(rulesHeaders.values[0]).toEqual(['Original_Pattern', 'Normalized_Name', 'Category']);
    });

    it('throws when API returns no spreadsheetId', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

      await expect(bootstrap.createSpreadsheet()).rejects.toThrow(
        'Google Sheets API returned no spreadsheetId',
      );
    });

    it('includes Authorization header in requests', async () => {
      mockApiFetch
        .mockResolvedValueOnce(jsonResponse({ spreadsheetId: 'id' }))
        .mockResolvedValueOnce(jsonResponse({}));

      await bootstrap.createSpreadsheet();

      const headers = mockApiFetch.mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`Bearer ${TOKEN}`);
    });
  });

  describe('defaultCategories', () => {
    it('returns the 7 default categories', () => {
      const categories = DatabaseBootstrap.defaultCategories;

      expect(categories).toHaveLength(7);
      expect(categories[0]![0]).toBe('Lácteos');
      expect(categories[6]![0]).toBe('Otros');
    });

    it('all categories have active status', () => {
      const categories = DatabaseBootstrap.defaultCategories;

      for (const cat of categories) {
        expect(cat[2]).toBe('active');
      }
    });

    it('all categories have 3 columns (name, description, status)', () => {
      const categories = DatabaseBootstrap.defaultCategories;

      for (const cat of categories) {
        expect(cat).toHaveLength(3);
      }
    });
  });
});
