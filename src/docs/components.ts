// docs/components.ts
// Componentes reutilizables de la especificación OpenAPI 3.1 (Swagger):
// seguridad, esquemas de error, parámetros comunes y respuestas de error.
//
// Se cargan en `index.ts` dentro de `swaggerOptions.definition.components`,
// de modo que los endpoints usan `$ref: '#/components/...'` y la documentación
// queda consistente en todo el API.

/** Etiquetas (agrupaciones) de la UI de Swagger. */
export const openapiTags = [
  { name: 'Autenticación', description: 'Registro, inicio de sesión y perfil del usuario' },
  { name: 'Identidad', description: 'Empresas, configuración, usuarios, roles y permisos' },
  { name: 'Inventario', description: 'Proyectos, etapas, manzanas, lotes, planos y bitácora' },
  { name: 'CRM', description: 'Prospectos, oportunidades, actividades y asesores' },
  { name: 'Ventas', description: 'Clientes, cotizaciones, ventas, contratos, cobranzas, pagos y reservas' },
  { name: 'Suscripciones', description: 'Planes de la plataforma y partnerships' },
  { name: 'Público', description: 'Endpoints sin token: mapa interactivo y planes' },
  { name: 'Alertas', description: 'Alertas operativas derivadas de los datos' },
];

export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Access token de Supabase Auth. Se obtiene en `POST /api/auth/login` y se envía como `Authorization: Bearer <access_token>`.',
  },
};

export const openapiParameters = {
  IdPath: {
    name: 'id',
    in: 'path',
    required: true,
    description: 'Identificador único del registro',
    schema: { type: 'integer', example: 1 },
  },
  Limite: {
    name: 'limite',
    in: 'query',
    description: 'Tamaño de la página (máx. 100)',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20, example: 20 },
  },
  Pagina: {
    name: 'pagina',
    in: 'query',
    description: 'Página a devolver (empieza en 1). Requiere `limite`.',
    schema: { type: 'integer', minimum: 1, default: 1, example: 1 },
  },
};

export const openapiSchemas = {
  Error: {
    type: 'object',
    description: 'Respuesta de error estandarizada del API',
    properties: {
      message: { type: 'string', description: 'Descripción legible del error' },
      details: {
        type: 'array',
        description: 'Detalle por campo (solo en errores de validación, 400)',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    example: {
      message: 'Datos de entrada inválidos',
      details: [{ field: 'nombre', message: '"nombre" is required' }],
    },
  },
  Mensaje: {
    type: 'object',
    description: 'Confirmación simple de una operación',
    properties: { message: { type: 'string' } },
    example: { message: 'Registro eliminado correctamente' },
  },
};

/** Respuestas de error reutilizadas por todos los endpoints. */
export const openapiResponses = {
  BadRequest: {
    description: 'Datos de entrada inválidos (validación Joi) o regla de negocio',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  Unauthorized: {
    description: 'Token ausente, inválido o expirado',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { message: 'Token de autenticación inválido o expirado' },
      },
    },
  },
  Forbidden: {
    description: 'El rol o los permisos del usuario no alcanzan para la acción',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { message: 'No tienes el permiso "crear_lotes" para realizar esta acción.' },
      },
    },
  },
  NotFound: {
    description: 'Registro inexistente (o perteneciente a otra empresa)',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { message: "Registro de 'lotes' con id 999 no encontrado" },
      },
    },
  },
  ServerError: {
    description: 'Error interno del servidor',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { message: "Error al consultar la tabla 'lotes'" },
      },
    },
  },
};
