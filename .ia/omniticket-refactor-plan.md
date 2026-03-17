# Plan de Refactor: omniticket → Feature-Based Architecture

## Contexto

omniticket es una app de ticketing construida con React + TypeScript + Vite, que usa la API de Gemini. Actualmente tiene una estructura plana generada desde Google AI Studio. Este plan reorganiza el código en una arquitectura feature-based por fases, de forma que el proyecto compile y funcione tras cada fase.

## Estructura actual

```
omniticket/
├── .github/workflows/
├── schemas/
├── services/
├── .env.local
├── App.tsx
├── index.html
├── index.tsx
├── types.ts
├── package.json
├── vite.config.ts
├── metadata.json
└── tsconfig.json
```

## Estructura objetivo

```
omniticket/
├── src/
│   ├── app/
│   │   ├── App.tsx              ← solo routing y layout principal
│   │   └── index.tsx            ← entry point
│   ├── features/
│   │   ├── tickets/
│   │   │   ├── components/      ← TicketList, TicketDetail, TicketForm, etc.
│   │   │   ├── hooks/           ← useTickets, useTicketFilters, etc.
│   │   │   ├── tickets.types.ts
│   │   │   ├── tickets.api.ts   ← llamadas específicas de tickets
│   │   │   └── index.ts         ← barrel export
│   │   └── ai-assistant/
│   │       ├── components/      ← ChatPanel, SuggestionCard, etc.
│   │       ├── hooks/           ← useAiChat, useAiSuggestions, etc.
│   │       ├── ai.types.ts
│   │       ├── ai.api.ts        ← orquestación de prompts
│   │       └── index.ts
│   ├── shared/
│   │   ├── components/          ← Button, Modal, Layout, etc.
│   │   ├── hooks/               ← useDebounce, useLocalStorage, etc.
│   │   ├── types/               ← tipos realmente compartidos
│   │   └── lib/
│   │       └── gemini-client.ts ← adaptador de infraestructura (SDK de Gemini)
│   └── schemas/                 ← schemas movidos aquí
├── index.html                   ← se queda en raíz (Vite lo necesita aquí)
├── .env.local
├── package.json
├── vite.config.ts
├── metadata.json
└── tsconfig.json
```

---

## FASE 0: Preparación (no rompe nada)

**Objetivo:** Crear la estructura de carpetas y actualizar la config de Vite/TS sin mover código todavía.

### Pasos:

1. Crear el árbol de directorios vacío:
   ```bash
   mkdir -p src/app src/features/tickets/components src/features/tickets/hooks
   mkdir -p src/features/ai-assistant/components src/features/ai-assistant/hooks
   mkdir -p src/shared/components src/shared/hooks src/shared/types src/shared/lib
   mkdir -p src/schemas
   ```

2. Actualizar `vite.config.ts` para añadir un alias `@/` que apunte a `src/`:
   ```ts
   import path from 'path'

   export default defineConfig({
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
       },
     },
     // ...resto de config existente
   })
   ```

