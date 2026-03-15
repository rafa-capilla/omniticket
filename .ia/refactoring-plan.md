# OmniTicket - Plan de Refactoring hacia DDD / Hexagonal / SOLID / Clean Code

## Diagnostico Actual

### Estructura actual
```
omniticket/
├── services/           # Logica de negocio + acceso a datos + APIs externas mezclados
├── components/         # Presentacion + logica de negocio + llamadas a servicios mezclados
├── contexts/           # Context de React (bien aislado)
├── lib/                # Utilidades y constantes (bien aislado)
├── schemas/            # Validacion Zod (bien aislado)
├── types.ts            # Tipos compartidos (plano, sin separacion dominio/infra)
├── App.tsx             # God component (~349 lineas, 12+ useState)
└── index.tsx           # Entry point
```

### Problemas detectados

| Problema | Severidad | Archivos afectados |
|----------|-----------|-------------------|
| **SheetsService es un God Service** (gastos + categorias + reglas) | Alta | services/SheetsService.ts (220 lineas) |
| **SyncEngine mezcla orquestacion + extraccion + validacion + transformacion** | Alta | services/SyncEngine.ts (237 lineas) |
| **ConfigService mezcla bootstrap + settings + migraciones** | Alta | services/ConfigService.ts (268 lineas) |
| **App.tsx es un God Component** (auth + datos + routing + notificaciones) | Alta | App.tsx (349 lineas) |
| **LensesView tiene logica de negocio** (agregacion, filtrado, reglas) | Alta | components/LensesView.tsx (244 lineas) |
| **Componentes crean instancias de servicios directamente** | Media | RulesView, CategoriesManager, SettingsView, AIAnalysisView |
| **Sin capa de repositorio** (acceso directo a Sheets API) | Media | services/SheetsService.ts |
| **Sin interfaces/ports** (no hay inversion de dependencias) | Media | Todos los servicios |
| **Logica de agregacion duplicada** en LensesView y AIAnalysisView | Media | components/LensesView.tsx, components/AIAnalysisView.tsx |
| **Codigo de charts duplicado** en LensesView y AIAnalysisView | Baja | components/LensesView.tsx, components/AIAnalysisView.tsx |
| **Tipos de dominio mezclados con tipos de API** en types.ts | Baja | types.ts |

---

## Estructura Objetivo

