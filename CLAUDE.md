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