3. Actualizar `tsconfig.json` para añadir el path alias:
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"]
       }
     }
   }
   ```

4. Verificar que el proyecto sigue compilando sin cambios: `npm run dev`.

---

## FASE 1: Mover el entry point y App a `src/`

**Objetivo:** Establecer `src/` como la raíz del código fuente.

### Pasos:

1. Copiar `index.tsx` a `src/app/index.tsx`. Actualizar los imports internos si los tiene.

2. Copiar `App.tsx` a `src/app/App.tsx`. NO refactorizar todavía — solo mover.

3. Actualizar `index.html` para que el script apunte al nuevo entry point:
   ```html
   <script type="module" src="/src/app/index.tsx"></script>
   ```

4. Eliminar los archivos `index.tsx` y `App.tsx` de la raíz.

5. Verificar que el proyecto compila y funciona: `npm run dev`.

---

## FASE 2: Extraer tipos y schemas

**Objetivo:** Romper el monolito `types.ts` y colocar los tipos cerca de donde se usan.

### Pasos:

1. Analizar `types.ts` e identificar a qué feature pertenece cada tipo:
   - Tipos relacionados con tickets → `src/features/tickets/tickets.types.ts`
   - Tipos relacionados con IA/chat → `src/features/ai-assistant/ai.types.ts`
   - Tipos verdaderamente compartidos (enums genéricos, tipos de API base, etc.) → `src/shared/types/index.ts`

2. Mover cada grupo de tipos a su archivo correspondiente.

3. Crear re-exports en `src/shared/types/index.ts` solo si hay tipos que necesitan ambas features.

4. Mover el contenido de `schemas/` a `src/schemas/`.

5. Actualizar todos los imports en `App.tsx` (ahora en `src/app/App.tsx`) para que apunten a las nuevas ubicaciones usando `@/`:
   ```ts
   import type { Ticket } from '@/features/tickets/tickets.types'
   import type { AiMessage } from '@/features/ai-assistant/ai.types'
   ```

6. Eliminar `types.ts` de la raíz y `schemas/` de la raíz.

7. Verificar: `npm run dev`.

---

## FASE 3: Extraer la capa de infraestructura (Gemini client)

**Objetivo:** Aislar la dependencia del SDK de Gemini en un adaptador único, de forma que si cambias de LLM solo toques un archivo.

### Pasos:

1. Analizar `services/` para identificar qué funciones llaman directamente al SDK de Gemini.

2. Crear `src/shared/lib/gemini-client.ts` con una interfaz limpia que exponga las operaciones que la app necesita. Ejemplo orientativo:
   ```ts
   // Adaptador de infraestructura — único punto de contacto con el SDK de Gemini
   import { GoogleGenerativeAI } from '@google/generative-ai'

   const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

   export interface LLMResponse {
     text: string
     // ...otros campos que necesites
   }

   export async function sendPrompt(prompt: string, schema?: object): Promise<LLMResponse> {
     const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
     const result = await model.generateContent(prompt)
     return { text: result.response.text() }
   }

   // Añadir más funciones según lo que ya exista en services/
   ```

3. Actualizar los archivos en `services/` para que importen desde `@/shared/lib/gemini-client` en vez de instanciar el SDK directamente.

4. Verificar: `npm run dev`.

---

## FASE 4: Extraer features desde App.tsx

**Objetivo:** Sacar componentes, hooks y lógica de `App.tsx` a sus features correspondientes. Esta es la fase más grande.

### Pasos:

1. **Analizar `App.tsx`** e identificar bloques funcionales. Buscar:
   - JSX que renderiza listas de tickets, detalles, formularios → feature `tickets`
   - JSX que renderiza chat, sugerencias, interacción con IA → feature `ai-assistant`
   - JSX que es layout puro (header, sidebar, contenedor) → se queda en `App.tsx` o va a `shared/components/Layout.tsx`

2. **Extraer componentes de tickets:**
   - Por cada bloque de JSX relacionado con tickets, crear un componente en `src/features/tickets/components/`.
   - Si hay `useState`/`useEffect` específicos de tickets en App, crear hooks en `src/features/tickets/hooks/`.
   - Las funciones que llaman a la API para operaciones de tickets van a `src/features/tickets/tickets.api.ts`.

3. **Extraer componentes de IA:**
   - Mismo proceso para todo lo relacionado con el asistente IA.
   - `src/features/ai-assistant/ai.api.ts` importa desde `@/shared/lib/gemini-client` — nunca directamente del SDK.

4. **Crear barrel exports** en cada feature:
   ```ts
   // src/features/tickets/index.ts
   export { TicketList } from './components/TicketList'
   export { TicketDetail } from './components/TicketDetail'
   export { useTickets } from './hooks/useTickets'
   ```

5. **Simplificar App.tsx** para que solo haga composición:
   ```tsx
   import { TicketList } from '@/features/tickets'
   import { AiAssistant } from '@/features/ai-assistant'
   import { Layout } from '@/shared/components/Layout'

   export default function App() {
     return (
       <Layout>
         <TicketList />
         <AiAssistant />
       </Layout>
     )
   }
   ```

6. **Mover los archivos restantes de `services/`** a su feature correspondiente (`tickets.api.ts` o `ai.api.ts`) o a `shared/lib/` si son realmente transversales.

7. Eliminar el directorio `services/` de la raíz.

8. Verificar: `npm run dev`.

---

## FASE 5: Limpieza y reglas de dependencia

**Objetivo:** Asegurar que las dependencias fluyen en una sola dirección y documentar las reglas.

### Pasos:

1. **Verificar la regla de dependencias:**
   ```
   features/tickets   → puede importar de shared/
   features/ai-assist → puede importar de shared/
   features/*         → NUNCA importa de otra feature directamente
   shared/            → NUNCA importa de features/
   app/               → puede importar de todo
   ```

   Si una feature necesita datos de otra, la comunicación debe pasar por `app/` (props down) o por un store compartido en `shared/`.

2. **Añadir un README.md de arquitectura** en `src/` que documente:
   - La estructura de carpetas y su propósito.
   - Las reglas de dependencia.
   - Cómo añadir una nueva feature.

3. **(Opcional) Configurar restricción de imports** con ESLint:
   ```json
   {
     "rules": {
       "no-restricted-imports": ["error", {
         "patterns": [
           {
             "group": ["@/features/tickets/*"],
             "message": "No importar directamente de otra feature. Usa shared/ o pasa props."
           }
         ]
       }]
     }
   }
   ```
   Esto es especialmente útil si el proyecto crece y entra más gente.

4. Verificar una última vez: `npm run dev` y `npm run build`.

---

## Notas para la ejecución

- **Cada fase es independiente y deployable.** Si algo falla, puedes hacer rollback a la fase anterior sin perder trabajo.
- **No cambiar lógica de negocio durante el refactor.** Solo mover y reorganizar. Las mejoras funcionales van después.
- **Mantener los commits pequeños y descriptivos**, uno por paso dentro de cada fase si es posible.
- **Si App.tsx es muy grande (>300 líneas),** la Fase 4 puede subdividirse: primero extraer componentes, luego hooks, luego API calls.
- **El directorio `schemas/`** contiene probablemente schemas de validación (Zod, JSON Schema, etc.). Colocarlos en `src/schemas/` o dentro de cada feature según su alcance. Si un schema solo lo usa tickets, va dentro de la feature.
