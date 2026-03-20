import { describe, it, expect } from 'vitest';
import { GastosCol, GASTOS_CATEGORIA_COL_LETTER } from '../constants';

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
