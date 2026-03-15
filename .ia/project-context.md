# OmniTicket - Contexto del Proyecto

## Descripción General
OmniTicket es una aplicación web que permite a los usuarios controlar de forma precisa y centralizada sus gastos de supermercados, identificando dónde se va el dinero a través del análisis automatizado de tickets.

## Arquitectura Técnica

### Stack
- **Frontend**: React 19.2 + TypeScript 5.9
- **Build Tool**: Vite 6.4
- **Styling**: Tailwind CSS 3.4.17 — compilado en build-time via PostCSS (`tailwind.config.js` + `postcss.config.js`). **No se usa CDN.**
- **Utilidades CSS**: clsx 2.1 + tailwind-merge 3.0
- **Iconos**: Lucide React 0.577
- **Visualización**: Recharts 3.7
- **Validación**: Zod 4.3.6 (solo para el schema de tickets de Gemini)
- **IA**: Google Gemini AI (`@google/genai` 1.41)

### Estructura del Proyecto
```
omniticket/
├── services/                    # Lógica de negocio y servicios
│   ├── apiFetch.ts              # Helper HTTP centralizado (verifica response.ok, maneja 401/429)
│   ├── retry.ts                 # withRetry() con backoff exponencial para errores 429
│   ├── SyncEngine.ts            # Motor de sincronización Gmail → Gemini → Sheets
│   ├── ConfigService.ts         # Gestión de configuración y bootstrap del spreadsheet
│   ├── AIAnalysisService.ts     # Análisis libre con Gemini (lente "Análisis")
│   ├── GmailService.ts          # Integración con Gmail API
│   ├── SheetsService.ts         # Integración con Google Sheets API
│   └── GoogleAuthService.ts     # Gestión de OAuth 2.0 + silent refresh
├── components/                  # Componentes React separados
│   ├── HistoryView.tsx          # Vista de tickets históricos (solo presentación)
│   ├── RulesView.tsx            # CRUD de reglas de categorización
│   ├── CategoriesManager.tsx    # CRUD de categorías
│   ├── LensesView.tsx           # KPIs + gráficos + selector de lente
│   ├── AIAnalysisView.tsx       # Interfaz de análisis libre con Gemini
│   ├── SettingsView.tsx         # Vista de configuración
│   └── ToastList.tsx            # Sistema de notificaciones toast
├── contexts/
│   └── AppContext.tsx           # Context de React (token, dbId, toast, loadData)
├── lib/
│   ├── utils.ts                 # Helpers compartidos: safeText, safeNum, COLORS, authHeaders
│   └── constants.ts             # Constantes: GastosCol, SheetName, URLs de APIs, TOTAL_TICKET_MARKER
├── schemas/
│   └── ticketSchema.ts          # Schema Zod para validación de respuesta de Gemini
├── types.ts                     # Tipos TypeScript compartidos
├── App.tsx                      # Orchestrador principal (~349 líneas)
├── index.tsx                    # Entry point
├── index.css                    # Tailwind directives + utilidades custom
├── tailwind.config.js           # Configuración de Tailwind (content paths, animaciones)
└── postcss.config.js            # PostCSS (tailwindcss + autoprefixer)
```

## Flujo Principal de Funcionamiento

### 1. Autenticación (GoogleAuthService)
- OAuth 2.0 de Google (flujo implícito) con scopes: `gmail.modify`, `spreadsheets`, `drive.file`
- Token en `localStorage` con renovación automática silenciosa + botón "Reconectar" manual
- Ver detalles completos en `api-config.md` → "Google OAuth 2.0"

### 2. Inicialización de Base de Datos (ConfigService)
- Se busca/crea un spreadsheet llamado "OmniTicket_DB" en Google Drive del usuario
- `isBootstrapped` ref en App.tsx evita re-ejecutar este paso cuando el token se renueva silenciosamente
- Estructura del Spreadsheet:
  - **Config** (antes llamada "Settings"): Configuración (labels Gmail, API key Gemini)
  - **Gastos**: Líneas de productos de todos los tickets procesados (10 columnas, A:J)
  - **Historial**: Resumen de tickets procesados
  - **Rules**: Reglas de categorización definidas por el usuario
  - **Categorias**: Categorías activas/inactivas gestionadas por el usuario

### 3. Sincronización de Tickets (SyncEngine)
1. Busca emails en Gmail con label configurable (default: "OmniTicket") sin label "Procesado"
2. Por cada email encontrado (**procesamiento secuencial, uno a la vez**):
   - Extrae el contenido del thread con parser multipart recursivo
   - Envía el contenido a Gemini AI con schema estructurado
   - Gemini responde con JSON: tienda, fecha, items[], total_ticket — extrae Y normaliza en una sola llamada
   - Valida con Zod (ticketSchema)
   - Guarda las líneas del ticket en hoja "Gastos"
   - Marca el email con label "OmniTicket/Procesado"
   - Informa del resultado (éxito o error) individualmente por ticket
3. Las llamadas a Gemini usan `withRetry()` con backoff exponencial (1s/2s/4s) para errores 429

> **Diseño deliberado**: El procesamiento es secuencial (no paralelo) para: (1) reducir alucinaciones en tickets grandes, (2) poder marcar cada ticket como "Procesado" solo si tiene éxito, (3) facilitar el seguimiento de errores por ticket.

### 4. Lentes Analíticas (LensesView)
Cuatro tipos de lentes (vistas analíticas):
- **Products**: Gasto agrupado por nombre normalizado del producto (col J de Gastos)
- **Categories**: Gasto agrupado por categoría (Pie chart)
- **Stores**: Gasto agrupado por establecimiento (col B de Gastos)
- **Análisis**: Análisis libre en lenguaje natural vía Gemini (AIAnalysisView)

