# OmniTicket - Configuración de APIs

## Google OAuth 2.0

### Cliente OAuth
- **CLIENT_ID**: `493268705547-fnbs5b5op3e9km8mptiimck61opiuot8.apps.googleusercontent.com`
- **Ubicación**: Hardcoded en `App.tsx` (constante `CLIENT_ID`)
- **Tipo**: Client-side OAuth (Implicit Flow / Token flow)
- **Librería**: Google Identity Services (GSI client, cargada via script tag en `index.html`)

### Scopes Requeridos
```
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.file
```

#### Detalle de Scopes
1. **gmail.modify**: Leer contenido de emails Y añadir labels a threads (cubre gmail.readonly + gmail.labels)
2. **spreadsheets**: Crear y editar spreadsheets (leer y escribir)
3. **drive.file**: Buscar y crear archivos en Drive (solo los creados por la app)

### Flujo de Autenticación
1. Usuario hace clic en "Conectar Google Account"
2. Se abre popup de Google OAuth (`prompt: 'consent'`)
3. Usuario autoriza los scopes
4. Google devuelve access token
5. Token se guarda en `localStorage.google_access_token`
6. Timestamp de expiración se guarda en `localStorage.google_token_expires_at` (ahora + 1 hora)
7. Token se usa en headers: `Authorization: Bearer {token}`

### Manejo de Sesión
- **Duración**: Token expira en ~1 hora (política de Google)
- **Renovación automática**: Intervalo cada 60s en `App.tsx` comprueba `isTokenExpiringSoon()`. Si quedan < 5 min, llama a `silentRefresh()` (sin UI)
- **Renovación manual**: Botón "Reconectar" en el header llama a `GoogleAuthService.login()` sin hacer logout, renovando el token sin perder el estado de la app
- **Logout**: Elimina token y expiresAt de localStorage. Vuelve a la pantalla de login
- **Error 401**: `apiFetch()` lanza `Error("401")` → App.tsx muestra toast "Sesión expirada" y el usuario puede usar el botón "Reconectar"
- **Sin re-bootstrap en refresh**: El ref `isBootstrapped` en App.tsx evita llamar a `ConfigService.ensureDatabase()` de nuevo cuando el token se renueva silenciosamente

## apiFetch — Helper HTTP Centralizado

Todos los servicios usan `apiFetch()` (en `services/apiFetch.ts`) en lugar de `fetch()` directamente.

```text
apiFetch(url, init?) → Promise<Response>
```

Comportamiento:
- Llama a `fetch(url, init)`
- Si `response.ok`: devuelve el Response
- Si `response.status === 401`: lanza `Error("401")`
- Si `response.status === 429`: lanza `Error("Rate limit alcanzado. Inténtalo de nuevo en unos segundos.")`
- Otros errores: extrae `body.error.message` del JSON de Google y lo lanza como Error descriptivo

## withRetry — Reintentos con Backoff Exponencial

```text
withRetry(fn, maxAttempts = 3) → Promise<T>
```

- Reintenta solo si el error contiene "429" o "Rate limit" en el mensaje
- Esperas: 1s (intento 1→2), 2s (intento 2→3), 4s (intento 3→4)
- Otros errores se propagan inmediatamente sin reintentar
- Usado en: `SyncEngine.extractDataWithAI()` y `AIAnalysisService.analyze()`

## Gmail API

### Endpoints Usados
```
GET  https://gmail.googleapis.com/gmail/v1/users/me/threads?q={query}
GET  https://gmail.googleapis.com/gmail/v1/users/me/threads/{threadId}?format=full
POST https://gmail.googleapis.com/gmail/v1/users/me/threads/{threadId}/modify
GET  https://gmail.googleapis.com/gmail/v1/users/me/labels
POST https://gmail.googleapis.com/gmail/v1/users/me/labels
```

### Query de Búsqueda
```
label:{GMAIL_SEARCH_LABEL} -label:{GMAIL_PROCESSED_LABEL}
```
- Labels son configurables desde Settings
- Default sugerido: `label:OmniTicket -label:OmniTicket/Procesado`

### Estructura de Thread
```text
{
  id: string,
  messages: [
    {
      id: string,
      payload: {
        mimeType: string,       // "multipart/mixed", "text/plain", "text/html", etc.
        body: { data?: string }, // Base64url encoded (puede estar vacío en multipart)
        parts?: [               // Sub-partes en emails multipart
          {
            mimeType: string,
            body: { data?: string },
            parts?: [...]       // Puede anidar indefinidamente
          }
        ]
      }
    }
  ]
}
```

