import { describe, it, expect } from 'vitest';
import { applyRulesToItems, applyRulesToRows } from '../RuleEngine';
import { TicketItem, Rule, Category } from '../../../shared/types/domain';
import { GastosCol, TOTAL_TICKET_MARKER } from '../../../lib/constants';

// ─── applyRulesToItems ──────────────────────────────────────────────────────

describe('applyRulesToItems', () => {
  const categories: Category[] = [
    { name: 'Bebidas', description: '', status: 'active' },
    { name: 'Lácteos', description: '', status: 'active' },
    { name: 'Otros', description: '', status: 'active' },
  ];

  function makeItem(overrides?: Partial<TicketItem>): TicketItem {
    return {
      nombre: 'COCA COLA ZERO 2L',
      categoria: 'Bebidas',
      precio_unitario: 1.50,
      cantidad: 1,
      descuento: 0,
      precio_total_linea: 1.50,
      ...overrides,
    };
  }

  it('applies matching rule to override nombre_normalizado and categoria', () => {
    const items = [makeItem({ nombre: 'COCA COLA ZERO 2L PET' })];
    const rules: Rule[] = [
      { pattern: 'coca cola', normalized: 'Coca Cola', category: 'Bebidas' },
    ];

    applyRulesToItems(items, rules, categories);

    expect(items[0]!.nombre_normalizado).toBe('Coca Cola');
    expect(items[0]!.categoria).toBe('Bebidas');
  });

  it('does not modify items when no rule matches', () => {
    const items = [makeItem({ nombre: 'Pan de Molde', categoria: 'Otros' })];
    const rules: Rule[] = [
      { pattern: 'coca cola', normalized: 'Coca Cola', category: 'Bebidas' },
    ];

    applyRulesToItems(items, rules, categories);

    expect(items[0]!.nombre_normalizado).toBeUndefined();
    expect(items[0]!.categoria).toBe('Otros');
  });

  it('falls back to "Otros" when category is not in valid categories list', () => {
    const items = [makeItem({ nombre: 'Something', categoria: 'InvalidCategory' })];
    const rules: Rule[] = [];

    applyRulesToItems(items, rules, categories);

    expect(items[0]!.categoria).toBe('Otros');
  });

  it('rule-assigned category that is invalid also gets corrected to "Otros"', () => {
    const items = [makeItem({ nombre: 'AGUA FONT VELLA' })];
    const rules: Rule[] = [
      { pattern: 'agua', normalized: 'Agua', category: 'DeletedCategory' },
    ];

    applyRulesToItems(items, rules, categories);

    expect(items[0]!.nombre_normalizado).toBe('Agua');
    expect(items[0]!.categoria).toBe('Otros');
  });

  it('processes multiple items independently', () => {
    const items = [
      makeItem({ nombre: 'LECHE ENTERA 1L', categoria: 'Otros' }),
      makeItem({ nombre: 'COCA COLA ZERO', categoria: 'Otros' }),
      makeItem({ nombre: 'PAN BIMBO', categoria: 'Otros' }),
    ];
    const rules: Rule[] = [
      { pattern: 'leche', normalized: 'Leche', category: 'Lácteos' },
      { pattern: 'coca cola', normalized: 'Coca Cola', category: 'Bebidas' },
    ];

    applyRulesToItems(items, rules, categories);

    expect(items[0]!.nombre_normalizado).toBe('Leche');
    expect(items[0]!.categoria).toBe('Lácteos');
    expect(items[1]!.nombre_normalizado).toBe('Coca Cola');
    expect(items[1]!.categoria).toBe('Bebidas');
    expect(items[2]!.categoria).toBe('Otros');
  });

  it('first matching rule wins (order matters)', () => {
    const items = [makeItem({ nombre: 'LECHE COCA COLA' })];
    const rules: Rule[] = [
      { pattern: 'leche', normalized: 'Leche', category: 'Lácteos' },
      { pattern: 'coca cola', normalized: 'Coca Cola', category: 'Bebidas' },
    ];

    applyRulesToItems(items, rules, categories);

    expect(items[0]!.nombre_normalizado).toBe('Leche');
    expect(items[0]!.categoria).toBe('Lácteos');
  });

  it('handles empty items array without error', () => {
    const items: TicketItem[] = [];
    const rules: Rule[] = [
      { pattern: 'leche', normalized: 'Leche', category: 'Lácteos' },
    ];

    expect(() => applyRulesToItems(items, rules, categories)).not.toThrow();
  });

  it('handles empty rules array without error', () => {
    const items = [makeItem({ nombre: 'Leche', categoria: 'Lácteos' })];

    applyRulesToItems(items, [], categories);

    expect(items[0]!.categoria).toBe('Lácteos');
  });

  it('mutates items in place', () => {
    const item = makeItem({ nombre: 'LECHE ENTERA' });
    const items = [item];
    const rules: Rule[] = [
      { pattern: 'leche', normalized: 'Leche', category: 'Lácteos' },
    ];

    applyRulesToItems(items, rules, categories);

    expect(item.nombre_normalizado).toBe('Leche');
  });
});

