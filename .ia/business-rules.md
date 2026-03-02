# OmniTicket - Reglas de Negocio

## Categorías de Productos

### Categorías Dinámicas (gestionadas por el usuario)
Las categorías **no están hardcodeadas** en el código. Se almacenan en la hoja "Categorias" del spreadsheet y el usuario puede:
- Crear nuevas categorías (nombre + descripción)
- Editar categorías existentes
- Borrar categorías (con reasignación de productos a otra categoría)
- Activar/desactivar categorías (status: 'active' | 'inactive')

Las categorías iniciales que ConfigService crea al hacer bootstrap son:
1. **Lácteos**: Leche, yogures, quesos, mantequilla, nata, etc.
2. **Carne**: Carne roja, pollo, pescado, embutidos, etc.
3. **Fruta/Verdura**: Frutas frescas, verduras, hortalizas, legumbres frescas
4. **Limpieza**: Productos de limpieza del hogar, detergentes, lejía, etc.
5. **Bebidas**: Agua, refrescos, zumos, alcohol, café, té
6. **Higiene**: Productos de higiene personal (jabón, champú, pasta de dientes, etc.)
7. **Otros**: Todo lo que no encaje en las categorías anteriores

### Notas Importantes
- Si Gemini no está seguro de la categoría, debe usar "Otros"
- La categoría "Otros" no se puede borrar (protección en UI)
- Al borrar una categoría con productos, todos los productos se reasignan a otra categoría elegida por el usuario (también actualiza las reglas que la usaban)

## Sistema de Reglas de Categorización

### Jerarquía de Prioridad (en tiempo de análisis de lentes)
1. **Reglas del Usuario** (máxima prioridad)
   - Definidas en la hoja "Rules" del Spreadsheet
   - Pattern matching case-insensitive (contains)
   - Si el nombre del producto contiene el pattern, se aplica el normalized name y category en la vista

2. **Valor normalizado guardado en Gastos (col J)**
   - El nombre normalizado que Gemini escribió al procesar el ticket
   - Se usa si no hay regla que aplique

3. **Nombre original del producto (col D)**
   - Último recurso si la col J está vacía

> **Nota**: La normalización ocurre en dos momentos distintos:
> - **En sync** (SyncEngine): Gemini extrae y normaliza el nombre en un único prompt al procesar el ticket. El resultado se guarda directamente en col J (nombre_normalizado).
> - **En las lentes** (LensesView): se aplican las reglas del usuario sobre el nombre para sobreescribir la categoría y el nombre normalizado en la vista, sin modificar el spreadsheet.

### Ejemplo de Regla
```text
{
  pattern: "agua con gas",
  normalized: "Agua con Gas",
  category: "Bebidas"
}
```
Si en la vista un producto tiene nombre "AGUA CON GAS FONT VELLA 1.5L", la regla lo mostrará como:
- Nombre normalizado: "Agua con Gas"
- Categoría: "Bebidas"

## Lentes (Vistas Analíticas)

### 1. Lente de Productos (products)
- **Agrupación**: Por nombre de producto (col J si existe, col D si no, con reglas aplicadas encima)
- **Visualización**: Bar chart horizontal (top 10)
- **Ordenación**: Descendente por gasto total
- **Excluye**: Líneas marcadas como "--- TOTAL TICKET ---"

### 2. Lente de Categorías (categories)
- **Agrupación**: Por categoría (col E, con reglas aplicadas)
- **Visualización**: Pie chart con anillo (donut)
- **Colores**: Array COLORS definido en `lib/utils.ts` (7 colores que se repiten)
- **Inicializa todas las categorías activas a 0**: garantiza que aparezcan en el gráfico aunque no tengan gasto

### 3. Lente de Tiendas (stores)
- **Agrupación**: Por nombre de establecimiento (col B)
- **Visualización**: Bar chart horizontal (top 10)

### 4. Lente de Análisis (analysis)
- **Interfaz**: Campo de texto libre para preguntar sobre los gastos del período
- **Motor**: Gemini AI (requiere GEMINI_API_KEY configurada en Settings)
- **Input a Gemini**: Datos agregados (totales por categoría, producto, tienda) + pregunta del usuario
- **Output**: Texto de análisis + tipo de gráfico (pie o bar) con datos
- **Ejemplos de preguntas predefinidas** para guiar al usuario

## Filtros Globales

### Rango de Fechas
- Aplicable a todas las lentes
- Por defecto: últimos 30 días desde la fecha actual
- Formato: YYYY-MM-DD (campo fecha en cada línea de gasto, col C)
- El filtro es inclusivo (start <= fecha <= end)

### KPIs Calculados
1. **Gasto Total**: Suma de los campos "total" de líneas marcadas como "--- TOTAL TICKET ---" en el rango
2. **Ticket Promedio**: Gasto Total / Número de Tickets
3. **Top Categoría**: Categoría con mayor gasto acumulado (suma de col I por categoría)
4. **Tickets Procesados**: Número de líneas "--- TOTAL TICKET ---" en el rango

## Proceso de Extracción de Datos (Gemini)

### Instrucciones a Gemini (en SyncEngine)
Gemini recibe el contenido raw del email y debe extraer:
1. **Tienda**: Nombre comercial limpio (sin direcciones ni códigos)
2. **Fecha**: Formato YYYY-MM-DD. Si no hay año, asumir el año actual
3. **Items**: Cada línea de producto con nombre ya normalizado y categorizado
   - Gemini extrae Y normaliza el nombre en la misma llamada (no hay paso separado de normalización)
   - Categorizar según las categorías del sistema
