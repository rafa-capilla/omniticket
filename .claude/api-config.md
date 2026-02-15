# OmniTicket - Configuración de APIs

## Google OAuth 2.0

### Cliente OAuth
- **CLIENT_ID**: `493268705547-fnbs5b5op3e9km8mptiimck61opiuot8.apps.googleusercontent.com`
- **Ubicación**: Hardcoded en `App.tsx:10`
- **Tipo**: Client-side OAuth (Implicit Flow)
- **Librería**: Google Identity Services (gsi client)

### Scopes Requeridos
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.labels
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.file
```

#### Detalle de Scopes
1. **gmail.readonly**: Leer contenido de emails
2. **gmail.labels**: Crear/modificar labels
3. **gmail.modify**: Añadir labels a threads
4. **spreadsheets**: Crear/editar spreadsheets
5. **drive.file**: Crear archivos en Drive (solo los creados por la app)

### Flujo de Autenticación
1. Usuario hace clic en "Conectar Google Account"
2. Se abre popup de Google OAuth
3. Usuario autoriza los scopes
4. Google devuelve access token (JWT)
5. Token se guarda en memoria (no persistente)
6. Token se usa en headers: `Authorization: Bearer {token}`

### Manejo de Sesión
- **Duración**: Token expira según política de Google (típicamente 1 hora)
- **Renovación**: No implementada - usuario debe volver a login
- **Logout**: Revoca token y limpia estado local
- **Error 401**: Dispara logout automático

## Gmail API

### Endpoints Usados
```
GET https://gmail.googleapis.com/gmail/v1/users/me/threads?q={query}
GET https://gmail.googleapis.com/gmail/v1/users/me/threads/{threadId}
POST https://gmail.googleapis.com/gmail/v1/users/me/threads/{threadId}/modify
```

### Query de Búsqueda
```
label:OmniTicket -label:OmniTicket/Procesado
```
- Busca threads con label "OmniTicket"
- Excluye threads ya procesados
- Labels son configurables desde Settings

### Estructura de Thread
```typescript
{
  id: string,
  messages: [
    {
      id: string,
      payload: {
        parts: [ // Partes del email (HTML, texto, attachments)
          {
            mimeType: string,
            body: { data: string } // Base64 encoded
          }
        ]
      }
    }
  ]
}
```

### Extracción de Contenido
- Se lee el primer mensaje del thread
- Se busca parte con `text/html` o `text/plain`
- Se decodifica de Base64
- Se pasa raw a Gemini (no se sanitiza HTML)

### Añadir Label
```json
POST /threads/{threadId}/modify
{
  "addLabelIds": ["Label_123"]
}
```

## Google Sheets API

### Endpoints Usados
```
POST https://sheets.googleapis.com/v4/spreadsheets
GET  https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}
POST https://sheets.googleapis.com/v4/spreadsheets/{id}/values:append
POST https://sheets.googleapis.com/v4/spreadsheets/{id}/values:batchUpdate
PUT  https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}
```

### Creación de Spreadsheet
```json
{
  "properties": { "title": "OmniTicket_DB" },
  "sheets": [
    { "properties": { "title": "Settings" } },
    { "properties": { "title": "Gastos", "gridProperties": { "frozenRowCount": 1 } } },
    { "properties": { "title": "Rules", "gridProperties": { "frozenRowCount": 1 } } },
    { "properties": { "title": "Mapping_Cache" } }
  ]
}
```

### Estructura de Hojas

#### Settings (A1:B5)
| Clave | Valor |
|-------|-------|
| GMAIL_SEARCH_LABEL | "OmniTicket" |
| GMAIL_PROCESSED_LABEL | "OmniTicket/Procesado" |
| GEMINI_API_KEY | "" |
| LAST_SYNC | "Nunca" |

#### Gastos (A1:I1 header + datos)
| ID Ticket | Tienda | Fecha | Producto | Categoría | Cantidad | P. Unitario | Descuento | Total Línea |
|-----------|--------|-------|----------|-----------|----------|-------------|-----------|-------------|

#### Rules (A1:C1 header + datos)
| Original_Pattern | Normalized_Name | Category |
|------------------|-----------------|----------|

#### Mapping_Cache (columnas implícitas)
| original | simplificado |
|----------|--------------|

### Formato de Append
```json
{
  "range": "Gastos!A:I",
  "values": [
    ["uuid-123", "Mercadona", "2025-01-15", "Coca Cola Zero 2L", "Bebidas", 2, 1.50, 0.10, 2.90]
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
name = 'OmniTicket_DB' and
mimeType = 'application/vnd.google-apps.spreadsheet' and
trashed = false
```

### Respuesta
```json
{
  "files": [
    {
      "id": "1abc...",
      "name": "OmniTicket_DB",
      "mimeType": "application/vnd.google-apps.spreadsheet"
    }
  ]
}
```

## Gemini AI API

### Configuración
- **Librería**: `@google/genai` v1.41.0
- **Modelo**: `gemini-3-pro-preview` (versión preview)
- **API Key**: Almacenada en spreadsheet del usuario (Settings!B3)
- **Inicialización**: `new GoogleGenAI({ apiKey: process.env.API_KEY })`

⚠️ **NOTA**: `process.env.API_KEY` debe estar definido en el entorno. Actualmente usa variable de entorno, pero debería leer de spreadsheet.

### Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent
```

### Extracción de Tickets
```typescript
{
  model: "gemini-3-pro-preview",
  contents: "Analiza el contenido...",
  config: {
    systemInstruction: "Eres un asistente experto...",
    responseMimeType: "application/json",
    responseSchema: { /* JSON Schema */ }
  }
}
```

#### Response Schema para Tickets
```typescript
{
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    tienda: { type: Type.STRING },
    fecha: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nombre: { type: Type.STRING },
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

### Normalización de Productos
```typescript
{
  model: "gemini-3-pro-preview",
  contents: "Normaliza estos productos...",
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          simplificado: { type: Type.STRING }
        }
      }
    }
  }
}
```

### Límites y Consideraciones
- **Batch size**: Máximo 30 productos por llamada (configurado en código)
- **Rate limiting**: No implementado (puede fallar con muchos productos)
- **Costo**: Se carga a la cuenta Gemini del usuario (API key propia)
- **Fallback**: No hay - si Gemini falla, el proceso se detiene

## Variables de Entorno

### .env.local (local development)
```bash
API_KEY=tu_gemini_api_key_aqui
```

⚠️ **PROBLEMA ACTUAL**: La app usa `process.env.API_KEY` pero debería leer desde el spreadsheet (`settings.GEMINI_API_KEY`)

### Vite Environment Variables
- Vite solo expone variables con prefijo `VITE_`
- Variables sin prefijo NO están disponibles en el navegador
- `process.env.API_KEY` solo funciona en build de servidor (no en cliente)

### Solución Recomendada
Cambiar en `SyncEngine.ts` y `NormalizationService.ts`:
```typescript
// Actual (INCORRECTO para client-side)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Debería ser
const ai = new GoogleGenAI({ apiKey: this.config.getSettings().GEMINI_API_KEY });
```

## Seguridad

### Almacenamiento de Secretos
- ✅ **OAuth Token**: Solo en memoria, no persiste
- ⚠️ **Gemini API Key**: En spreadsheet del usuario (visible si tiene acceso al sheet)
- ❌ **CLIENT_ID**: Hardcoded en código fuente (público)

### Riesgos
1. **CLIENT_ID expuesto**: Normal para OAuth client-side, pero limitar dominio autorizado
2. **API Key en Sheet**: Usuario podría compartir sheet y exponer su API key
3. **Sin backend**: No hay forma de rate-limiting o monitoreo de abuso

### Mejores Prácticas
- No compartir el spreadsheet "OmniTicket_DB"
- Regenerar API Key de Gemini periódicamente
- Configurar dominio autorizado en Google Cloud Console para el CLIENT_ID
- Considerar backend proxy para Gemini API (ocultar API key)

## Testing y Debug

### Headers Comunes
```javascript
{
  "Authorization": "Bearer {access_token}",
  "Content-Type": "application/json"
}
```

### Errores Comunes
| Código | Causa | Solución |
|--------|-------|----------|
| 401 | Token expirado | Hacer logout y volver a login |
| 403 | Falta scope | Revisar scopes en OAuth consent |
| 404 | Spreadsheet no encontrado | Ejecutar `ensureDatabase()` |
| 429 | Rate limit | Esperar o implementar retry con backoff |

### Logging
- `console.error()` en todos los servicios
- No hay telemetría ni analytics
- Errores se muestran como alerts al usuario
