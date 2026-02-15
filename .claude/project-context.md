# OmniTicket - Contexto del Proyecto

## Descripción General
OmniTicket es una aplicación web que permite a los usuarios controlar de forma precisa y centralizada sus gastos de supermercados, identificando dónde se va el dinero a través del análisis automatizado de tickets.

## Arquitectura Técnica

### Stack
- **Frontend**: React 18.3 + TypeScript
- **Build Tool**: Vite 6.0
- **Styling**: Tailwind CSS 3.4
- **Visualización**: Recharts 3.7
- **Validación**: Zod 4.3
- **IA**: Google Gemini AI (@google/genai 1.41)

### Estructura del Proyecto
```
omniticket/
├── services/          # Lógica de negocio y servicios
│   ├── SyncEngine.ts          # Motor de sincronización Gmail → Sheets
│   ├── ConfigService.ts       # Gestión de configuración en Spreadsheet
│   ├── NormalizationService.ts # Normalización de productos con Gemini
│   ├── GmailService.ts        # Integración con Gmail API
│   ├── SheetsService.ts       # Integración con Google Sheets API
│   └── GoogleAuthService.ts   # Gestión de OAuth 2.0
├── schemas/
│   └── ticketSchema.ts        # Esquema Zod para validación de tickets
├── types.ts           # Tipos TypeScript compartidos
├── App.tsx            # Componente principal y vistas
└── index.tsx          # Entry point
```

## Flujo Principal de Funcionamiento

### 1. Autenticación (GoogleAuthService)
- Usuario se conecta vía OAuth 2.0 de Google
- Scopes requeridos: Gmail (lectura), Google Sheets (escritura/lectura), Drive (crear/buscar archivos)
- Access token se almacena en memoria para toda la sesión

### 2. Inicialización de Base de Datos (ConfigService)
- Se busca/crea un spreadsheet llamado "OmniTicket_DB" en Google Drive del usuario
- Estructura del Spreadsheet:
  - **Settings**: Configuración (labels Gmail, API key Gemini, última sincronización)
  - **Gastos**: Líneas de productos de todos los tickets procesados
  - **Rules**: Reglas de categorización definidas por el usuario
  - **Mapping_Cache**: Caché de normalizaciones realizadas por Gemini

### 3. Sincronización de Tickets (SyncEngine)
1. Busca emails en Gmail con label "OmniTicket" (configurable) no procesados
2. Por cada email encontrado:
   - Extrae el contenido del thread
   - Envía el contenido a Gemini AI con schema estructurado
   - Gemini responde con JSON estructurado: tienda, fecha, items[], total_ticket
   - Valida con Zod (ticketSchema)
   - Guarda las líneas del ticket en hoja "Gastos"
   - Marca el email con label "OmniTicket/Procesado"
3. Actualiza timestamp de última sincronización

### 4. Normalización con IA (NormalizationService)
- Gemini analiza nombres de productos raw (ej: "COCA COLA 2L PET") y los simplifica (ej: "Coca Cola 2L")
- Sistema de caché: evita procesar productos ya normalizados
- Sistema de reglas: el usuario puede definir patrones para override automático
- Batch processing: procesa hasta 30 productos por llamada

### 5. Visualización en "Lentes" (App.tsx)
Tres tipos de lentes (vistas analíticas):
- **Products**: Gasto agrupado por producto normalizado
- **Categories**: Gasto agrupado por categoría (Lácteos, Bebidas, etc.)
- **Stores**: Gasto agrupado por establecimiento

Dashboards incluyen:
- KPIs: Gasto total, ticket promedio, categoría top, número de tickets
- Gráficos: Pie chart para categorías, bar charts para productos/tiendas
- Filtros: Rango de fechas configurable
- Tabla detallada con % de impacto sobre gasto total

## Modelo de Datos

### TicketData (de Gemini)
```typescript
{
  id: string           // UUID generado
  tienda: string       // Nombre del establecimiento
  fecha: string        // YYYY-MM-DD
  items: TicketItem[]  // Líneas de productos
  total_ticket: number // Total del ticket
}
```

### TicketItem
```typescript
{
  nombre: string            // Nombre del producto
  categoria: string         // Una de las 7 categorías permitidas
  precio_unitario: number
  cantidad: number
  descuento: number        // Valor positivo
  precio_total_linea: number
}
```

### Rule (Reglas de usuario)
```typescript
{
  pattern: string       // Texto a buscar (case-insensitive)
  normalized: string    // Nombre normalizado
  category: string      // Categoría asignada
}
```

## Servicios Clave

### SyncEngine
Motor principal que orquesta todo el proceso de sincronización:
- Coordina Gmail, Sheets, y Gemini AI
- Maneja errores por ticket individual
- Reporta progreso en tiempo real
- Utiliza `gemini-3-pro-preview` con schema estructurado

### ConfigService
Gestiona la configuración persistente en el Spreadsheet del usuario:
- Busca/crea el spreadsheet "OmniTicket_DB"
- Lee/actualiza settings (labels, API keys, timestamps)
- Maneja errores 401 para logout automático

### NormalizationService
Normaliza nombres de productos usando Gemini:
- Respeta reglas del usuario (priority)
- Usa caché para evitar llamadas redundantes
- Procesa en batches de 30 productos max
- Guarda mappings en hoja "Mapping_Cache"

### SheetsService
Abstrae operaciones con Google Sheets API:
- appendExpense: añade líneas de ticket
- fetchAllLineItems: lee todas las líneas de gastos
- fetchHistory: obtiene resumen de tickets
- getMappings/saveMappings: gestiona caché de normalización
- getRules/addRule: gestiona reglas de usuario

### GmailService
Abstrae operaciones con Gmail API:
- searchThreads: busca emails por query
- getThreadContent: extrae contenido completo de thread
- addLabelToThread: marca emails como procesados

## Consideraciones de Seguridad
- API Key de Gemini se guarda en el Spreadsheet del usuario (no en servidor)
- OAuth access token solo en memoria del navegador
- No hay backend: toda la lógica corre client-side
- Los datos nunca salen del ecosistema Google del usuario

## Convenciones de Código
- Componentes React funcionales con hooks
- TypeScript estricto con validación Zod
- Tailwind CSS con utility-first approach
- Nombres de archivos: PascalCase para servicios y componentes
- Manejo de errores: try/catch con mensajes descriptivos
- Funciones helper: safeText() y safeNum() para sanitización

## Limitaciones Conocidas
- Depende de Gemini AI en preview (puede cambiar schema)
- Procesamiento síncrono (un ticket a la vez)
- Sin backend: no hay autenticación persistente
- Sin gestión de múltiples usuarios o workspaces
- Hardcoded CLIENT_ID en código fuente