### Extracción de Contenido (GmailService)
La función `extractTextFromPayload(payload)` es **recursiva**:
1. Si `payload.body.data` existe → decodifica Base64url (con try/catch para padding incorrecto)
2. Si no, busca sub-parte con `mimeType === 'text/plain'` y recursa
3. Si no hay text/plain, busca `mimeType === 'text/html'` y recursa
4. Si no hay ninguno, recursa por todas las partes restantes hasta encontrar texto
5. `getThreadContent()` itera **todos los mensajes del thread** y concatena el texto extraído de cada uno

### Añadir Label
```text
POST /threads/{threadId}/modify
{ "addLabelIds": ["Label_123"] }
```
Si el label no existe, se crea primero con `POST /labels { "name": "OmniTicket/Procesado" }`.

## Google Sheets API

### Endpoints Usados
```
POST https://sheets.googleapis.com/v4/spreadsheets
GET  https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}
POST https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}:append
PUT  https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}
POST https://sheets.googleapis.com/v4/spreadsheets/{id}/values:batchUpdate
POST https://sheets.googleapis.com/v4/spreadsheets/{id}:batchUpdate  (para añadir hojas)
```

### Creación del Spreadsheet (5 hojas)
```text
{
  "properties": { "title": "OmniTicket_DB" },
  "sheets": [
    { "properties": { "title": "Config" } },
    { "properties": { "title": "Gastos", "gridProperties": { "frozenRowCount": 1 } } },
    { "properties": { "title": "Historial", "gridProperties": { "frozenRowCount": 1 } } },
    { "properties": { "title": "Rules", "gridProperties": { "frozenRowCount": 1 } } },
    { "properties": { "title": "Categorias", "gridProperties": { "frozenRowCount": 1 } } }
  ]
}
```

### Estructura de Hojas

#### Config (A1:B)
| Clave | Valor |
|-------|-------|
| GMAIL_SEARCH_LABEL | "OmniTicket" |
| GMAIL_PROCESSED_LABEL | "OmniTicket/Procesado" |
| GEMINI_API_KEY | "" |

#### Gastos (A1:J1 header + datos) — 10 columnas
| ID Ticket | Tienda | Fecha | Producto | Categoría | P. Unitario | Cantidad | Unidad | Total Línea | Nombre Normalizado |
|-----------|--------|-------|----------|-----------|-------------|----------|--------|-------------|-------------------|
| Col A | Col B | Col C | Col D | Col E | Col F | Col G | Col H | Col I | Col J |

> La última columna (J) contiene el nombre normalizado por Gemini. Se usa en las lentes de análisis.

#### Historial (A1:... header + datos)
Resumen de tickets: id, fecha, tienda, total, estado

#### Rules (A1:C1 header + datos)
| pattern | normalized | category |
|---------|-----------|----------|

#### Categorias (A1:C1 header + datos)
| name | description | status |
|------|-------------|--------|

### Formato de Append para Gastos
```text
POST /spreadsheets/{id}/values/Gastos!A:J:append
{
  "range": "Gastos!A:J",
  "values": [
    ["uuid-123", "Mercadona", "2025-01-15", "COCA COLA ZERO 2L PET", "Bebidas", 1.50, 2, "", 2.90, "Coca Cola Zero 2L"],
    ["uuid-123", "Mercadona", "2025-01-15", "--- TOTAL TICKET ---", "", "", "", "", 2.90, ""]
  ]
}
```

## Google Drive API

### Endpoints Usados
```
GET https://www.googleapis.com/drive/v3/files?q={query}
```

### Query de Búsqueda de Spreadsheet
```
name = 'OmniTicket_DB' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false
```

## Gemini AI API

### Configuración
- **Librería**: `@google/genai` v1.41.0
- **Modelo**: `gemini-2.5-pro`
- **API Key**: Se lee en tiempo de ejecución del spreadsheet (`settings.GEMINI_API_KEY` via `ConfigService.getSettings()`). **No se usan variables de entorno.**
- **Inicialización**: `new GoogleGenAI({ apiKey: settings.GEMINI_API_KEY })`

### Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent
```

### Extracción de Tickets (SyncEngine)
Gemini recibe el contenido raw del email y devuelve JSON estructurado.
Extrae Y normaliza los nombres de productos en una sola llamada.

```text
config: {
  responseMimeType: "application/json",
  responseSchema: { /* JSON Schema con tienda, fecha, items[], total_ticket */ }
}
```

#### Response Schema para Tickets
```text
{
  type: Type.OBJECT,
  properties: {
    tienda: { type: Type.STRING },
    fecha: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nombre: { type: Type.STRING },         // Nombre YA normalizado
          categoria: { type: Type.STRING },
          precio_unitario: { type: Type.NUMBER },
          cantidad: { type: Type.NUMBER },
          descuento: { type: Type.NUMBER },
          precio_total_linea: { type: Type.NUMBER }
        }
      }
    },
    total_ticket: { type: Type.NUMBER }
  }
}
```

### Análisis Libre (AIAnalysisService)
Recibe datos agregados + pregunta del usuario. Devuelve análisis en texto + datos para gráfico.

```text
{
  model: "gemini-2.5-pro",
  contents: "...",  // datos agregados + prompt del usuario
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        analysis_text: { type: Type.STRING },
        chart_type: { type: Type.STRING },   // "pie" | "bar"
        chart_title: { type: Type.STRING },
        chart_data: { type: Type.ARRAY, items: { ... } }
      }
    }
  }
}
```

### Rate Limiting
- **Implementado**: `withRetry()` en `services/retry.ts` reintenta automáticamente en errores 429
- Backoff exponencial: 1s → 2s → 4s (máximo 3 intentos)
- Afecta a: `SyncEngine.extractDataWithAI()` y `AIAnalysisService.analyze()`

## Seguridad

### Almacenamiento de Secretos
- ✅ **Gemini API Key**: En spreadsheet del usuario (no en código ni servidor)
- ⚠️ **OAuth Token**: En `localStorage` con timestamp de expiración (necesario para persistir sesión entre recargas)
- ⚠️ **CLIENT_ID**: Hardcoded en código fuente — normal para OAuth client-side, pero limitar dominio autorizado en Google Cloud Console

### Content-Security-Policy
`index.html` incluye meta tag CSP que restringe:
- `script-src`: solo `'self'` y `accounts.google.com` (no `unsafe-inline`)
- `connect-src`: Gmail, Sheets, Drive, Gemini y accounts.google.com
- `frame-src`: solo `accounts.google.com`

### Riesgos
1. **CLIENT_ID expuesto**: Normal para OAuth client-side; mitigar limitando dominios autorizados en Google Cloud Console
2. **API Key en Sheet**: Si el usuario comparte el spreadsheet, expone su API key de Gemini
3. **Token en localStorage**: Persiste entre recargas (mejora UX) pero accessible desde JS. Mitigado por CSP y TLS

### Mejores Prácticas
- No compartir el spreadsheet "OmniTicket_DB"
- Regenerar API Key de Gemini periódicamente
- Configurar dominio autorizado en Google Cloud Console para el CLIENT_ID

## Errores Comunes

| Código | Causa | Comportamiento actual |
|--------|-------|----------------------|
| 401 | Token expirado | Toast "Sesión expirada" + botón "Reconectar" en header |
| 403 | Falta scope | Error descriptivo via apiFetch |
| 404 | Spreadsheet no encontrado | `ensureDatabase()` lo crea automáticamente |
| 429 | Rate limit Gemini | `withRetry()` reintenta con backoff automáticamente |

## Build y Desarrollo

### Tailwind CSS
- **Modo**: Build-time PostCSS (NO CDN)
- **Config**: `tailwind.config.js` (content paths, keyframe `animate-fade-in`)
- **PostCSS**: `postcss.config.js` con plugins `tailwindcss` y `autoprefixer`
- **Entry CSS**: `index.css` con `@tailwind` directives + `.custom-scrollbar` utility

### Build Local
```bash
# SIEMPRE usar Docker (el volumen .:/app pisa node_modules del contenedor)
docker compose run --rm omniticket sh -c "npm ci && npm run build"

# Dev server
docker compose up  # expone :5173
```

### Logging
- `console.error()` en bloques catch de los servicios
- Errores al usuario via sistema de toasts (`toast.error()`)
- Progreso de sync via `setProgressMsg()` → indicador flotante en pantalla
- No hay telemetría ni analytics