// ─── applyRulesToRows ───────────────────────────────────────────────────────

describe('applyRulesToRows', () => {
  const rules: Rule[] = [
    { pattern: 'coca cola', normalized: 'Coca Cola', category: 'Bebidas' },
    { pattern: 'leche', normalized: 'Leche', category: 'Lácteos' },
  ];

  function makeRow(product: string, category: string, normalized: string): string[] {
    const row: string[] = [];
    row[GastosCol.ID] = 'uuid-1';
    row[GastosCol.TIENDA] = 'Mercadona';
    row[GastosCol.FECHA] = '2025-01-15';
    row[GastosCol.PRODUCTO] = product;
    row[GastosCol.CATEGORIA] = category;
    row[GastosCol.CANTIDAD] = '1';
    row[GastosCol.PRECIO_UNIT] = '1.50';
    row[GastosCol.DESCUENTO] = '0';
    row[GastosCol.TOTAL_LINEA] = '1.50';
    row[GastosCol.NOMBRE_NORM] = normalized;
    return row;
  }

  it('applies matching rule to override product name and category in output', () => {
    const rows = [makeRow('COCA COLA ZERO 2L', 'Otros', '')];

    const result = applyRulesToRows(
      rows, rules, GastosCol.PRODUCTO, GastosCol.CATEGORIA, GastosCol.NOMBRE_NORM, TOTAL_TICKET_MARKER,
    );

    expect(result[0]![GastosCol.PRODUCTO]).toBe('Coca Cola');
    expect(result[0]![GastosCol.CATEGORIA]).toBe('Bebidas');
  });

  it('does not mutate original rows', () => {
    const rows = [makeRow('COCA COLA ZERO 2L', 'Otros', '')];
    const originalProduct = rows[0]![GastosCol.PRODUCTO];

    applyRulesToRows(
      rows, rules, GastosCol.PRODUCTO, GastosCol.CATEGORIA, GastosCol.NOMBRE_NORM, TOTAL_TICKET_MARKER,
    );

    expect(rows[0]![GastosCol.PRODUCTO]).toBe(originalProduct);
  });

  it('skips TOTAL_TICKET_MARKER rows', () => {
    const rows = [makeRow(TOTAL_TICKET_MARKER, '', '')];

    const result = applyRulesToRows(
      rows, rules, GastosCol.PRODUCTO, GastosCol.CATEGORIA, GastosCol.NOMBRE_NORM, TOTAL_TICKET_MARKER,
    );

    expect(result[0]![GastosCol.PRODUCTO]).toBe(TOTAL_TICKET_MARKER);
  });

  it('uses normalized name from sync (col J) when no rule matches', () => {
    const rows = [makeRow('PAN BIMBO 680G', 'Otros', 'Pan de Molde')];

    const result = applyRulesToRows(
      rows, rules, GastosCol.PRODUCTO, GastosCol.CATEGORIA, GastosCol.NOMBRE_NORM, TOTAL_TICKET_MARKER,
    );

    expect(result[0]![GastosCol.PRODUCTO]).toBe('Pan de Molde');
  });

  it('uses original product name when no rule matches and col J is empty', () => {
    const rows = [makeRow('PAN BIMBO 680G', 'Otros', '')];

    const result = applyRulesToRows(
      rows, rules, GastosCol.PRODUCTO, GastosCol.CATEGORIA, GastosCol.NOMBRE_NORM, TOTAL_TICKET_MARKER,
    );

    expect(result[0]![GastosCol.PRODUCTO]).toBe('PAN BIMBO 680G');
  });

  it('skips rows with empty product name', () => {
    const rows = [makeRow('', 'Otros', '')];

    const result = applyRulesToRows(
      rows, rules, GastosCol.PRODUCTO, GastosCol.CATEGORIA, GastosCol.NOMBRE_NORM, TOTAL_TICKET_MARKER,
    );

    expect(result[0]![GastosCol.PRODUCTO]).toBe('');
  });

  it('processes multiple rows correctly', () => {
    const rows = [
      makeRow('COCA COLA ZERO', 'Otros', ''),
      makeRow('LECHE ENTERA', 'Otros', ''),
      makeRow('PAN', 'Otros', 'Pan'),
    ];

    const result = applyRulesToRows(
      rows, rules, GastosCol.PRODUCTO, GastosCol.CATEGORIA, GastosCol.NOMBRE_NORM, TOTAL_TICKET_MARKER,
    );

    expect(result[0]![GastosCol.PRODUCTO]).toBe('Coca Cola');
    expect(result[0]![GastosCol.CATEGORIA]).toBe('Bebidas');
    expect(result[1]![GastosCol.PRODUCTO]).toBe('Leche');
    expect(result[1]![GastosCol.CATEGORIA]).toBe('Lácteos');
    expect(result[2]![GastosCol.PRODUCTO]).toBe('Pan');
    expect(result[2]![GastosCol.CATEGORIA]).toBe('Otros');
  });
});
