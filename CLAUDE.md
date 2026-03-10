# OmniTicket - Instrucciones para Claude

## Contexto del Proyecto

Al inicio de cada conversación, lee automáticamente estos archivos para obtener el contexto completo del proyecto:

1. **`.ia/project-context.md`**: Arquitectura técnica, stack, flujo de funcionamiento y servicios principales
2. **`.ia/business-rules.md`**: Reglas de negocio, categorías, normalización y lógica de procesamiento
3. **`.ia/api-config.md`**: Configuración de APIs (Google OAuth, Gmail, Sheets, Drive, Gemini AI)

Estos archivos contienen toda la documentación necesaria para trabajar efectivamente en el proyecto.

## Convenciones de Trabajo

- TypeScript estricto con validación Zod
- Componentes React funcionales con hooks
- Tailwind CSS con utility-first approach
- Manejo de errores con try/catch y mensajes descriptivos
- Nombres de archivos en PascalCase para servicios y componentes

## Gestión de Versiones

**Regla obligatoria**: Al instalar cualquier dependencia npm, GitHub Action, SDK o API, **siempre verificar y usar la versión más reciente y estable** disponible en el momento de uso.

- Buscar la última versión estable antes de instalar (no RC, no beta, no alpha, no pre-release)
- Nunca asumir que una versión recordada del knowledge cutoff sigue siendo la más reciente — verificar siempre
- Verificar compatibilidad con el código existente antes de usar la versión nueva
- Para GitHub Actions: consultar el marketplace o el repositorio de la action para la última versión
- Para npm: usar `npm info <paquete> version` o consultar npmjs.com para la versión actual

## Preferencias de Commits
- No añadir línea `Co-Authored-By` en los mensajes de commit
