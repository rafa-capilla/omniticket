
import { z } from 'zod';

export const ticketItemSchema = z.object({
  nombre: z.string().min(1, "Nombre de producto requerido"),
  categoria: z.string().default("Otros"),
  precio_unitario: z.number().default(0),
  cantidad: z.number().default(1),
  descuento: z.number().default(0),
  precio_total_linea: z.number().default(0),
});

export const ticketSchema = z.object({
  id: z.string(),
  tienda: z.string().min(1, "Tienda es requerida"),
  fecha: z.string(),
  items: z.array(ticketItemSchema),
  total_ticket: z.number().min(0),
});

export type TicketData = z.infer<typeof ticketSchema>;