Dashboards incluyen:
- KPIs: Gasto total, ticket promedio, categoría top, número de tickets
- Gráficos: Pie chart para categorías, bar charts para productos/tiendas
- Filtros: Rango de fechas configurable (default: últimos 30 días)
- Tabla detallada con % de impacto sobre gasto total

## Modelo de Datos

### TicketData (de Gemini)
```text
{
  id: string           // UUID generado por el código, no por Gemini
  tienda: string       // Nombre del establecimiento
  fecha: string        // YYYY-MM-DD
  items: TicketItem[]  // Líneas de productos
  total_ticket: number // Total del ticket
}
```

### TicketItem
```text
{
  nombre: string              // Nombre del producto (Gemini extrae y normaliza en una sola pasada)
  nombre_normalizado?: string // Nombre normalizado (opcional, asignado post-extracción)
  categoria: string           // Categoría según las del spreadsheet
  precio_unitario: number
  cantidad: number
  descuento: number           // Valor positivo (ej: 2€ de descuento = 2, no -2)
  precio_total_linea: number
}
```

### Rule (Reglas de usuario)
```text
{
  pattern: string       // Texto a buscar (case-insensitive, contains)
  normalized: string    // Nombre normalizado
  category: string      // Categoría asignada (máxima prioridad sobre Gemini)
}
```

### Category (Categorías gestionadas por el usuario)
```text
{
  name: string          // Nombre único de la categoría
  description: string   // Descripción opcional
  status: 'active' | 'inactive'
}
```

## Servicios Clave

> **apiFetch** y **withRetry**: helpers HTTP centralizados usados por todos los servicios. Ver detalles en `api-config.md`.

### SyncEngine
Motor principal de sincronización. Coordina Gmail → Gemini → Sheets de forma secuencial.
- Llama a `extractDataWithAI()` con `withRetry()` por si hay rate-limit de Gemini
- Reporta progreso ticket a ticket: `"✓ Ticket (2/5): Mercadona (2025-01-15)"`
- Resumen final: "X OK, Y con error"

### ConfigService
- Busca/crea el spreadsheet "OmniTicket_DB" (sistema de migraciones idempotente)
- Lee/actualiza settings (labels Gmail, API key Gemini)
- La API key de Gemini **se lee del spreadsheet** en tiempo de ejecución (no de variables de entorno)

### AIAnalysisService
Análisis libre con Gemini para la lente "Análisis":
- Recibe un prompt del usuario + datos agregados (por categoría, producto, tienda)
- Usa `withRetry()` para tolerar rate-limits
- Devuelve: texto de análisis + datos para un gráfico (pie o bar)
- **No es** el servicio que extrae tickets (eso lo hace SyncEngine directamente)

### SheetsService
Abstrae operaciones con Google Sheets API:
- `appendExpense`: añade líneas de ticket (A:J, 10 columnas)
- `fetchAllLineItems`: lee todas las líneas de gastos
- `fetchHistory`: obtiene resumen de tickets del Historial
- `getRules/addRule/updateRule/deleteRule`: gestiona reglas
- `getCategories/addCategory/updateCategory/deleteCategory`: gestiona categorías
- `updateCategoryInGastos`: reasigna productos a otra categoría al borrar una

### GmailService
- `searchThreads`: busca threads por query (label configurable)
- `getThreadContent`: extrae texto del thread con `extractTextFromPayload()` — búsqueda **recursiva** en la estructura multipart: prefiere `text/plain` > `text/html` > recursión en sub-partes. Itera **todos** los mensajes del thread y concatena el texto.
- `addLabelToThread`: añade label "Procesado" al thread

### GoogleAuthService
- `init()`, `login()`, `silentRefresh()`, `isTokenExpiringSoon()`, `logout()`
- Ver flujo detallado en `api-config.md` → "Google OAuth 2.0"

## Consideraciones de Seguridad
> Ver detalles completos en `api-config.md` → "Seguridad" y `business-rules.md` → "Privacidad y Seguridad"

- No hay backend: toda la lógica corre client-side, datos en el ecosistema Google del usuario
- CSP restrictiva en `index.html`, API key en spreadsheet (no en código)

## Sistema de Notificaciones
Los errores y mensajes se muestran con **toasts** (no `alert()`):
- Variantes: `success` (verde), `error` (rojo), `info` (gris oscuro)
- Auto-dismiss tras 5 segundos
- Máximo 3 simultáneos (cola FIFO)
- Disponibles en todos los componentes via `useApp().toast`

## Convenciones de Código
- Componentes React funcionales con hooks
- TypeScript estricto con validación Zod (solo para tickets de Gemini)
- Tailwind CSS build-time (utility-first)
- Nombres de archivos: PascalCase para servicios y componentes
- Manejo de errores: try/catch con mensajes descriptivos, toast al usuario
- `safeText()`, `safeNum()`, `authHeaders()` desde `lib/utils.ts` para sanitizar valores y construir headers
- Constantes centralizadas en `lib/constants.ts`: índices de columnas (`GastosCol`), nombres de hojas (`SheetName`), URLs base de APIs
- Contexto `AppContext`: provee `token`, `dbId`, `toast`, `loadData` a todos los componentes via `useApp()`

## Limitaciones Conocidas
- Depende de Gemini AI (puede cambiar schema o comportamiento)
- Sin backend: no hay autenticación persistente ni rate-limiting propio
- Sin gestión de múltiples usuarios o workspaces
- CLIENT_ID hardcoded en `App.tsx` (normal para OAuth client-side)