4. **Totales**: Asegurar que suma de items ≈ total_ticket
5. **Descuentos**: Campo positivo (ej: descuento de 2€ = 2, no -2)

### Validación con Zod
El schema `ticketSchema` valida la respuesta de Gemini:
- id: string (UUID asignado por el código antes de guardar)
- tienda: string
- fecha: string (YYYY-MM-DD)
- items: array de TicketItem (min 1)
- total_ticket: number positivo

Si la validación falla, se rechaza el ticket completo (no se guarda en Sheets, no se marca como "Procesado").

## Normalización de Nombres de Productos

### Objetivo
Convertir nombres raw de productos en nombres genéricos breves (max 3 palabras).

### Cómo funciona actualmente
Gemini normaliza el nombre **en el mismo prompt** que extrae el ticket. El nombre normalizado se guarda en la columna J ("nombre_normalizado") del Gastos. No hay un servicio separado de normalización ni caché de mappings.

### Ejemplos de nombres normalizados
| Original | Normalizado |
|----------|-------------|
| "COCA COLA ZERO 2L PET" | "Coca Cola Zero 2L" |
| "LECHUGA ICEBERG UNID" | "Lechuga Iceberg" |
| "PAN BIMBO MOLDE 680G" | "Pan de Molde" |
| "PAPEL HIGIENICO 6ROLL" | "Papel Higiénico" |

### Criterios
- Eliminar códigos de producto y referencias de supermercado
- Mantener información relevante (marca, tamaño si es distintivo)
- Simplificar unidades de medida
- Usar capitalización correcta (Title Case)

## Gestión de Labels en Gmail

### Labels Configurables
- **GMAIL_SEARCH_LABEL**: Label para buscar nuevos tickets (configurable en Settings, default sugerido: "OmniTicket")
- **GMAIL_PROCESSED_LABEL**: Label para marcar procesados (configurable en Settings, default sugerido: "OmniTicket/Procesado")

### Flujo
1. Usuario recibe email de supermercado
2. Usuario aplica manualmente el label configurado en GMAIL_SEARCH_LABEL
3. Al hacer sync, OmniTicket busca emails con ese label y sin el label de GMAIL_PROCESSED_LABEL
4. Después de procesar exitosamente, se añade el label GMAIL_PROCESSED_LABEL
5. En futuros syncs, ese email se ignora

## Almacenamiento en Spreadsheet

### Hoja "Gastos" — Schema de Columnas (A:J)
| Col | Campo | Tipo | Ejemplo |
|-----|-------|------|---------|
| A | ID Ticket | string (UUID) | "a1b2c3d4..." |
| B | Tienda | string | "Mercadona" |
| C | Fecha | string YYYY-MM-DD | "2025-01-15" |
| D | Producto (original) | string | "COCA COLA ZERO 2L PET" |
| E | Categoría | string | "Bebidas" |
| F | Precio Unitario | number | 1.50 |
| G | Cantidad | number | 2 |
| H | Unidad | string | "" |
| I | Total Línea | number | 2.90 |
| J | Nombre Normalizado | string | "Coca Cola Zero 2L" |

> **Atención**: El orden de columnas difiere de versiones anteriores de la documentación. F es precio_unitario y G es cantidad (no al revés).

### Línea Especial de Total de Ticket
Cada ticket tiene una línea final especial:
- Col D (Producto): "--- TOTAL TICKET ---"
- Col I (Total): monto total del ticket
- Resto de campos: vacíos o con el ID/tienda/fecha del ticket

### Hoja "Historial"
Resumen de tickets procesados. Se usa para la vista "Tickets Recientes":
- Campos: id, fecha, tienda, total

### Hoja "Rules"
Reglas de categorización del usuario:
- 3 columnas: pattern | normalized | category

### Hoja "Categorias"
Categorías gestionadas por el usuario:
- 3 columnas: name | description | status ('active' | 'inactive')

### Hoja "Config" (antes "Settings")
Configuración clave-valor:
| Clave | Valor |
|-------|-------|
| GMAIL_SEARCH_LABEL | "OmniTicket" |
| GMAIL_PROCESSED_LABEL | "OmniTicket/Procesado" |
| GEMINI_API_KEY | "" |

## Reglas de Consistencia

### Fechas
- Siempre en formato YYYY-MM-DD
- Si email/ticket no tiene año, asumir año actual
- Fechas futuras: rechazar o ajustar al año anterior

### Importes
- Siempre números positivos
- Descuentos: valor positivo que se resta al precio total de línea
- Validar: suma de líneas ≈ total_ticket (tolerancia de 0.01€)

### Productos Duplicados
- Permitidos: un mismo producto puede aparecer en múltiples líneas del mismo ticket
- El nombre normalizado debe ser consistente para el mismo producto

### Categorización Ambigua
Casos especiales:
- "Agua con gas" → Bebidas (NO Agua)
- "Queso rallado" → Lácteos (aunque esté procesado)
- "Tomate frito lata" → Otros (aunque sea vegetal, está procesado)
- "Pollo empanado" → Carne (aunque tenga pan)

## Privacidad y Seguridad

### Datos del Usuario
- Todos los datos permanecen en el ecosistema Google del usuario
- No hay servidor backend: procesamiento 100% client-side
- API Key de Gemini se guarda en el Spreadsheet del usuario (no en código ni en servidor)

### Acceso a Gmail
- Solo lectura de threads (scope `gmail.modify` incluye lectura)
- Solo threads marcados con el label configurado
- No se eliminan ni modifican emails (solo se añaden labels)

### Acceso a Sheets
- Lectura/escritura solo del spreadsheet "OmniTicket_DB" (scope `drive.file`)
- No se accede a otros archivos del usuario
