import { describe, it, expect } from 'vitest';
import { GastosCol, GASTOS_CATEGORIA_COL_LETTER, SHEET_HEADER_OFFSET } from '../constants';

describe('GASTOS_CATEGORIA_COL_LETTER', () => {
  it('matches the spreadsheet column letter for GastosCol.CATEGORIA', () => {
    // GastosCol.CATEGORIA is 0-based index 4 → column 'E'
    const expected = String.fromCharCode(65 + GastosCol.CATEGORIA);
    expect(GASTOS_CATEGORIA_COL_LETTER).toBe(expected);
  });

  it('is the letter E (column 5, 0-indexed as 4)', () => {
    expect(GASTOS_CATEGORIA_COL_LETTER).toBe('E');
  });
});

describe('SHEET_HEADER_OFFSET', () => {
  it('is 2 (row 1 = header, data starts at row 2)', () => {
    expect(SHEET_HEADER_OFFSET).toBe(2);
  });

  it('converts 0-based index to correct 1-based sheet row', () => {
    // Index 0 in array → row 2 in sheet (first data row)
    expect(0 + SHEET_HEADER_OFFSET).toBe(2);
    // Index 5 in array → row 7 in sheet
    expect(5 + SHEET_HEADER_OFFSET).toBe(7);
  });
});
