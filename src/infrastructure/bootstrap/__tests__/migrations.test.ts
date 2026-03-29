import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { SheetName, GastosCol, TOTAL_TICKET_MARKER } from '@/lib/constants';
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

/** Builds a metadata response listing the given sheet titles. */
function metadataResponse(titles: string[]): Response {
  return jsonResponse({
    sheets: titles.map(title => ({ properties: { title } })),
  });
}

/** Builds a values response (Sheets API values.get). */
function valuesResponse(values: string[][]): Response {
  return jsonResponse({ values });
}

function emptyValuesResponse(): Response {
  return jsonResponse({});
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('runMigrations', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  describe('migrateCategoriesSheet', () => {
    it('creates Categories sheet when it does not exist', async () => {
      // 1. metadata: no Categories sheet
      mockApiFetch
        .mockResolvedValueOnce(metadataResponse([SheetName.SETTINGS, SheetName.GASTOS, SheetName.RULES]))
        // 2. addSheet (batchUpdate)
        .mockResolvedValueOnce(jsonResponse({}))
        // 3. write categories headers + data (batchUpdate values)
        .mockResolvedValueOnce(jsonResponse({}))
        // 4. migrateDiscountFix: read settings keys
        .mockResolvedValueOnce(valuesResponse([['GMAIL_SEARCH_LABEL'], ['MIGRATION_DISCOUNT_FIX']]))
        // 5. migrateNormalizedHeader: read J1 header
        .mockResolvedValueOnce(valuesResponse([['Producto Normalizado']]));

      await runMigrations(TOKEN, SPREADSHEET_ID);

      // Verify addSheet was called with Categories
      const addSheetCall = mockApiFetch.mock.calls[1]!;
      expect(addSheetCall[0]).toContain(':batchUpdate');
      const addSheetBody = JSON.parse(addSheetCall[1]!.body as string);
      expect(addSheetBody.requests[0].addSheet.properties.title).toBe(SheetName.CATEGORIES);

      // Verify categories data was written
      const writeCall = mockApiFetch.mock.calls[2]!;
      expect(writeCall[0]).toContain('values:batchUpdate');
      const writeBody = JSON.parse(writeCall[1]!.body as string);
      expect(writeBody.data).toHaveLength(2); // headers + data
      expect(writeBody.data[0].values[0]).toEqual(['Name', 'Description', 'Status']);
    });

    it('skips Categories creation when sheet already exists', async () => {
      mockApiFetch
        // 1. metadata: Categories already present
        .mockResolvedValueOnce(metadataResponse([SheetName.SETTINGS, SheetName.GASTOS, SheetName.RULES, SheetName.CATEGORIES]))
        // 2. migrateDiscountFix: read settings keys (already done)
        .mockResolvedValueOnce(valuesResponse([['GMAIL_SEARCH_LABEL'], ['MIGRATION_DISCOUNT_FIX']]))
        // 3. migrateNormalizedHeader: read J1
        .mockResolvedValueOnce(valuesResponse([['Producto Normalizado']]));

      await runMigrations(TOKEN, SPREADSHEET_ID);

      // Should only make 3 calls (metadata + discount check + header check) — no addSheet
      expect(mockApiFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('migrateDiscountFix', () => {
    it('skips when MIGRATION_DISCOUNT_FIX flag already present in settings', async () => {
      mockApiFetch
        .mockResolvedValueOnce(metadataResponse([SheetName.SETTINGS, SheetName.GASTOS, SheetName.RULES, SheetName.CATEGORIES]))
        // settings keys include the flag
        .mockResolvedValueOnce(valuesResponse([['GMAIL_SEARCH_LABEL'], ['MIGRATION_DISCOUNT_FIX']]))
        // migrateNormalizedHeader
        .mockResolvedValueOnce(valuesResponse([['Producto Normalizado']]));

      await runMigrations(TOKEN, SPREADSHEET_ID);

      // No Gastos read or batchUpdate for discount fix
      expect(mockApiFetch).toHaveBeenCalledTimes(3);
    });

    it('recalculates incorrect line totals and writes flag', async () => {
      // Row with incorrect total: unitario=2, cantidad=3, descuento=1 → correct=5, current=6
      const gastosRows: string[][] = [
        (() => {
          const row: string[] = [];
          row[GastosCol.PRODUCTO] = 'Leche';
          row[GastosCol.CANTIDAD] = '3';
          row[GastosCol.PRECIO_UNIT] = '2';
          row[GastosCol.DESCUENTO] = '1';
          row[GastosCol.TOTAL_LINEA] = '6'; // incorrect: should be 2*3-1=5
          return row;
        })(),
      ];

      mockApiFetch
        .mockResolvedValueOnce(metadataResponse([SheetName.SETTINGS, SheetName.GASTOS, SheetName.RULES, SheetName.CATEGORIES]))
        // settings keys: no MIGRATION_DISCOUNT_FIX
        .mockResolvedValueOnce(valuesResponse([['GMAIL_SEARCH_LABEL']]))
        // read Gastos rows
        .mockResolvedValueOnce(valuesResponse(gastosRows))
        // batchUpdate to fix totals
        .mockResolvedValueOnce(jsonResponse({}))
        // append migration flag
        .mockResolvedValueOnce(jsonResponse({}))
        // migrateNormalizedHeader
        .mockResolvedValueOnce(valuesResponse([['Producto Normalizado']]));

      await runMigrations(TOKEN, SPREADSHEET_ID);

      // Verify the correction was written
      const batchUpdateCall = mockApiFetch.mock.calls[3]!;
      const body = JSON.parse(batchUpdateCall[1]!.body as string);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].values[0][0]).toBe(5); // corrected total
    });

    it('skips TOTAL_TICKET_MARKER rows during discount fix', async () => {
      const gastosRows: string[][] = [
        (() => {
          const row: string[] = [];
          row[GastosCol.PRODUCTO] = TOTAL_TICKET_MARKER;
          row[GastosCol.CANTIDAD] = '0';
          row[GastosCol.PRECIO_UNIT] = '0';
          row[GastosCol.DESCUENTO] = '0';
          row[GastosCol.TOTAL_LINEA] = '10';
          return row;
        })(),
      ];

      mockApiFetch
        .mockResolvedValueOnce(metadataResponse([SheetName.SETTINGS, SheetName.GASTOS, SheetName.RULES, SheetName.CATEGORIES]))
        .mockResolvedValueOnce(valuesResponse([['GMAIL_SEARCH_LABEL']]))
        .mockResolvedValueOnce(valuesResponse(gastosRows))
        // No batchUpdate for totals (nothing to fix)
        // append migration flag
        .mockResolvedValueOnce(jsonResponse({}))
        // migrateNormalizedHeader
        .mockResolvedValueOnce(valuesResponse([['Producto Normalizado']]));

      await runMigrations(TOKEN, SPREADSHEET_ID);

      // The batchUpdate for fixing rows should NOT be called (only flag append)
      const flagAppendCall = mockApiFetch.mock.calls[3]!;
      expect(flagAppendCall[0]).toContain(':append');
    });

    it('does not write batch update when all totals are correct', async () => {
      const gastosRows: string[][] = [
        (() => {
          const row: string[] = [];
          row[GastosCol.PRODUCTO] = 'Leche';
          row[GastosCol.CANTIDAD] = '2';
          row[GastosCol.PRECIO_UNIT] = '1.50';
          row[GastosCol.DESCUENTO] = '0';
          row[GastosCol.TOTAL_LINEA] = '3'; // correct: 1.50*2 - 0 = 3
          return row;
        })(),
      ];

      mockApiFetch
        .mockResolvedValueOnce(metadataResponse([SheetName.SETTINGS, SheetName.GASTOS, SheetName.RULES, SheetName.CATEGORIES]))
        .mockResolvedValueOnce(valuesResponse([['GMAIL_SEARCH_LABEL']]))
        .mockResolvedValueOnce(valuesResponse(gastosRows))
        // flag append (no batchUpdate for rows)
        .mockResolvedValueOnce(jsonResponse({}))
        // migrateNormalizedHeader
        .mockResolvedValueOnce(valuesResponse([['Producto Normalizado']]));

      await runMigrations(TOKEN, SPREADSHEET_ID);

      // Should be 5 calls: metadata, settings, gastos read, flag append, header check
      expect(mockApiFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('migrateNormalizedHeader', () => {
    it('writes header when J1 is empty', async () => {
      mockApiFetch
        .mockResolvedValueOnce(metadataResponse([SheetName.SETTINGS, SheetName.GASTOS, SheetName.RULES, SheetName.CATEGORIES]))
        .mockResolvedValueOnce(valuesResponse([['GMAIL_SEARCH_LABEL'], ['MIGRATION_DISCOUNT_FIX']]))
        // J1 is empty
        .mockResolvedValueOnce(emptyValuesResponse())
        // PUT to write header
        .mockResolvedValueOnce(jsonResponse({}));

      await runMigrations(TOKEN, SPREADSHEET_ID);

      const putCall = mockApiFetch.mock.calls[3]!;
      expect(putCall[0]).toContain(`${SheetName.GASTOS}!J1`);
      expect(putCall[1]!.method).toBe('PUT');
      const body = JSON.parse(putCall[1]!.body as string);
      expect(body.values[0][0]).toBe('Producto Normalizado');
    });

    it('skips when J1 already has a value', async () => {
      mockApiFetch
        .mockResolvedValueOnce(metadataResponse([SheetName.SETTINGS, SheetName.GASTOS, SheetName.RULES, SheetName.CATEGORIES]))
        .mockResolvedValueOnce(valuesResponse([['GMAIL_SEARCH_LABEL'], ['MIGRATION_DISCOUNT_FIX']]))
        // J1 has value
        .mockResolvedValueOnce(valuesResponse([['Producto Normalizado']]));

      await runMigrations(TOKEN, SPREADSHEET_ID);

      expect(mockApiFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('re-throws AuthExpiredError', async () => {
      mockApiFetch.mockRejectedValueOnce(new AuthExpiredError());

      await expect(runMigrations(TOKEN, SPREADSHEET_ID)).rejects.toThrow(AuthExpiredError);
    });

    it('re-throws non-auth errors after logging', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApiFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(runMigrations(TOKEN, SPREADSHEET_ID)).rejects.toThrow('Network failure');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
