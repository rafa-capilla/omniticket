# Dependabot Plan - Análisis y Recomendaciones

## Estado Actual

### Configuración actual de Dependabot
- **Ecosistemas**: `npm` + `github-actions`
- **Frecuencia**: Semanal (ambos)
- **Restricciones**: Ninguna (sin grouping, sin ignore, sin version limits, sin límite de PRs abiertas)

### PRs abiertas de Dependabot (5)

| Paquete | Versión actual | Versión propuesta | Tipo de cambio | Tipo de dep |
|---------|---------------|-------------------|----------------|-------------|
| `postcss` | 8.4.49 | 8.5.8 | Minor | devDep |
| `tailwind-merge` | 3.0.0 | 3.5.0 | Minor | dep |
| `vite` | 6.4.1 | 8.0.0 | **MAJOR** | devDep |
| `@vitejs/plugin-react` | 5.1.4 | 6.0.1 | **MAJOR** | devDep |
| `vitest` | 4.0.18 | 4.1.0 | Minor | devDep |

### Historial
- **21 de 142 commits** (~15%) desde enero 2025 son de dependabot/bumps
- 5 PRs ya mergeadas de dependabot (autoprefixer, configure-pages, lucide-react, upload-pages-artifact, typescript)
- 5 PRs abiertas pendientes

## Problemas Identificados

### 1. Saltos de versión MAJOR sin control
- **Vite 6 → 8**: Salto de 2 versiones major. Muy probablemente tiene breaking changes significativos. No debería aceptarse sin revisión manual cuidadosa.
- **@vitejs/plugin-react 5 → 6**: Requiere compatibilidad con la versión de Vite. Si se acepta una sin la otra, el build se rompe.
- Dependabot no agrupa estos paquetes relacionados, generando PRs independientes que deben mergearse juntas.

### 2. Sin agrupación de dependencias relacionadas
- `vite`, `@vitejs/plugin-react` y `vitest` están estrechamente acoplados pero llegan como PRs separadas.
- Esto obliga a revisiones y merges coordinados manualmente.

### 3. Frecuencia excesiva para el tamaño del proyecto
- OmniTicket es una app relativamente pequeña (~15 archivos de código) con pocas dependencias (8 deps + 7 devDeps).
- Actualizaciones semanales generan ruido: ~15% de los commits son bumps de dependencias.
- Librerías como `lucide-react` (iconos) publican releases frecuentes con cambios irrelevantes para el proyecto.

### 4. Versionado inconsistente en package.json
- Algunas deps usan versión exacta: `"react": "19.2.4"`, `"zod": "4.3.6"`
- Otras usan `^`: `"vite": "^6.4.1"`, `"vitest": "^4.0.18"`
- Con `^`, dependabot propone bumps de major que resultan en saltos grandes.

## Recomendaciones

### A. Fijar versiones exactas en package.json
Eliminar el prefijo `^` de `vite` y `vitest` para que dependabot solo proponga bumps cuando hay una nueva versión exacta, y el cambio sea más controlado.

### B. Configurar dependabot con restricciones
```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"

  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 5
    groups:
      vite-ecosystem:
        patterns:
          - "vite"
          - "@vitejs/*"
          - "vitest"
      react-ecosystem:
        patterns:
          - "react"
          - "react-dom"
          - "@types/react"
          - "@types/react-dom"
      css-tooling:
        patterns:
          - "tailwindcss"
          - "postcss"
          - "autoprefixer"
          - "tailwind-merge"
    ignore:
      # Ignorar bumps major de vite ecosystem - revisar manualmente
      - dependency-name: "vite"
        update-types: ["version-update:semver-major"]
      - dependency-name: "@vitejs/*"
        update-types: ["version-update:semver-major"]
      - dependency-name: "vitest"
        update-types: ["version-update:semver-major"]
```

### C. Evaluación de las PRs abiertas

| PR | Recomendación | Motivo |
|----|---------------|--------|
| `postcss` 8.4→8.5 | **Aceptar** | Minor bump de devDep, bajo riesgo |
| `tailwind-merge` 3.0→3.5 | **Aceptar** | Minor bump, mejoras de rendimiento |
| `vitest` 4.0→4.1 | **Aceptar** | Minor bump de devDep, bajo riesgo |
| `vite` 6→8 | **Rechazar** | Salto de 2 majors, alto riesgo de breaking changes. Evaluar migración a Vite 7 primero |
| `@vitejs/plugin-react` 5→6 | **Rechazar** | Depende de la versión de Vite. No se puede aceptar sin actualizar Vite |

### D. Resumen de cambios propuestos

1. **Cambiar frecuencia** de semanal a mensual → reduce ruido un 75%
2. **Agrupar dependencias** relacionadas → PRs coordinadas, no fragmentadas
3. **Ignorar major bumps** del ecosistema Vite → evitar PRs que necesitan migración manual
4. **Fijar versiones** en package.json → control más predecible de actualizaciones
5. **Limitar PRs abiertas** a 5 → evitar acumulación

## Conclusión

Dependabot **sí se está pasando** para el tamaño y naturaleza del proyecto:
- La frecuencia semanal es excesiva para un proyecto pequeño con despliegue estático
- La falta de agrupación genera PRs fragmentadas que no se pueden mergear independientemente
- Los saltos major (Vite 6→8) no deberían llegar como PRs automáticas sin contexto de migración
- El 15% de commits dedicados a bumps de dependencias es alto para un proyecto con desarrollo activo de features

Con la configuración propuesta, el ruido se reduciría significativamente manteniendo las dependencias razonablemente actualizadas.
