# OmniTicket - Reglas de Negocio

## Categorías de Productos

### Categorías Permitidas (7 totales)
Todos los productos deben clasificarse en una de estas categorías:

1. **Lácteos**: Leche, yogures, quesos, mantequilla, nata, etc.
2. **Carne**: Carne roja, pollo, pescado, embutidos, etc.
3. **Fruta/Verdura**: Frutas frescas, verduras, hortalizas, legumbres frescas
4. **Limpieza**: Productos de limpieza del hogar, detergentes, lejía, etc.
5. **Bebidas**: Agua, refrescos, zumos, alcohol, café, té
6. **Higiene**: Productos de higiene personal (jabón, champú, pasta de dientes, etc.)
7. **Otros**: Todo lo que no encaje en las categorías anteriores

### Notas Importantes
- Si Gemini no está seguro, debe usar "Otros"
- Las categorías son case-sensitive en el código pero Gemini debe interpretarlas correctamente
- El usuario puede crear reglas personalizadas que override la categorización de Gemini

## Sistema de Reglas de Categorización

### Jerarquía de Prioridad
1. **Reglas del Usuario** (máxima prioridad)
   - Definidas en la hoja "Rules" del Spreadsheet
   - Pattern matching case-insensitive
   - Si el producto contiene el pattern, se aplica el normalized name y category

2. **Caché de Normalización**
   - Mappings previos de Gemini almacenados en "Mapping_Cache"
   - Evita llamadas redundantes a la API

3. **Normalización con Gemini** (última opción)
   - Solo se invoca si no hay regla ni caché
   - Procesa en batches de máximo 30 productos

### Ejemplo de Regla
```typescript
{
  pattern: "agua con gas",
  normalized: "Agua con Gas",
  category: "Bebidas"
}
```
Si un producto es "AGUA CON GAS FONT VELLA 1.5L", la regla lo detectará y:
- Nombre normalizado: "Agua con Gas"
- Categoría: "Bebidas" (no "Otros" ni "Lácteos")

## Lentes (Vistas Analíticas)

### 1. Lente de Productos (products)
- **Agrupación**: Por nombre de producto normalizado
- **Visualización**: Bar chart horizontal (top 10)
- **Ordenación**: Descendente por gasto total
- **Excluye**: Líneas marcadas como "--- TOTAL TICKET ---"

### 2. Lente de Categorías (categories)
- **Agrupación**: Por categoría (una de las 7 permitidas)
- **Visualización**: Pie chart con anillo (donut)
- **Colores**: Array predefinido COLORS (7 colores)
- **Uso**: Identificar qué tipo de productos consumen más presupuesto

### 3. Lente de Tiendas (stores)
- **Agrupación**: Por nombre de establecimiento
- **Visualización**: Bar chart horizontal (top 10)
- **Uso**: Comparar gastos entre diferentes supermercados

## Filtros Globales

### Rango de Fechas
- Aplicable a todas las lentes
- Por defecto: últimos 30 días
- Formato: YYYY-MM-DD (campo fecha en cada línea de gasto)
- El filtro es inclusivo (start <= fecha <= end)

### KPIs Calculados
1. **Gasto Total**: Suma de todos los totales de tickets en el rango
   - Se calcula solo de líneas marcadas como "--- TOTAL TICKET ---"

2. **Ticket Promedio**: Gasto Total / Número de Tickets
   - Indica el monto promedio gastado por visita al supermercado

3. **Top Categoría**: Categoría con mayor gasto acumulado
   - Se calcula sumando precio_total_linea por categoría

4. **Tickets Procesados**: Número de tickets únicos en el rango
   - Cada ticket tiene un UUID único

## Proceso de Extracción de Datos (Gemini)

### Instrucciones a Gemini
1. **Tienda**: Extraer el nombre comercial limpio (sin direcciones ni códigos)
2. **Fecha**: Formato YYYY-MM-DD. Si no hay año, asumir 2024 o 2025 según contexto
3. **Items**: Extraer cada línea de producto
   - Limpiar nombres extraños: "PROD 250G" → "Producto 250g"
   - Categorizar según las 7 categorías permitidas
