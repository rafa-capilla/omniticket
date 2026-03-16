import { describe, it, expect } from 'vitest';
import { validateTicketData, recalculateLineTotals } from '../TicketValidator';
import { TicketData } from '../../../shared/types/domain';

// ─── recalculateLineTotals ──────────────────────────────────────────────────

describe('recalculateLineTotals', () => {
  function makeTicket(items: TicketData['items']): TicketData {
    return {
      id: 'test-uuid',
      tienda: 'Test',
      fecha: '2025-01-15',
      items,
      total_ticket: 0,
    };
  }

  it('calculates precio_total_linea as (precio_unitario * cantidad) - descuento', () => {
    const ticket = makeTicket([
      { nombre: 'Leche', categoria: 'Lácteos', precio_unitario: 1.20, cantidad: 2, descuento: 0, precio_total_linea: 0 },
    ]);

    recalculateLineTotals(ticket);

    expect(ticket.items[0]!.precio_total_linea).toBe(2.40);
  });

  it('applies descuento correctly', () => {
    const ticket = makeTicket([
      { nombre: 'Coca Cola', categoria: 'Bebidas', precio_unitario: 2.00, cantidad: 3, descuento: 1.50, precio_total_linea: 0 },
    ]);

    recalculateLineTotals(ticket);

    expect(ticket.items[0]!.precio_total_linea).toBe(4.50);
  });

  it('handles IEEE 754 floating point drift (e.g. 1.99 * 3)', () => {
    // 1.99 * 3 = 5.970000000000001 in IEEE 754
    const ticket = makeTicket([
      { nombre: 'Yogur', categoria: 'Lácteos', precio_unitario: 1.99, cantidad: 3, descuento: 0, precio_total_linea: 0 },
    ]);

    recalculateLineTotals(ticket);

    expect(ticket.items[0]!.precio_total_linea).toBe(5.97);
  });

  it('handles 0.1 + 0.2 style drift with discount', () => {
    // (0.1 * 1) - 0.2 = -0.1 but IEEE 754 may produce -0.09999...
    const ticket = makeTicket([
      { nombre: 'Test', categoria: 'Otros', precio_unitario: 0.30, cantidad: 1, descuento: 0.10, precio_total_linea: 0 },
    ]);

    recalculateLineTotals(ticket);

    expect(ticket.items[0]!.precio_total_linea).toBe(0.20);
  });

  it('processes multiple items independently', () => {
    const ticket = makeTicket([
      { nombre: 'A', categoria: 'Otros', precio_unitario: 1.50, cantidad: 2, descuento: 0, precio_total_linea: 0 },
      { nombre: 'B', categoria: 'Otros', precio_unitario: 3.00, cantidad: 1, descuento: 0.50, precio_total_linea: 0 },
    ]);

    recalculateLineTotals(ticket);

    expect(ticket.items[0]!.precio_total_linea).toBe(3.00);
    expect(ticket.items[1]!.precio_total_linea).toBe(2.50);
  });

  it('handles zero quantity', () => {
    const ticket = makeTicket([
      { nombre: 'A', categoria: 'Otros', precio_unitario: 5.00, cantidad: 0, descuento: 0, precio_total_linea: 99 },
    ]);

    recalculateLineTotals(ticket);

    expect(ticket.items[0]!.precio_total_linea).toBe(0);
  });

  it('handles zero price', () => {
    const ticket = makeTicket([
      { nombre: 'Regalo', categoria: 'Otros', precio_unitario: 0, cantidad: 1, descuento: 0, precio_total_linea: 99 },
    ]);

    recalculateLineTotals(ticket);

    expect(ticket.items[0]!.precio_total_linea).toBe(0);
  });

  it('mutates the ticket in place (does not return a copy)', () => {
    const ticket = makeTicket([
      { nombre: 'A', categoria: 'Otros', precio_unitario: 2.00, cantidad: 1, descuento: 0, precio_total_linea: 0 },
    ]);
    const itemRef = ticket.items[0]!;

    recalculateLineTotals(ticket);

    expect(itemRef.precio_total_linea).toBe(2.00);
  });
});

// ─── validateTicketData ─────────────────────────────────────────────────────

describe('validateTicketData', () => {
  const validRaw = {
    tienda: 'Mercadona',
    fecha: '2025-01-15',
    items: [
      { nombre: 'Leche', categoria: 'Lácteos', precio_unitario: 1.20, cantidad: 1, descuento: 0, precio_total_linea: 1.20 },
    ],
    total_ticket: 1.20,
  };

  it('returns valid TicketData with the provided UUID', () => {
    const result = validateTicketData(validRaw, 'my-uuid');

    expect(result.id).toBe('my-uuid');
    expect(result.tienda).toBe('Mercadona');
    expect(result.items).toHaveLength(1);
  });

  it('overrides the id field from raw data with the provided UUID', () => {
    const rawWithId = { ...validRaw, id: 'gemini-id' };
    const result = validateTicketData(rawWithId, 'correct-uuid');

    expect(result.id).toBe('correct-uuid');
  });

  it('throws on missing tienda', () => {
    const { tienda: _, ...noTienda } = validRaw;
    expect(() => validateTicketData(noTienda, 'uuid')).toThrow();
  });

  it('throws on invalid fecha format', () => {
    const badDate = { ...validRaw, fecha: '15/01/2025' };
    expect(() => validateTicketData(badDate, 'uuid')).toThrow();
  });

  it('throws on empty items array', () => {
    const noItems = { ...validRaw, items: [] };
    expect(() => validateTicketData(noItems, 'uuid')).toThrow();
  });

  it('throws on negative total_ticket', () => {
    const negTotal = { ...validRaw, total_ticket: -5 };
    expect(() => validateTicketData(negTotal, 'uuid')).toThrow();
  });

  it('handles null input gracefully (throws descriptive error)', () => {
    expect(() => validateTicketData(null, 'uuid')).toThrow('Datos de IA invalidos');
  });

  it('handles undefined input gracefully (throws descriptive error)', () => {
    expect(() => validateTicketData(undefined, 'uuid')).toThrow('Datos de IA invalidos');
  });

  it('applies Zod defaults for optional fields (nombre_normalizado, descuento)', () => {
    const minimal = {
      tienda: 'Lidl',
      fecha: '2025-06-01',
      items: [{ nombre: 'Pan', precio_unitario: 0.80, cantidad: 1, precio_total_linea: 0.80 }],
      total_ticket: 0.80,
    };
    const result = validateTicketData(minimal, 'uuid');

    expect(result.items[0]!.descuento).toBe(0);
    expect(result.items[0]!.nombre_normalizado).toBe('');
    expect(result.items[0]!.categoria).toBe('Otros');
  });
});
