import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetsHelpers } from '../SheetsHelpers';
import { AuthExpiredError } from '@/domain/errors';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/infrastructure/google-api/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/infrastructure/google-api/apiFetch';
const mockApiFetch = vi.mocked(apiFetch);

const TOKEN = 'test-token';
const SPREADSHEET_ID = 'sheet-123';

// ─── Helpers ───────────────────────────────────────────────────────────────

function jsonResponse(data: unknown): Response {
  return { ok: true, json: () => Promise.resolve(data) } as Response;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SheetsHelpers', () => {
  let helpers: SheetsHelpers;

  beforeEach(() => {
    mockApiFetch.mockReset();
    helpers = new SheetsHelpers(TOKEN);
  });

  describe('deleteRow', () => {
    it('sends correct deleteDimension request', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

      await helpers.deleteRow(SPREADSHEET_ID, 42, 5);

      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockApiFetch.mock.calls[0]!;
      expect(url).toContain(`${SPREADSHEET_ID}:batchUpdate`);
      expect(init!.method).toBe('POST');

      const body = JSON.parse(init!.body as string);
      const range = body.requests[0].deleteDimension.range;
      expect(range.sheetId).toBe(42);
      expect(range.dimension).toBe('ROWS');
      // rowIndex 5 → startIndex 4, endIndex 5 (0-based, exclusive end)
      expect(range.startIndex).toBe(4);
      expect(range.endIndex).toBe(5);
    });

    it('sends correct Authorization header', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

      await helpers.deleteRow(SPREADSHEET_ID, 0, 1);

      const headers = mockApiFetch.mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`Bearer ${TOKEN}`);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('propagates errors from apiFetch', async () => {
      mockApiFetch.mockRejectedValueOnce(new AuthExpiredError());

      await expect(helpers.deleteRow(SPREADSHEET_ID, 0, 1)).rejects.toThrow(AuthExpiredError);
    });
  });

  describe('getSheetNumericId', () => {
    it('returns the sheetId for the matching sheet name', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({
        sheets: [
          { properties: { title: 'Gastos', sheetId: 0 } },
          { properties: { title: 'Rules', sheetId: 123 } },
          { properties: { title: 'Categories', sheetId: 456 } },
        ],
      }));

      const id = await helpers.getSheetNumericId(SPREADSHEET_ID, 'Rules', 'test');

      expect(id).toBe(123);
    });

    it('returns null when sheet name is not found', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({
        sheets: [
          { properties: { title: 'Gastos', sheetId: 0 } },
        ],
      }));

      const id = await helpers.getSheetNumericId(SPREADSHEET_ID, 'NonExistent', 'test');

      expect(id).toBeNull();
    });

    it('returns null when sheets array is empty', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({ sheets: [] }));

      const id = await helpers.getSheetNumericId(SPREADSHEET_ID, 'Gastos', 'test');

      expect(id).toBeNull();
    });

    it('returns null when sheets is undefined', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

      const id = await helpers.getSheetNumericId(SPREADSHEET_ID, 'Gastos', 'test');

      expect(id).toBeNull();
    });

    it('returns null on non-auth errors (with logging)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

      const id = await helpers.getSheetNumericId(SPREADSHEET_ID, 'Gastos', 'TestContext');

      expect(id).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        expect.anything(),
      );
    });

    it('re-throws AuthExpiredError', async () => {
      mockApiFetch.mockRejectedValueOnce(new AuthExpiredError());

      await expect(
        helpers.getSheetNumericId(SPREADSHEET_ID, 'Gastos', 'test'),
      ).rejects.toThrow(AuthExpiredError);
    });

    it('queries the correct API endpoint', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({ sheets: [] }));

      await helpers.getSheetNumericId(SPREADSHEET_ID, 'Gastos', 'test');

      const url = mockApiFetch.mock.calls[0]![0] as string;
      expect(url).toContain(SPREADSHEET_ID);
      expect(url).toContain('fields=sheets.properties');
    });
  });
});