4. **Totales**: Asegurar que suma de items coincida con total_ticket
5. **Descuentos**: Campo positivo (ej: descuento de 2€ = 2, no -2)

### Validación con Zod
El schema `ticketSchema` valida:
- id: string (UUID)
- tienda: string
- fecha: string (formato date implícito)
- items: array de TicketItem (min 1)
- total_ticket: number positivo

Si la validación falla, se rechaza el ticket completo.

## Normalización de Productos

### Objetivo
Convertir nombres raw de productos en nombres genéricos breves (max 3 palabras).

### Ejemplos
| Original | Normalizado |
|----------|-------------|
| "COCA COLA ZERO 2L PET" | "Coca Cola Zero 2L" |
| "LECHUGA ICEBERG UNID" | "Lechuga Iceberg" |
| "PAN BIMBO MOLDE 680G" | "Pan de Molde" |
| "PAPEL HIGIENICO 6ROLL" | "Papel Higiénico" |

### Criterios
- Eliminar códigos de producto
- Mantener información relevante (marca, tamaño si es distintivo)
- Simplificar unidades de medida
- Usar capitalización correcta (Title Case)

## Gestión de Labels en Gmail

### Labels Configurables
- **GMAIL_SEARCH_LABEL**: Label para buscar nuevos tickets (default: "OmniTicket")
- **GMAIL_PROCESSED_LABEL**: Label para marcar procesados (default: "OmniTicket/Procesado")

### Flujo
1. Usuario recibe email de supermercado
2. Usuario aplica manualmente el label "OmniTicket"
3. Al hacer sync, OmniTicket busca emails con ese label y sin "Procesado"
4. Después de procesar, se añade label "OmniTicket/Procesado"
5. En futuros syncs, ese email se ignora

## Almacenamiento en Spreadsheet

### Hoja "Gastos" (Formato de Columnas)
| Col | Campo | Ejemplo |
|-----|-------|---------|
| A | ID Ticket | "a1b2c3..." |
| B | Tienda | "Mercadona" |
| C | Fecha | "2025-01-15" |
| D | Producto | "Coca Cola Zero 2L" |
| E | Categoría | "Bebidas" |
| F | Cantidad | 2 |
| G | P. Unitario | 1.50 |
| H | Descuento | 0.10 |
| I | Total Línea | 2.90 |

### Línea Especial de Total
Cada ticket tiene una línea final con:
- Producto: "--- TOTAL TICKET ---"
- Total Línea: monto total del ticket
- Resto de campos: vacíos o repetidos del ticket

## Reglas de Consistencia

### Fechas
- Siempre en formato YYYY-MM-DD
- Si email/ticket no tiene año, asumir año actual
- Fechas futuras: rechazar o ajustar al año anterior

### Importes
- Siempre números positivos
- Descuentos: valor positivo que se resta
- Validar: suma de líneas ≈ total_ticket (tolerancia de 0.01€)

### Productos Duplicados
- Permitidos: un mismo producto puede aparecer en múltiples líneas del mismo ticket
- Normalización: productos duplicados con nombres diferentes deben normalizarse al mismo nombre

### Categorización Ambigua
Casos especiales:
- "Agua con gas" → Bebidas (NO Agua)
- "Queso rallado" → Lácteos (aunque esté procesado)
- "Tomate frito lata" → Otros (aunque sea vegetal, está procesado)
- "Pollo empanado" → Carne (aunque tenga pan)

## Privacidad y Seguridad

### Datos del Usuario
- Todos los datos permanecen en el ecosistema Google del usuario
- No hay servidor backend: procesamiento client-side
- API Key de Gemini se guarda en el Spreadsheet del usuario (no en variables de entorno del servidor)

### Acceso a Gmail
- Solo lectura de threads
- Solo threads marcados con el label configurado
- No se eliminan ni modifican emails (solo se añaden labels)

### Acceso a Sheets
- Lectura/escritura solo del spreadsheet "OmniTicket_DB"
- No se accede a otros archivos del usuario
