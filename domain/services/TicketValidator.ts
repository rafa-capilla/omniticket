import { TicketData } from '../../shared/types/domain';
import { ticketSchema } from '../../schemas/ticketSchema';
import { getErrorMessage, roundCurrency } from '../../lib/utils';

/**
 * Pure domain service for ticket validation and normalization.
 * No I/O dependencies - operates entirely on in-memory data.
 */

/**
 * Validates raw Gemini response against the Zod schema and assigns the correct UUID.
 */
export function validateTicketData(rawJson: unknown, uuid: string): TicketData {
  try {
    const base = (rawJson !== null && typeof rawJson === 'object') ? rawJson : {};
    return ticketSchema.parse({ ...base, id: uuid });
  } catch (e: unknown) {
    console.error("Fallo en validacion Zod:", e);
    throw new Error(`Datos de IA invalidos: ${getErrorMessage(e)}`);
  }
}

/**
 * Recalculates precio_total_linea to always be net (precio_unitario * cantidad - descuento).
 * Mutates the ticket data in place.
 */
export function recalculateLineTotals(ticketData: TicketData): void {
  for (const item of ticketData.items) {
    item.precio_total_linea = roundCurrency((item.precio_unitario * item.cantidad) - item.descuento);
  }
}