```
omniticket/
├── domain/                         # Capa de dominio (sin dependencias externas)
│   ├── models/                     # Entidades y value objects del dominio
│   │   ├── Ticket.ts               # TicketData, TicketItem
│   │   ├── Rule.ts                 # Rule
│   │   ├── Category.ts             # Category
│   │   └── Settings.ts             # Settings, AppConfig
│   └── services/                   # Logica de dominio pura (sin I/O)
│       ├── RuleEngine.ts           # Aplicacion de reglas sobre productos
│       ├── DataAggregator.ts       # Agregacion de gastos por producto/categoria/tienda
│       └── TicketValidator.ts      # Validacion de tickets (Zod + reglas de negocio)
│
├── application/                    # Capa de aplicacion (casos de uso)
│   ├── ports/                      # Interfaces (contratos) - Hexagonal "ports"
│   │   ├── ExpenseRepository.ts    # Interface para persistencia de gastos
│   │   ├── CategoryRepository.ts   # Interface para persistencia de categorias
│   │   ├── RuleRepository.ts       # Interface para persistencia de reglas
│   │   ├── ConfigRepository.ts     # Interface para configuracion
│   │   ├── EmailGateway.ts         # Interface para acceso a email
│   │   └── AIGateway.ts            # Interface para servicio de IA
│   └── use-cases/                  # Orquestadores de logica de aplicacion
│       ├── SyncTickets.ts          # Caso de uso: sincronizar tickets
│       ├── AnalyzeExpenses.ts      # Caso de uso: analisis libre con IA
│       └── ManageCategories.ts     # Caso de uso: CRUD categorias con cascada
│
├── infrastructure/                 # Capa de infraestructura (implementaciones concretas)
│   ├── google-api/                 # Adaptadores para APIs de Google
│   │   ├── apiFetch.ts             # HTTP wrapper (se mantiene)
│   │   ├── retry.ts                # Retry con backoff (se mantiene)
│   │   ├── SheetsExpenseRepo.ts    # Implementa ExpenseRepository via Sheets
│   │   ├── SheetsCategoryRepo.ts   # Implementa CategoryRepository via Sheets
│   │   ├── SheetsRuleRepo.ts       # Implementa RuleRepository via Sheets
│   │   ├── SheetsConfigRepo.ts     # Implementa ConfigRepository via Sheets
│   │   ├── GmailGateway.ts         # Implementa EmailGateway via Gmail API
│   │   └── GeminiGateway.ts        # Implementa AIGateway via Gemini
│   ├── auth/
│   │   └── GoogleAuthService.ts    # OAuth 2.0 (se mantiene)
│   └── bootstrap/
│       ├── DatabaseBootstrap.ts    # Creacion/migracion del spreadsheet
│       └── migrations.ts          # Definiciones de migraciones
│
├── presentation/                   # Capa de presentacion (React)
│   ├── views/                      # Componentes de pagina (containers)
│   │   ├── LensesView.tsx          # Solo presentacion + hooks
│   │   ├── HistoryView.tsx         # (se mantiene, ya es presentacion pura)
│   │   ├── RulesView.tsx           # Solo presentacion + hooks
│   │   ├── CategoriesView.tsx      # Solo presentacion + hooks
│   │   ├── SettingsView.tsx        # Solo presentacion + hooks
│   │   └── AIAnalysisView.tsx      # Solo presentacion + hooks
│   ├── components/                 # Componentes reutilizables (presentacionales)
│   │   ├── charts/
│   │   │   ├── PieChart.tsx        # Chart de pie reutilizable
│   │   │   └── BarChart.tsx        # Chart de barra reutilizable
│   │   ├── KpiDashboard.tsx        # KPIs reutilizables
│   │   └── ToastList.tsx           # (se mantiene)
│   ├── hooks/                      # Custom hooks para logica de UI
│   │   ├── useDataAggregation.ts   # Hook para agregar datos de gastos
│   │   ├── useDateFilter.ts       # Hook para filtrado por fechas
│   │   ├── useServiceFactory.ts   # Hook para crear servicios con token/dbId
│   │   └── useAuth.ts             # Hook para logica de autenticacion
│   └── contexts/
│       └── AppContext.tsx          # (se mantiene)
│
├── shared/                         # Utilidades compartidas entre capas
│   ├── types/
│   │   ├── domain.ts               # Tipos de dominio
│   │   └── google-api.ts           # Tipos de respuestas de Google APIs
│   ├── constants.ts                # (se mantiene lib/constants.ts)
│   └── utils.ts                    # (se mantiene lib/utils.ts)
│
├── App.tsx                         # Simplificado: solo routing + providers
└── index.tsx                       # Entry point (sin cambios)
```

---

## Plan por Fases

### Fase 0: Preparacion (prerequisito para todas las fases)
**Objetivo**: Asegurar que todo compila y los tests pasan antes de empezar.
**Tamano estimado**: Pequeno (1 iteracion de Claude)

**Tareas**:
1. Ejecutar `npm run build` y `npm test` para verificar estado actual
2. Documentar cualquier warning o error existente
3. Verificar que los imports usan paths relativos consistentes

**Criterio de exito**: Build y tests pasan sin errores nuevos.

---

### Fase 1: Extraer tipos de dominio y tipos de API
**Objetivo**: Separar tipos de dominio de tipos de infraestructura.
**Tamano estimado**: Pequeno (1 iteracion de Claude)
**Dependencias**: Fase 0

**Tareas**:
1. Crear `shared/types/domain.ts` con los tipos de dominio: TicketData, TicketItem, Rule, Category, Settings, LineItem, HistoryEntry, Toast, View
2. Crear `shared/types/google-api.ts` con tipos de API: SheetsValuesResponse, DriveFilesResponse, GmailThread, GmailLabel, etc.
3. Mover `shared/constants.ts` desde `lib/constants.ts` (re-export desde la ubicacion original para compatibilidad)
4. Mover `shared/utils.ts` desde `lib/utils.ts` (re-export desde la ubicacion original para compatibilidad)
5. Actualizar `types.ts` para que re-exporte desde las nuevas ubicaciones (mantener compatibilidad)
6. Verificar que build y tests pasan

**Archivos a crear**: `shared/types/domain.ts`, `shared/types/google-api.ts`
**Archivos a modificar**: `types.ts` (re-exportar)
**Impacto**: Bajo (solo reorganizacion de tipos, re-exports mantienen compatibilidad)

---

### Fase 2: Definir interfaces/ports de aplicacion
**Objetivo**: Crear las interfaces que definen los contratos entre capas (Hexagonal ports).
**Tamano estimado**: Pequeno (1 iteracion de Claude)
**Dependencias**: Fase 1

