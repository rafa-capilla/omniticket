
import { z } from 'zod';

export const ticketItemSchema = z.object({
  nombre: z.string().min(1, "Nombre de producto requerido"),
  nombre_normalizado: z.string().default(""),
  categoria: z.string().default("Otros"),
  precio_unitario: z.number().min(0, "Precio unitario no puede ser negativo").default(0),
  cantidad: z.number().min(0, "Cantidad no puede ser negativa").default(1),
  descuento: z.number().min(0, "Descuento no puede ser negativo").default(0),
  precio_total_linea: z.number().default(0),
});

export const ticketSchema = z.object({
  id: z.string(),
  tienda: z.string().min(1, "Tienda es requerida"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
  items: z.array(ticketItemSchema).min(1, 'El ticket debe tener al menos un producto'),
  total_ticket: z.number().min(0),
});
