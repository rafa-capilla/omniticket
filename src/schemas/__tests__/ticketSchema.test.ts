import { describe, it, expect } from 'vitest';
import { ticketSchema, ticketItemSchema } from '../ticketSchema';

// ─── ticketItemSchema ─────────────────────────────────────────────────────────

describe('ticketItemSchema', () => {
  const validItem = {
    nombre: 'COCA COLA ZERO 2L',
    nombre_normalizado: 'Coca Cola Zero',
    categoria: 'Bebidas',
    precio_unitario: 1.5,
    cantidad: 2,
    descuento: 0,
    precio_total_linea: 3.0,
  };

  it('accepts a fully valid item', () => {
    const result = ticketItemSchema.parse(validItem);
    expect(result.nombre).toBe('COCA COLA ZERO 2L');
    expect(result.precio_total_linea).toBe(3.0);
  });

  it('applies defaults for optional fields', () => {
    const result = ticketItemSchema.parse({ nombre: 'Leche' });
    expect(result.nombre_normalizado).toBe('');
    expect(result.categoria).toBe('Otros');
    expect(result.precio_unitario).toBe(0);
    expect(result.cantidad).toBe(1);
    expect(result.descuento).toBe(0);
    expect(result.precio_total_linea).toBe(0);
  });

  it('rejects an item with empty nombre', () => {
    expect(() => ticketItemSchema.parse({ ...validItem, nombre: '' })).toThrow();
  });

  it('rejects negative precio_unitario', () => {
    expect(() => ticketItemSchema.parse({ ...validItem, precio_unitario: -1 })).toThrow();
  });

  it('rejects negative cantidad', () => {
    expect(() => ticketItemSchema.parse({ ...validItem, cantidad: -1 })).toThrow();
  });

  it('rejects negative descuento', () => {
    expect(() => ticketItemSchema.parse({ ...validItem, descuento: -0.5 })).toThrow();
  });
});

// ─── ticketSchema ─────────────────────────────────────────────────────────────

describe('ticketSchema', () => {
  const validTicket = {
    id: 'abc-123',
    tienda: 'Mercadona',
    fecha: '2025-01-15',
    items: [
      {
        nombre: 'Leche Entera',
        nombre_normalizado: 'Leche',
        categoria: 'Lácteos',
        precio_unitario: 1.2,
        cantidad: 2,
        descuento: 0,
        precio_total_linea: 2.4,
      },
    ],
    total_ticket: 2.4,
  };

  it('accepts a fully valid ticket', () => {
    const result = ticketSchema.parse(validTicket);
    expect(result.id).toBe('abc-123');
    expect(result.tienda).toBe('Mercadona');
    expect(result.items).toHaveLength(1);
  });

  it('rejects an empty tienda', () => {
    expect(() => ticketSchema.parse({ ...validTicket, tienda: '' })).toThrow();
  });

  it('rejects a fecha with wrong format', () => {
    expect(() => ticketSchema.parse({ ...validTicket, fecha: '15-01-2025' })).toThrow();
    expect(() => ticketSchema.parse({ ...validTicket, fecha: '2025/01/15' })).toThrow();
    expect(() => ticketSchema.parse({ ...validTicket, fecha: 'not-a-date' })).toThrow();
  });

  it('accepts fecha in correct YYYY-MM-DD format', () => {
    const result = ticketSchema.parse({ ...validTicket, fecha: '2026-03-12' });
    expect(result.fecha).toBe('2026-03-12');
  });

  it('rejects a ticket with zero items', () => {
    expect(() => ticketSchema.parse({ ...validTicket, items: [] })).toThrow();
  });

  it('rejects a negative total_ticket', () => {
    expect(() => ticketSchema.parse({ ...validTicket, total_ticket: -5 })).toThrow();
  });

  it('accepts total_ticket of zero', () => {
    const result = ticketSchema.parse({ ...validTicket, total_ticket: 0 });
    expect(result.total_ticket).toBe(0);
  });

  it('rejects when required top-level fields are missing', () => {
    expect(() => ticketSchema.parse({})).toThrow();
    expect(() => ticketSchema.parse({ id: 'x' })).toThrow();
  });

  it('accepts a ticket with multiple items', () => {
    const multiItemTicket = {
      ...validTicket,
      items: [
        { nombre: 'Leche', precio_unitario: 1.2, cantidad: 1, descuento: 0, precio_total_linea: 1.2 },
        { nombre: 'Pan', precio_unitario: 0.8, cantidad: 2, descuento: 0, precio_total_linea: 1.6 },
      ],
      total_ticket: 2.8,
    };
    const result = ticketSchema.parse(multiItemTicket);
    expect(result.items).toHaveLength(2);
  });
});