**Tareas**:
1. Crear `application/ports/ExpenseRepository.ts` - interface para operaciones de gastos
2. Crear `application/ports/CategoryRepository.ts` - interface para operaciones de categorias
3. Crear `application/ports/RuleRepository.ts` - interface para operaciones de reglas
4. Crear `application/ports/ConfigRepository.ts` - interface para configuracion y bootstrap
5. Crear `application/ports/EmailGateway.ts` - interface para acceso a email
6. Crear `application/ports/AIGateway.ts` - interface para servicio de IA (extraccion + analisis)
7. Crear `application/ports/index.ts` - barrel export

**Archivos a crear**: 7 archivos de interfaces
**Archivos a modificar**: Ninguno (solo se crean interfaces, no se usan todavia)
**Impacto**: Nulo (aditivo, sin cambios funcionales)

---

### Fase 3: Extraer logica de dominio pura
**Objetivo**: Mover la logica de negocio que no depende de I/O a la capa de dominio.
**Tamano estimado**: Medio (1-2 iteraciones de Claude)
**Dependencias**: Fase 1

**Tareas**:
1. Crear `domain/services/RuleEngine.ts`:
   - Extraer logica de aplicacion de reglas desde `SyncEngine.ts` (metodo applyRulesToItems)
   - Extraer logica de aplicacion de reglas desde `LensesView.tsx` (useMemo de processedData)
   - Funcion pura: recibe items + reglas, devuelve items con nombre/categoria aplicados

2. Crear `domain/services/DataAggregator.ts`:
   - Extraer logica de agregacion desde `LensesView.tsx` (useMemo de lensData)
   - Extraer logica de agregacion desde `AIAnalysisView.tsx` (useMemo de aggregated)
   - Funciones puras: aggregateByProduct, aggregateByCategory, aggregateByStore
   - Funcion: calculateKPIs (gasto total, ticket promedio, top categoria, num tickets)

3. Crear `domain/services/TicketValidator.ts`:
   - Mover schema de `schemas/ticketSchema.ts`
   - Anadir validacion adicional de negocio (fechas, totales)
   - Re-export desde `schemas/ticketSchema.ts` para compatibilidad

4. Verificar que build y tests pasan

**Archivos a crear**: `domain/services/RuleEngine.ts`, `domain/services/DataAggregator.ts`, `domain/services/TicketValidator.ts`
**Archivos a modificar**: Ningun cambio funcional (la logica se extrae pero se sigue usando desde los mismos sitios por ahora)
**Impacto**: Bajo (aditivo, la logica nueva es utilizable pero todavia no se conecta)

---

### Fase 4: Dividir SheetsService en repositorios
**Objetivo**: Romper el God Service SheetsService en repositorios especializados que implementen los ports.
**Tamano estimado**: Medio (1-2 iteraciones de Claude)
**Dependencias**: Fase 2

**Tareas**:
1. Crear `infrastructure/google-api/SheetsExpenseRepo.ts`:
   - Implementa `ExpenseRepository`
   - Mueve: appendExpense, fetchAllLineItems, fetchHistory, appendHistory
   - Depende de apiFetch y constantes de columnas

2. Crear `infrastructure/google-api/SheetsCategoryRepo.ts`:
   - Implementa `CategoryRepository`
   - Mueve: getCategories, addCategory, updateCategory, deleteCategory, updateCategoryInGastos
   - Depende de apiFetch

3. Crear `infrastructure/google-api/SheetsRuleRepo.ts`:
   - Implementa `RuleRepository`
   - Mueve: getRules, addRule, updateRule, deleteRule
   - Depende de apiFetch

4. Actualizar `services/SheetsService.ts` para que delegue a los nuevos repositorios (mantener API publica existente como fachada)
5. Verificar que build y tests pasan

**Archivos a crear**: 3 archivos de repositorio
**Archivos a modificar**: `services/SheetsService.ts` (delegacion interna, API publica sin cambios)
**Impacto**: Bajo (fachada mantiene compatibilidad, internamente delega)

---

### Fase 5: Dividir ConfigService y extraer bootstrap
**Objetivo**: Separar las responsabilidades de ConfigService.
**Tamano estimado**: Medio (1 iteracion de Claude)
**Dependencias**: Fase 2

**Tareas**:
1. Crear `infrastructure/google-api/SheetsConfigRepo.ts`:
   - Implementa `ConfigRepository`
   - Mueve: getSettings, updateSettings
   - Lectura/escritura de la hoja Config

2. Crear `infrastructure/bootstrap/DatabaseBootstrap.ts`:
   - Mueve: ensureDatabase, createSpreadsheet, initializeSheets
   - Responsable de crear/encontrar el spreadsheet

3. Crear `infrastructure/bootstrap/migrations.ts`:
   - Mueve: runMigrations, definiciones de migraciones
   - Separar cada migracion en una funcion con nombre descriptivo

