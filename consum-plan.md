# Plan de Integración de Tickets de Consum

## Índice

1. [Análisis del Problema](#1-análisis-del-problema)
2. [Investigación: Cómo Envía Consum los Tickets](#2-investigación-cómo-envía-consum-los-tickets)
3. [Análisis de la Arquitectura Actual](#3-análisis-de-la-arquitectura-actual)
4. [Estrategias Posibles (de más a menos duradera)](#4-estrategias-posibles)
5. [Estrategia Recomendada](#5-estrategia-recomendada)
6. [Plan de Implementación Detallado](#6-plan-de-implementación-detallado)
7. [Riesgos y Mitigaciones](#7-riesgos-y-mitigaciones)
8. [Pruebas y Validación](#8-pruebas-y-validación)
9. [Mantenimiento a Largo Plazo](#9-mantenimiento-a-largo-plazo)

---

## 1. Análisis del Problema

### ¿Qué son los tickets de Consum?

Consum es una cadena de supermercados cooperativa del levante español (Comunidad Valenciana, Cataluña, Murcia, Castilla-La Mancha, Andalucía y Aragón). Ofrece a sus socios/clientes la posibilidad de recibir tickets digitales a través de:

1. **Email**: Consum envía el ticket de compra por correo electrónico al socio registrado.
2. **App de Consum**: La app permite consultar el historial de compras y los tickets digitales.
3. **Área de cliente web**: Acceso al historial desde la web de Consum.

### ¿Por qué necesita un plan específico?

Aunque OmniTicket ya es capaz de procesar emails genéricos de supermercados vía Gemini, los tickets de Consum tienen particularidades que merecen atención especial:

- **Formato del email**: Los tickets de Consum llegan como **email HTML** con una estructura particular (tabla HTML con los productos, no texto plano). Algunos pueden incluir el ticket como **PDF adjunto** o como **imagen**.
- **Codificación de productos**: Consum usa códigos internos y abreviaturas específicas en los nombres de productos (ej: `YOGUR NAT AZU DANONE X4`, `LCH ENTR HACENDADO 1L`).
- **Frecuencia**: Si el usuario es socio activo de Consum, puede generar un volumen alto de tickets (compras frecuentes).
- **Perdurabilidad**: El formato del email puede cambiar sin previo aviso, por lo que la solución debe ser resiliente.

---

## 2. Investigación: Cómo Envía Consum los Tickets

### 2.1 Ticket por Email (Método Principal)

**Remitente típico**: `no-reply@consum.es` o similar.

**Formato del contenido**:
- Asunto: variaciones de "Tu ticket de compra" / "Ticket Consum" / "Resumen de tu compra"
- Cuerpo: HTML con tabla estructurada de productos
- Puede incluir: logo, dirección de la tienda, fecha/hora, lista de productos con precio, subtotales, descuentos de socio, IVA, total

**Estructura típica del email HTML de Consum**:
```
Cabecera: Logo Consum + datos de tienda
Tabla de productos:
  - Descripción del producto (nombre abreviado)
  - Cantidad
  - Precio unitario
  - Importe
Sección de descuentos (descuento socio, promociones)
Total
Pie: CIF, dirección fiscal, aviso legal
```

### 2.2 Posibles Variantes de Formato

| Variante | Descripción | Probabilidad |
|----------|-------------|--------------|
| **HTML tabla** | Ticket como tabla HTML en el cuerpo del email | Alta (formato principal) |
| **PDF adjunto** | Ticket como archivo PDF adjunto al email | Media |
| **Imagen adjunta** | Ticket escaneado o captura como imagen | Baja |
| **Texto plano** | Versión text/plain del multipart | Media-Baja |

### 2.3 Autoforwarding desde la App de Consum

Consum permite configurar el envío automático de tickets al email del socio. Esto es ideal para OmniTicket porque:
- No requiere intervención manual para reenviar
- Los tickets llegan directamente al Gmail del usuario
- Se pueden etiquetar automáticamente con filtros de Gmail

---

## 3. Análisis de la Arquitectura Actual

### 3.1 Flujo Actual de Procesamiento

```
Gmail (label: OmniTicket)
  → GmailGateway.searchThreads()
  → GmailGateway.getThreadContent()  [extrae text/plain o text/html]
  → GeminiGateway.extractTicketData() [Gemini parsea el contenido]
  → TicketValidator.validateTicketData() [Zod valida estructura]
  → RuleEngine.applyRulesToItems() [aplica reglas del usuario]
  → SheetsExpenseRepo.appendExpense() [guarda en Gastos]
  → GmailGateway.addLabelToThread() [marca como procesado]
```

### 3.2 Puntos Fuertes para Consum

| Componente | Estado | Notas |
|------------|--------|-------|
| **Arquitectura Ports & Adapters** | ✅ Excelente | Interfaces bien definidas, fácil de extender |
| **EmailGateway** | ✅ Compatible | Ya soporta búsqueda por labels y extracción multipart |
| **Extracción HTML** | ⚠️ Parcial | `extractTextFromPayload()` ya extrae text/html como fallback, pero no procesa PDFs adjuntos |
| **Gemini AI** | ✅ Flexible | El prompt es genérico y Gemini puede parsear HTML de tickets |
| **Prompt de Gemini** | ⚠️ Mejorable | No tiene instrucciones específicas para formatos HTML de supermercado |
| **Manejo de PDFs** | ❌ No soportado | Si Consum envía PDF adjunto, no se puede extraer el texto |
| **Labels automáticos** | ✅ Compatible | El usuario puede crear un filtro Gmail `from:*@consum.es` → label:OmniTicket |

### 3.3 Puntos Débiles / Gaps

1. **No hay extracción de adjuntos PDF**: Si el ticket viene como PDF, el flujo actual no puede procesarlo.
2. **HTML crudo a Gemini**: El HTML completo con estilos, scripts y metadatos puede confundir a Gemini o exceder límites de tokens.
3. **Sin limpieza de HTML**: No hay un paso que limpie el HTML antes de enviarlo a Gemini (eliminar CSS, scripts, etc.).
4. **Sin detección de tienda**: No hay lógica que detecte la tienda de origen para aplicar optimizaciones específicas.
5. **Nombres abreviados de Consum**: Los productos de Consum suelen tener nombres muy abreviados que requieren más esfuerzo de normalización.

---

## 4. Estrategias Posibles

### Estrategia A: "Autoforwarding + Filtros Gmail + Mejoras al Prompt" (RECOMENDADA)

**Concepto**: Aprovechar al máximo la infraestructura existente. Consum envía tickets al email del usuario → un filtro de Gmail los etiqueta automáticamente → OmniTicket los procesa como cualquier otro ticket, pero con un prompt de Gemini mejorado.

**Cambios necesarios**:
- Mejorar la limpieza de HTML antes de enviar a Gemini
- Enriquecer el prompt de Gemini con instrucciones para tickets HTML de supermercado
- Documentar la configuración del filtro de Gmail para Consum
- (Opcional) Soporte para extracción de PDFs adjuntos

**Durabilidad**: ⭐⭐⭐⭐⭐ — No depende de APIs externas de Consum, usa infraestructura estándar (Gmail + Gemini).

**Esfuerzo**: Bajo-Medio.

---

### Estrategia B: "API/Web Scraping de Consum"

**Concepto**: Crear un gateway que se conecte directamente a la plataforma de Consum para obtener tickets.

**Problemas fatales**:
- Consum NO tiene API pública documentada para terceros
- Web scraping requeriría credenciales del usuario de Consum (problema de seguridad)
- Cualquier cambio en la web/app de Consum rompería la integración
- Contradice la filosofía de OmniTicket (client-side, sin backend, ecosistema Google)
- Posible violación de ToS de Consum

**Durabilidad**: ⭐ — Extremadamente frágil, dependiente de la UI de Consum.

**Esfuerzo**: Alto. **Descartada.**

---

### Estrategia C: "Nuevo EmailGateway específico para Consum"

**Concepto**: Crear un `ConsumEmailGateway` que implemente `EmailGateway` con lógica específica de parsing para emails de Consum.

**Problemas**:
- Sobrecomplica la arquitectura sin beneficio real (Gemini ya puede parsear HTML)
- Duplica lógica de acceso a Gmail
- Difícil de mantener (dos gateways para el mismo servicio)
- Si Consum cambia el formato, hay que actualizar el parser manualmente

**Durabilidad**: ⭐⭐ — Parser manual es frágil ante cambios de formato.

**Esfuerzo**: Medio-Alto. **Descartada.**

---

### Estrategia D: "Importación manual de tickets (upload)"

**Concepto**: Añadir una funcionalidad para que el usuario pueda subir manualmente tickets (fotos, PDFs, texto copiado).

**Evaluación**: Es complementaria, no sustitutiva. Puede ser útil como fallback, pero no resuelve el flujo automático.

**Durabilidad**: ⭐⭐⭐⭐ — No depende de formato de email, pero requiere acción manual del usuario.

**Esfuerzo**: Medio. **Posible complemento futuro, no prioridad.**

---

## 5. Estrategia Recomendada

### Estrategia A: "Autoforwarding + Filtros Gmail + Mejoras al Pipeline"

Esta es la estrategia que **mejor equilibra durabilidad, esfuerzo y alineación con la arquitectura existente**.

**¿Por qué es la más duradera?**

1. **No depende de APIs de Consum**: Solo necesita que Consum siga enviando emails (algo que no van a dejar de hacer).
2. **Gemini como parser universal**: En lugar de escribir parsers frágiles para cada supermercado, se delega en IA que entiende contexto y formatos variados.
3. **Mejora para TODOS los supermercados**: Las mejoras en limpieza de HTML y prompt benefician a todos los tickets, no solo a Consum.
4. **Filtros de Gmail nativos**: Infraestructura de Google, extremadamente estable, el usuario ya la conoce.
5. **Sin nuevas dependencias**: No requiere librerías adicionales, APIs externas ni backend.

---

## 6. Plan de Implementación Detallado

### Fase 1: Mejora de la Extracción de Contenido de Email

**Objetivo**: Asegurar que el contenido HTML de emails de Consum llega limpio y estructurado a Gemini.

#### 1.1 Limpieza de HTML antes de enviar a Gemini

**Archivo a modificar**: `src/infrastructure/google-api/GmailGateway.ts`

**Problema actual**: `extractTextFromPayload()` devuelve el HTML crudo (con `<style>`, `<script>`, metadatos, etc.). Esto:
- Consume tokens innecesarios de Gemini
- Puede confundir al modelo con estilos CSS inline
- Reduce la calidad de extracción

**Solución propuesta**: Añadir una función `sanitizeHtmlContent(html: string): string` que:
1. Elimine tags `<style>`, `<script>`, `<head>` y su contenido
2. Elimine atributos de estilo (`style="..."`)
3. Convierta `<br>` y `</p>` en saltos de línea
4. Convierta `<td>` y `<th>` en separadores tabulares (para preservar estructura de tabla)
5. Elimine el resto de tags HTML, dejando solo texto estructurado
6. Limpie espacios en blanco excesivos
7. Limite el contenido a un máximo razonable de caracteres (~30.000) para no exceder tokens de Gemini

**Pseudocódigo**:
```typescript
function sanitizeHtmlContent(html: string): string {
  let clean = html;
  // 1. Eliminar bloques <style>, <script>, <head>
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/<head[\s\S]*?<\/head>/gi, '');
  // 2. Convertir tablas en texto estructurado
  clean = clean.replace(/<\/td>/gi, '\t');
  clean = clean.replace(/<\/tr>/gi, '\n');
  clean = clean.replace(/<\/th>/gi, '\t');
  // 3. Convertir saltos
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  clean = clean.replace(/<\/p>/gi, '\n');
  clean = clean.replace(/<\/div>/gi, '\n');
  clean = clean.replace(/<\/li>/gi, '\n');
  // 4. Eliminar todos los tags restantes
  clean = clean.replace(/<[^>]+>/g, '');
  // 5. Decodificar entidades HTML comunes
  clean = clean.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&euro;/g, '€')
               .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  // 6. Limpiar espacios
  clean = clean.replace(/[ \t]+/g, ' ');
  clean = clean.replace(/\n\s*\n/g, '\n');
  clean = clean.trim();
  // 7. Limitar tamaño
  if (clean.length > 30000) clean = clean.slice(0, 30000);
  return clean;
}
```

**Importante**: Esta función debe aplicarse SOLO cuando el payload es `text/html`. Si el payload es `text/plain`, se usa tal cual.

**Cambio en `extractTextFromPayload()`**: Tras decodificar el base64, detectar si el contenido es HTML y limpiarlo:
```typescript
export function extractTextFromPayload(payload: GmailPayload): string {
  if (payload.body?.data) {
    try {
      const decoded = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      // Si el mimeType es HTML, limpiar
      if (payload.mimeType === 'text/html') {
        return sanitizeHtmlContent(decoded);
      }
      return decoded;
    } catch {
      return '';
    }
  }
  // ... resto igual
}
```

#### 1.2 Soporte para Extracción de Adjuntos PDF (Opcional pero Recomendado)

**Problema**: Algunos emails de Consum pueden incluir el ticket como PDF adjunto. El flujo actual ignora los adjuntos.

**Archivo a modificar**: `src/infrastructure/google-api/GmailGateway.ts`

**Solución propuesta**:
1. Detectar si hay partes con `mimeType === 'application/pdf'` en el payload
2. Descargar el adjunto via Gmail API (`GET /messages/{id}/attachments/{attachmentId}`)
3. Enviar el PDF como base64 a Gemini (Gemini 2.5 Pro soporta PDFs directamente)
4. O bien: extraer texto del PDF con una librería client-side ligera

**Opción recomendada**: Enviar el PDF directamente a Gemini como contenido multimodal. Gemini 2.5 Pro puede leer PDFs nativamente, lo que es más robusto que parsear el PDF con JavaScript.

**Cambio en `AIGateway` interface**:
```typescript
export interface AIGateway {
  extractTicketData(
    emailContent: string,
    uuid: string,
    apiKey: string,
    categories: Category[],
    rules: Rule[],
    attachments?: Array<{ mimeType: string; data: string }>, // Nuevo parámetro opcional
  ): Promise<TicketData>;
}
```

**Nota**: Este cambio es **backward-compatible** al ser parámetro opcional. No rompe implementaciones existentes.

**Prioridad**: Media. Implementar si se confirma que Consum envía PDFs. Si solo envía HTML, no es necesario en la primera iteración.

---

### Fase 2: Mejora del Prompt de Gemini

**Objetivo**: Hacer que Gemini sea más preciso con tickets de supermercado, especialmente los que vienen en formato HTML y con nombres abreviados.

**Archivo a modificar**: `src/infrastructure/google-api/GeminiGateway.ts`

#### 2.1 Mejoras al System Instruction

**Prompt actual** (líneas 134-144 de GeminiGateway.ts):
```
Eres un asistente experto en contabilidad. Tu tarea es extraer datos estructurados de tickets de compra...
```

**Prompt mejorado propuesto**:
```
Eres un asistente experto en contabilidad y análisis de tickets de supermercado en España.
Tu tarea es extraer datos estructurados de tickets de compra.

REGLAS:
1. Tienda: Nombre comercial limpio (sin direcciones, CIF, ni códigos).
   Ejemplos: "Consum", "Mercadona", "Lidl", "Carrefour".
2. Fecha: Formato YYYY-MM-DD. Si no hay año, asume el año actual ({currentYear}).
3. Items: Extrae cada línea de producto.
   - Los tickets de supermercado a menudo usan ABREVIATURAS. Interprétalas:
     Ejemplos: "LCH ENTR" = "Leche Entera", "YOG NAT" = "Yogur Natural",
     "ACEIT OLV VE" = "Aceite Oliva Virgen Extra", "PAN MOLDE" = "Pan de Molde"
   - Si el email contiene HTML con tablas, extrae los datos de las tablas.
   - Ignora líneas de IVA desglosado, subtotales parciales, o información fiscal.
4. Categorías permitidas (usa EXACTAMENTE estos nombres):
   {categoryList}
   Si no estás seguro de la categoría, usa "Otros".
5. Totales: Asegura que la suma de items coincida aproximadamente con total_ticket.
   Si hay discrepancia, ajusta usando el total que aparece en el ticket como referencia.
6. Descuentos: Si hay descuentos (descuento socio, promoción, cupón), ponlos en el campo 'descuento' (valor positivo).
   Los descuentos de Consum suelen aparecer como "DTO SOCIO" o "DESCUENTO" en una línea separada —
   distribúyelos proporcionalmente entre los productos si es posible, o asígnalos al producto más cercano.
7. nombre_normalizado: Para cada producto genera un nombre simplificado
   (máximo 3 palabras, sin códigos de producto, en Title Case).
   Ej: "COCA COLA ZERO 2L PET" → "Coca Cola Zero"
   Ej: "YOG GRIEGO NAT DANONE X4" → "Yogur Griego Natural"
8. Si el ticket incluye peso variable (ej: fruta, carne), el precio_unitario es el precio/kg
   y la cantidad es el peso en kg.
```

**Cambios clave respecto al prompt actual**:
- Mención explícita de España y supermercados españoles
- Instrucciones para interpretar abreviaturas (crucial para Consum)
- Manejo de descuentos de socio (específico de Consum y otras cooperativas)
- Manejo de productos con peso variable
- Instrucción para extraer datos de tablas HTML
- Instrucción para ignorar información fiscal/IVA
- Año actual dinámico en el prompt

#### 2.2 Inyección Dinámica del Año Actual

**Cambio menor**: En `callGeminiExtraction()`, inyectar `new Date().getFullYear()` en el prompt para que Gemini sepa el año actual al interpretar fechas sin año.

---

### Fase 3: Documentación de Configuración para el Usuario

**Objetivo**: Guiar al usuario paso a paso para configurar la recepción automática de tickets de Consum.

#### 3.1 Guía de Configuración (para incluir en la UI o en documentación)

**Paso 1: Configurar Consum para enviar tickets por email**
1. Abrir la app de Consum o ir a la web de socios
2. Ir a "Mi cuenta" > "Preferencias" > "Ticket digital"
3. Activar "Enviar ticket por email"
4. Asegurarse de que el email configurado es el de Gmail del usuario

**Paso 2: Crear un filtro automático en Gmail**
1. En Gmail, ir a Configuración > Filtros y direcciones bloqueadas > Crear filtro
2. Configurar:
   - De: `@consum.es` (o la dirección exacta de Consum)
   - Asunto: (dejar vacío, o "ticket" si se quiere más preciso)
3. Acción: "Aplicar etiqueta" → seleccionar o crear "OmniTicket"
4. Marcar "Aplicar también a las conversaciones coincidentes"

**Paso 3: Verificar en OmniTicket**
1. Asegurarse de que en Settings, el label de búsqueda es "OmniTicket"
2. Hacer una compra en Consum y esperar a recibir el email
3. Pulsar "Sincronizar" en OmniTicket
4. Verificar que el ticket se ha procesado correctamente

#### 3.2 Posible Inclusión en la UI

**Archivo a considerar**: Crear un componente informativo en Settings o un modal de ayuda.

**Opción ligera**: Añadir un tooltip o link de ayuda en SettingsView junto al campo "Label de búsqueda Gmail" con texto explicativo sobre cómo configurar filtros automáticos.

---

### Fase 4: Reglas de Normalización Pre-configuradas para Consum

**Objetivo**: Mejorar la experiencia del usuario con productos de Consum desde el primer uso.

#### 4.1 Reglas Sugeridas

No pre-cargar reglas automáticamente (eso cambiaría el comportamiento del bootstrap), pero ofrecer al usuario un conjunto de reglas recomendadas para Consum que puede importar.

**Ejemplos de reglas útiles para Consum**:

| Pattern | Normalized | Category |
|---------|-----------|----------|
| `lch entr` | Leche Entera | Lácteos |
| `lch semi` | Leche Semidesnatada | Lácteos |
| `yog nat` | Yogur Natural | Lácteos |
| `aceit oliv` | Aceite de Oliva | Otros |
| `pan molde` | Pan de Molde | Otros |
| `papel hig` | Papel Higiénico | Higiene |
| `deterg` | Detergente | Limpieza |
| `agua mineral` | Agua Mineral | Bebidas |

**Nota**: Estas reglas son un complemento, no un sustituto. El prompt mejorado de Gemini (Fase 2) debería resolver la mayoría de abreviaturas directamente.

#### 4.2 Implementación Posible (Futuro)

Considerar una funcionalidad de "paquetes de reglas" que el usuario pueda activar/desactivar. Esto permitiría ofrecer paquetes pre-configurados para distintos supermercados (Consum, Mercadona, Lidl, etc.).

**No incluir en la primera iteración** — evaluar tras ver cómo funciona el prompt mejorado.

---

### Fase 5: Mejoras de Robustez General

#### 5.1 Truncado Inteligente del Contenido del Email

**Problema**: Algunos emails de Consum pueden ser muy largos (HTML pesado con muchos estilos). Gemini tiene límites de tokens.

**Solución**: Después de la limpieza de HTML (Fase 1), truncar el contenido si excede un límite razonable:
- Límite sugerido: 30.000 caracteres (~7.500 tokens)
- Truncar desde el final (los datos del ticket suelen estar al principio)
- Añadir indicador de truncado al contenido: `\n[...contenido truncado...]`

#### 5.2 Detección de Tickets Vacíos o Inválidos

**Mejora**: Si `extractTextFromPayload()` devuelve un string muy corto (<50 caracteres), loguear una advertencia y usar un mensaje más descriptivo al usuario.

#### 5.3 Manejo Específico de Descuentos de Socio

**Problema**: Consum (y otras cadenas) aplica descuentos globales como "Descuento socio: -2.35€". Estos no son descuentos por producto, sino totales.

**Solución en el prompt**: Ya incluida en Fase 2 (instrucción sobre distribución proporcional de descuentos).

---

## 7. Riesgos y Mitigaciones

### Riesgo 1: Consum cambia el formato del email
- **Probabilidad**: Media (cada 1-2 años)
- **Impacto**: Bajo — Gemini es resiliente a cambios de formato porque entiende semántica, no estructura rígida
- **Mitigación**: El enfoque basado en IA (vs. parser manual) es inherentemente más resistente a cambios de formato

### Riesgo 2: Emails HTML demasiado grandes para Gemini
- **Probabilidad**: Baja-Media
- **Impacto**: Medio — ticket no se procesa
- **Mitigación**: Limpieza de HTML (Fase 1) + truncado inteligente (Fase 5)

### Riesgo 3: Gemini no interpreta bien las abreviaturas de Consum
- **Probabilidad**: Baja (con el prompt mejorado)
- **Impacto**: Medio — nombres mal normalizados
- **Mitigación**: Prompt mejorado (Fase 2) + reglas del usuario (Fase 4) como segunda línea de defensa

### Riesgo 4: Consum deja de enviar tickets por email
- **Probabilidad**: Muy Baja (es un servicio básico para socios)
- **Impacto**: Alto — sin acceso a tickets
- **Mitigación**: Estrategia D (importación manual) como fallback futuro

### Riesgo 5: Descuentos mal interpretados
- **Probabilidad**: Media
- **Impacto**: Bajo — los importes totales seguirán siendo correctos
- **Mitigación**: Instrucciones específicas en el prompt (Fase 2)

### Riesgo 6: PDF adjunto sin soporte
- **Probabilidad**: Baja-Media (depende del formato de Consum)
- **Impacto**: Medio — ticket no procesable
- **Mitigación**: Fase 1.2 (soporte PDF) como mejora opcional

---

## 8. Pruebas y Validación

### 8.1 Test con Emails Reales de Consum

1. Recopilar 5-10 emails de tickets de Consum reales
2. Asegurar variedad: compras pequeñas, grandes, con descuento socio, con peso variable
3. Procesarlos con el flujo actual (antes de cambios) como baseline
4. Procesarlos con el flujo mejorado y comparar:
   - ¿Se detecta correctamente la tienda como "Consum"?
   - ¿Las fechas son correctas?
   - ¿Los productos se interpretan bien (sin abreviaturas)?
   - ¿Los precios y totales cuadran?
   - ¿Los descuentos se manejan correctamente?

### 8.2 Tests Unitarios

#### Tests para `sanitizeHtmlContent()`
- HTML con `<style>` blocks → debe eliminarlos
- HTML con tablas → debe preservar estructura como texto tabulado
- Entidades HTML → debe decodificarlas
- HTML vacío → debe devolver string vacío
- HTML enorme (>30.000 chars) → debe truncar

#### Tests para el prompt mejorado
- Verificar que el `systemInstruction` incluye las instrucciones de abreviaturas
- Verificar que se inyecta el año actual
- Verificar que la lista de categorías se formatea correctamente

### 8.3 Tests de Integración

- Procesar un email mock de Consum (HTML con tabla de productos) completo
- Verificar que el resultado en Sheets tiene todos los campos correctos
- Verificar que las reglas del usuario se aplican después de la extracción

---

## 9. Mantenimiento a Largo Plazo

### 9.1 ¿Por qué esta solución perdura?

| Factor | Explicación |
|--------|-------------|
| **Sin dependencia de Consum** | Solo necesita que Consum siga enviando emails (servicio estándar) |
| **IA como parser** | Gemini se adapta a variaciones de formato sin cambios de código |
| **Mejoras genéricas** | La limpieza de HTML beneficia a todos los supermercados |
| **Reglas del usuario** | El usuario puede corregir normalizaciones sin tocar código |
| **Filtros de Gmail** | Infraestructura de Google, extremadamente estable |
| **Sin nuevas dependencias** | No añade librerías ni APIs que puedan deprecarse |

### 9.2 Mantenimiento Periódico Recomendado

- **Cada 6 meses**: Verificar que los tickets de Consum se siguen procesando bien. Si hay cambios, ajustar el prompt.
- **Si Gemini cambia de modelo**: Testar con tickets de Consum para asegurar compatibilidad.
- **Si el usuario reporta errores**: Añadir reglas de normalización para los patrones problemáticos.

### 9.3 Evolución Futura (No Implementar Ahora)

1. **Importación manual de tickets** (Estrategia D): Como fallback para cuando no hay email.
2. **Paquetes de reglas por supermercado**: Conjuntos predefinidos de reglas de normalización.
3. **Detección automática de tienda**: Identificar la cadena por el remitente del email para aplicar optimizaciones específicas.
4. **Dashboard de calidad de extracción**: Métrica de cuántos tickets se procesan con/sin errores.

---

## Resumen de Archivos a Modificar

| Archivo | Cambio | Fase |
|---------|--------|------|
| `src/infrastructure/google-api/GmailGateway.ts` | Añadir `sanitizeHtmlContent()`, aplicar limpieza a contenido HTML | Fase 1 |
| `src/infrastructure/google-api/GeminiGateway.ts` | Mejorar `systemInstruction` con instrucciones para abreviaturas, HTML, descuentos | Fase 2 |
| `src/application/ports/AIGateway.ts` | (Opcional) Añadir parámetro `attachments?` para soporte PDF | Fase 1.2 |

**Archivos NO modificados**: Tipos (`domain.ts`), schemas (`ticketSchema.ts`), Sheets (`SheetsExpenseRepo.ts`), validación (`TicketValidator.ts`), reglas (`RuleEngine.ts`), configuración (`ConfigRepository.ts`), UI — la solución no requiere cambios en el modelo de datos, almacenamiento ni interfaz de usuario.

---

## Orden de Implementación Recomendado

```
Fase 1.1 → Fase 2 → Fase 5 → Testing → (Fase 1.2 si necesario) → (Fase 3) → (Fase 4)
 Limpieza    Prompt    Robustez              PDFs                    Docs       Reglas
  HTML      mejorado   general             adjuntos               usuario     sugeridas
```

**Tiempo estimado para Fases 1-2-5**: ~2-3 horas de desarrollo + testing.
**Impacto**: Mejora la calidad de extracción para TODOS los supermercados, no solo Consum.
