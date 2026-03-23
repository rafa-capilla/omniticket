import type { SheetsValuesResponse, SheetsMetadataResponse } from '@/shared/types/google-api';
import { TOTAL_TICKET_MARKER, GastosCol, SHEETS_API, SheetName } from '@/lib/constants';
import { safeNum, authHeaders, jsonAuthHeaders } from '@/lib/utils';
import { apiFetch } from '@/infrastructure/google-api/apiFetch';
import { DatabaseBootstrap } from './DatabaseBootstrap';
import { isAuthError } from '@/domain/errors';

/**
 * Runs all idempotent migrations on an existing spreadsheet.
 * Each migration checks its own preconditions and skips if already applied.
 */
export async function runMigrations(accessToken: string, spreadsheetId: string): Promise<void> {
  const auth = authHeaders(accessToken);
  const jsonAuth = jsonAuthHeaders(accessToken);

  try {
    const metaResponse = await apiFetch(
      `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`,
      { headers: auth }
    );
    const meta: SheetsMetadataResponse = await metaResponse.json();
    const sheetTitles: string[] = (meta.sheets ?? []).map(s => String(s.properties?.title ?? ''));

    await migrateCategoriesSheet(spreadsheetId, sheetTitles, auth, jsonAuth);
    await migrateDiscountFix(spreadsheetId, auth, jsonAuth);
    await migrateNormalizedHeader(spreadsheetId, auth, jsonAuth);
  } catch (e: unknown) {
    if (isAuthError(e)) throw e;
    console.error("Error en runMigrations:", e);
    throw e;
  }
}

/** Migration 1: Create Categories sheet if it doesn't exist */
async function migrateCategoriesSheet(
  spreadsheetId: string,
  sheetTitles: string[],
  auth: HeadersInit,
  jsonAuth: HeadersInit,
): Promise<void> {
  if (sheetTitles.includes(SheetName.CATEGORIES)) return;

  await apiFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: jsonAuth,
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: SheetName.CATEGORIES, gridProperties: { frozenRowCount: 1 } } } }]
    })
  });

  const categories = DatabaseBootstrap.defaultCategories;
  await apiFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: jsonAuth,
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: [
        { range: `${SheetName.CATEGORIES}!A1:C1`, values: [['Name', 'Description', 'Status']] },
        { range: `${SheetName.CATEGORIES}!A2:C${categories.length + 1}`, values: categories }
      ]
    })
  });
}

/** Migration 2: Fix precio_total_linea to always be net (precio_unitario * cantidad - descuento) */
async function migrateDiscountFix(
  spreadsheetId: string,
  auth: HeadersInit,
  jsonAuth: HeadersInit,
): Promise<void> {
  const settingsKeysResponse = await apiFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SheetName.SETTINGS}!A:A`,
    { headers: auth }
  );
  const settingsKeysData: SheetsValuesResponse = await settingsKeysResponse.json();
  const settingsKeys: string[] = (settingsKeysData.values ?? []).map((r: string[]) => r[0] ?? '');

  if (settingsKeys.includes('MIGRATION_DISCOUNT_FIX')) return;

  const gastosResponse = await apiFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SheetName.GASTOS}!A2:J`,
    { headers: auth }
  );
  const gastosData: SheetsValuesResponse = await gastosResponse.json();
  const rows: string[][] = gastosData.values ?? [];

  const updates: { range: string; values: [[number]] }[] = [];
  rows.forEach((row, idx) => {
    if ((row[GastosCol.PRODUCTO] ?? '') === TOTAL_TICKET_MARKER) return;
    const cantidad = safeNum(row[GastosCol.CANTIDAD]);
    const precioUnitario = safeNum(row[GastosCol.PRECIO_UNIT]);
    const descuento = safeNum(row[GastosCol.DESCUENTO]);
    const currentTotal = safeNum(row[GastosCol.TOTAL_LINEA]);
    const correct = precioUnitario * cantidad - descuento;
    if (Math.abs(correct - currentTotal) > 0.001) {
      updates.push({ range: `${SheetName.GASTOS}!I${idx + 2}`, values: [[correct]] });
    }
  });

  if (updates.length > 0) {
    await apiFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST', headers: jsonAuth, body: JSON.stringify({ valueInputOption: 'RAW', data: updates })
    });
  }

  await apiFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SheetName.SETTINGS}!A:B:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', headers: jsonAuth, body: JSON.stringify({ values: [['MIGRATION_DISCOUNT_FIX', new Date().toISOString()]] }) }
  );
}

/** Migration 3: Add "Producto Normalizado" header to Gastos!J1 if missing */
async function migrateNormalizedHeader(
  spreadsheetId: string,
  auth: HeadersInit,
  jsonAuth: HeadersInit,
): Promise<void> {
  const headerResponse = await apiFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SheetName.GASTOS}!J1`,
    { headers: auth }
  );
  const headerData: SheetsValuesResponse = await headerResponse.json();

  if (headerData.values?.[0]?.[0]) return;

  await apiFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SheetName.GASTOS}!J1?valueInputOption=RAW`,
    { method: 'PUT', headers: jsonAuth, body: JSON.stringify({ values: [['Producto Normalizado']] }) }
  );
}