4. Actualizar `services/ConfigService.ts` para que delegue a los nuevos modulos
5. Verificar que build y tests pasan

**Archivos a crear**: 3 archivos
**Archivos a modificar**: `services/ConfigService.ts` (delegacion interna)
**Impacto**: Bajo

---

### Fase 6: Extraer adaptadores de Gmail y Gemini
**Objetivo**: Aislar los adaptadores de APIs externas detras de las interfaces.
**Tamano estimado**: Medio (1 iteracion de Claude)
**Dependencias**: Fase 2

**Tareas**:
1. Crear `infrastructure/google-api/GmailGateway.ts`:
   - Implementa `EmailGateway`
   - Mueve logica de GmailService.ts
   - Mantener GmailService.ts como re-export/fachada

2. Crear `infrastructure/google-api/GeminiGateway.ts`:
   - Implementa `AIGateway`
   - Extraer logica de llamada a Gemini desde SyncEngine.ts (extractDataWithAI)
   - Extraer logica de llamada a Gemini desde AIAnalysisService.ts (analyze)
   - Separar prompts del sistema en constantes/templates

3. Mover `services/apiFetch.ts` a `infrastructure/google-api/apiFetch.ts` (re-export desde ubicacion original)
4. Mover `services/retry.ts` a `infrastructure/google-api/retry.ts` (re-export desde ubicacion original)
5. Verificar que build y tests pasan

**Archivos a crear**: 2 archivos de gateway
**Archivos a modificar**: Servicios existentes (delegacion)
**Impacto**: Bajo

---

### Fase 7: Crear casos de uso de aplicacion
**Objetivo**: Implementar la capa de aplicacion con casos de uso que orquestan dominio e infraestructura.
**Tamano estimado**: Medio-Alto (2 iteraciones de Claude)
**Dependencias**: Fases 3, 4, 5, 6

**Tareas**:
1. Crear `application/use-cases/SyncTickets.ts`:
   - Caso de uso que orquesta: EmailGateway -> AIGateway -> RuleEngine -> ExpenseRepository
   - Reemplaza la logica de orquestacion de SyncEngine.ts
   - Recibe ports por constructor (DI)

2. Crear `application/use-cases/AnalyzeExpenses.ts`:
   - Caso de uso que orquesta: ExpenseRepository -> DataAggregator -> AIGateway
   - Reemplaza la logica de AIAnalysisService.ts
   - Recibe ports por constructor (DI)

3. Crear `application/use-cases/ManageCategories.ts`:
   - Caso de uso para borrado con cascada de categorias
   - Extrae logica de CategoriesManager.tsx (executeDelete)
   - Orquesta: CategoryRepository -> RuleRepository -> ExpenseRepository

4. Actualizar servicios existentes para delegar a los use-cases (mantener API publica)
5. Verificar que build y tests pasan

**Archivos a crear**: 3 archivos de casos de uso
**Archivos a modificar**: Servicios existentes (delegacion gradual)
**Impacto**: Medio

---

### Fase 8: Extraer custom hooks de presentacion
**Objetivo**: Sacar logica de negocio de los componentes React hacia hooks reutilizables.
**Tamano estimado**: Medio (1-2 iteraciones de Claude)
**Dependencias**: Fase 3

**Tareas**:
1. Crear `presentation/hooks/useDataAggregation.ts`:
   - Extrae logica de agregacion de LensesView.tsx y AIAnalysisView.tsx
   - Usa DataAggregator y RuleEngine del dominio
   - Retorna datos procesados listos para presentacion

2. Crear `presentation/hooks/useDateFilter.ts`:
   - Extrae logica de filtrado por fechas de LensesView.tsx
   - Retorna: dateRange, setDateRange, filteredData

3. Crear `presentation/hooks/useServiceFactory.ts`:
   - Centraliza la creacion de servicios con token/dbId
   - Reemplaza useMemo(new SheetsService(...)) en cada componente
   - Retorna instancias de servicios ya configuradas

4. Crear `presentation/hooks/useAuth.ts`:
   - Extrae logica de autenticacion de App.tsx
   - Login, logout, silentRefresh, token state

5. Actualizar componentes para usar los hooks en lugar de logica inline
6. Verificar que build y tests pasan

**Archivos a crear**: 4 hooks
**Archivos a modificar**: LensesView.tsx, AIAnalysisView.tsx, App.tsx, RulesView.tsx, CategoriesManager.tsx, SettingsView.tsx
**Impacto**: Medio-Alto (cambios en componentes pero sin cambios funcionales)

---

### Fase 9: Dividir componentes grandes y extraer charts reutilizables
**Objetivo**: Descomponer componentes grandes en componentes mas pequenos y reutilizables.
**Tamano estimado**: Medio (1-2 iteraciones de Claude)
**Dependencias**: Fase 8

**Tareas**:
1. Crear `presentation/components/charts/PieChart.tsx`:
   - Extraer de LensesView.tsx y AIAnalysisView.tsx
   - Componente presentacional reutilizable

2. Crear `presentation/components/charts/BarChart.tsx`:
   - Extraer de LensesView.tsx y AIAnalysisView.tsx
   - Componente presentacional reutilizable

3. Crear `presentation/components/KpiDashboard.tsx`:
   - Extraer KPIs de LensesView.tsx
   - Recibe datos calculados, solo presenta

4. Simplificar LensesView.tsx:
   - Usa hooks para datos
   - Usa componentes de chart
   - Solo logica de UI (seleccion de lente, layout)

5. Simplificar AIAnalysisView.tsx:
   - Usa hooks para datos
   - Usa componentes de chart
   - Solo logica de UI (input, resultado)

6. Verificar que build y tests pasan

**Archivos a crear**: 3 componentes
**Archivos a modificar**: LensesView.tsx, AIAnalysisView.tsx
**Impacto**: Medio

---

### Fase 10: Simplificar App.tsx
**Objetivo**: Reducir App.tsx a un coordinador simple que delega a hooks y componentes.
**Tamano estimado**: Medio (1 iteracion de Claude)
**Dependencias**: Fase 8

**Tareas**:
1. Extraer logica de auth a `useAuth` hook (si no se hizo completamente en Fase 8)
2. Extraer logica de bootstrap/data loading a un hook `useAppBootstrap`
3. Extraer logica de sync a un hook `useSyncEngine`
4. App.tsx queda como:
   - Provider de contexto
   - Router de vistas
   - Layout principal (header + contenido)
5. Verificar que build y tests pasan

**Archivos a modificar**: App.tsx
**Impacto**: Medio

---

### Fase 11: Limpieza final y actualizacion de re-exports
**Objetivo**: Eliminar ficheros fachada que ya no son necesarios y limpiar re-exports.
**Tamano estimado**: Pequeno (1 iteracion de Claude)
**Dependencias**: Fases 7-10

**Tareas**:
1. Verificar que ningun import externo usa los ficheros originales directamente
2. Eliminar re-exports innecesarios
3. Actualizar `project-context.md` con la nueva estructura
4. Actualizar imports a usar paths directos a la nueva estructura
5. Build y test final
6. Actualizar CLAUDE.md si es necesario

**Archivos a modificar**: Multiples (limpieza de imports)
**Archivos a eliminar**: Re-exports temporales que ya no se necesiten
**Impacto**: Bajo

---

## Reglas Transversales para Todas las Fases

1. **Nunca romper la API publica**: Las funciones y clases publicas mantienen su nombre y firma
2. **Compatibilidad via re-exports**: Al mover un archivo, dejar un re-export en la ubicacion original
3. **Tests despues de cada fase**: `npm run build && npm test` debe pasar
4. **Commits atomicos por fase**: Cada fase es un commit independiente
5. **Sin over-engineering**: Si una fase resulta innecesaria, saltarla
6. **Pragmatismo sobre purismo**: No todas las interfaces necesitan ser creadas si solo hay una implementacion

## Orden de Ejecucion Recomendado

```
Fase 0 (prerequisito)
  |
Fase 1 (tipos)
  |
  +-- Fase 2 (interfaces) -- Fase 4 (repos) -- Fase 5 (config) -- Fase 6 (gateways) -- Fase 7 (use cases)
  |
  +-- Fase 3 (dominio) -- Fase 8 (hooks) -- Fase 9 (componentes) -- Fase 10 (App.tsx)
  |
  +-- Fase 11 (limpieza final, requiere todas las anteriores)
```

Las ramas Fase 2-7 y Fase 3,8-10 pueden ejecutarse en paralelo ya que son independientes hasta Fase 7 y Fase 11.

## Metricas de Exito

| Metrica | Antes | Objetivo |
|---------|-------|----------|
| Archivo mas grande (lineas) | ~349 (App.tsx) | < 150 |
| Responsabilidades por archivo | 3-6 | 1-2 |
| Dependencias directas entre capas | Sin limites | Solo hacia adentro (presentacion -> aplicacion -> dominio) |
| Cobertura de interfaces | 0% | > 80% en ports |
| Logica de negocio en componentes | Mucha | Ninguna (delegada a hooks/servicios) |
