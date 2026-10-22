// docs/index.ts
// Especificación OpenAPI generada para los módulos CRUD del API.
//
// `src/index.ts` fusiona esta especificación con las rutas documentadas a
// mano (@swagger) de `src/routes/*.ts`:
//
//   const spec = { ...swaggerJsdoc(options), paths: { ...openapiCrudPaths, ...comentadas } }
//
// Así los CRUDs quedan documentados de forma consistente (esquemas, ejemplos
// y respuestas de error compartidas) y los endpoints de negocio conservan su
// documentación junto al router.

import {
  openapiParameters,
  openapiResponses,
  openapiSchemas as errorSchemas,
  openapiTags,
  securitySchemes,
} from './components';
import { crudPaths, CrudDocConfig } from './crud-paths';
import { openapiSchemas } from './schemas';

/** Módulos CRUD del API y sus rutas (deben coincidir con `src/index.ts`). */
export const crudModules: CrudDocConfig[] = [
  // ── Identidad ────────────────────────────────────────────────────────────
  {
    path: '/api/v1/empresas',
    tag: 'Identidad',
    schema: 'Empresa',
    entity: 'Empresa',
    female: true,
    idExample: 1,
    filters: [{ name: 'ruc', description: 'Filtra por RUC exacto', type: 'string', example: '1792345678001' }],
  },
  {
    path: '/api/v1/configuracion',
    tag: 'Identidad',
    schema: 'Configuracion',
    entity: 'Configuración',
    female: true,
    idExample: 1,
    filters: [{ name: 'id_empresa', description: 'Filtra por empresa (se fuerza desde la sesión)', example: 1 }],
  },
  {
    path: '/api/v1/usuarios',
    tag: 'Identidad',
    schema: 'Usuario',
    entity: 'Usuario',
    idExample: 7,
    filters: [
      { name: 'id_empresa', description: 'Filtra por empresa (se fuerza desde la sesión)', example: 1 },
      { name: 'email', description: 'Filtra por correo exacto', type: 'string', example: 'andrea@ciudadelasanlucas.ec' },
      { name: 'estado', description: 'Filtra por estado', type: 'string', enum: ['activo', 'inactivo'] },
    ],
  },
  {
    path: '/api/v1/roles',
    tag: 'Identidad',
    schema: 'Rol',
    entity: 'Rol',
    idExample: 1,
    filters: [{ name: 'nombre_rol', description: 'Filtra por nombre del rol', type: 'string', example: 'Administrador' }],
  },
  {
    path: '/api/v1/permisos',
    tag: 'Identidad',
    schema: 'Permiso',
    entity: 'Permiso',
    idExample: 5,
    filters: [{ name: 'nombre_permiso', description: 'Filtra por nombre del permiso', type: 'string', example: 'crear_lotes' }],
    disabled: ['update'],
  },

  // ── Inventario ───────────────────────────────────────────────────────────
  {
    path: '/api/v1/proyectos',
    tag: 'Inventario',
    schema: 'Proyecto',
    entity: 'Proyecto',
    idExample: 3,
    filters: [{ name: 'id_empresa', description: 'Filtra por empresa (se fuerza desde la sesión)', example: 1 }],
  },
  {
    path: '/api/v1/proyecto-medios',
    tag: 'Inventario',
    schema: 'ProyectoMedio',
    entity: 'Medio del proyecto',
    plural: 'Medios del proyecto',
    idExample: 12,
    filters: [
      { name: 'id_proyecto', description: 'Filtra por proyecto', example: 3 },
      { name: 'tipo', description: 'Filtra por tipo de medio', type: 'string', enum: ['imagen', 'video'] },
    ],
  },
  {
    path: '/api/v1/mapas',
    tag: 'Inventario',
    schema: 'Mapa',
    entity: 'Mapa',
    idExample: 3,
    filters: [{ name: 'id_proyecto', description: 'Filtra por proyecto', example: 3 }],
  },
  {
    path: '/api/v1/etapas',
    tag: 'Inventario',
    schema: 'Etapa',
    entity: 'Etapa',
    idExample: 2,
    filters: [{ name: 'id_proyecto', description: 'Filtra por proyecto', example: 3 }],
  },
  {
    path: '/api/v1/manzanas',
    tag: 'Inventario',
    schema: 'Manzana',
    entity: 'Manzana',
    idExample: 8,
    filters: [{ name: 'id_etapa', description: 'Filtra por etapa', example: 2 }],
  },
  {
    path: '/api/v1/lotes',
    tag: 'Inventario',
    schema: 'Lote',
    entity: 'Lote',
    idExample: 45,
    filters: [
      { name: 'id_manzana', description: 'Filtra por manzana', example: 8 },
      {
        name: 'estado',
        description: 'Filtra por estado comercial',
        type: 'string',
        enum: ['disponible', 'reservado', 'vendido', 'en_negociacion', 'bloqueado', 'no_disponible'],
      },
      { name: 'codigo_catastral', description: 'Filtra por código catastral', type: 'string', example: 'SM-01-A-012' },
    ],
  },
  {
    path: '/api/v1/inventario',
    tag: 'Inventario',
    schema: 'Inventario',
    entity: 'Movimiento de inventario',
    plural: 'Movimientos de inventario',
    idExample: 230,
    filters: [
      { name: 'id_lote', description: 'Filtra por lote', example: 45 },
      { name: 'id_usuario', description: 'Filtra por usuario que registró el cambio', example: 7 },
    ],
  },

  // ── CRM ──────────────────────────────────────────────────────────────────
  {
    path: '/api/v1/prospectos',
    tag: 'CRM',
    schema: 'Prospecto',
    entity: 'Prospecto',
    idExample: 15,
    filters: [
      { name: 'id_empresa', description: 'Filtra por empresa (se fuerza desde la sesión)', example: 1 },
      { name: 'id_asesor', description: 'Filtra por asesor asignado', example: 2 },
      {
        name: 'estado',
        description: 'Filtra por estado del pipeline',
        type: 'string',
        enum: ['nuevo', 'contactado', 'interesado', 'negociacion', 'reserva', 'perdido'],
      },
    ],
  },
  {
    path: '/api/v1/oportunidades',
    tag: 'CRM',
    schema: 'Oportunidad',
    entity: 'Oportunidad',
    idExample: 9,
    filters: [
      { name: 'id_prospecto', description: 'Filtra por prospecto', example: 15 },
      { name: 'id_lote', description: 'Filtra por lote de interés', example: 45 },
      {
        name: 'etapa',
        description: 'Filtra por etapa del pipeline',
        type: 'string',
        enum: ['contactado', 'interesado', 'negociacion', 'reserva', 'perdido'],
      },
    ],
  },
  {
    path: '/api/v1/actividades',
    tag: 'CRM',
    schema: 'Actividad',
    entity: 'Actividad',
    idExample: 88,
    filters: [
      { name: 'id_prospecto', description: 'Filtra por prospecto', example: 15 },
      { name: 'tipo', description: 'Filtra por tipo de actividad', type: 'string', example: 'llamada' },
    ],
  },
  {
    path: '/api/v1/asesores',
    tag: 'CRM',
    schema: 'Asesor',
    entity: 'Asesor',
    idExample: 2,
    filters: [
      { name: 'codigo', description: 'Filtra por código comercial', type: 'string', example: 'AS-01' },
      { name: 'estado', description: 'Filtra por estado', type: 'string', enum: ['activo', 'inactivo'] },
    ],
  },

  // ── Ventas ───────────────────────────────────────────────────────────────
  {
    path: '/api/v1/clientes',
    tag: 'Ventas',
    schema: 'Cliente',
    entity: 'Cliente',
    idExample: 10,
    filters: [
      { name: 'nombres', description: 'Filtra por nombre exacto', type: 'string', example: 'María Pérez' },
      { name: 'cedula_ruc', description: 'Filtra por cédula o RUC', type: 'string', example: '1712345678' },
    ],
  },
  {
    path: '/api/v1/cotizaciones',
    tag: 'Ventas',
    schema: 'Cotizacion',
    entity: 'Cotización',
    female: true,
    idExample: 21,
    filters: [
      { name: 'id_cliente', description: 'Filtra por cliente', example: 10 },
      { name: 'id_lote', description: 'Filtra por lote', example: 45 },
      { name: 'estado', description: 'Filtra por estado', type: 'string', enum: ['pendiente', 'aceptada', 'rechazada'] },
    ],
  },
  {
    path: '/api/v1/ventas',
    tag: 'Ventas',
    schema: 'Venta',
    entity: 'Venta',
    female: true,
    idExample: 12,
    filters: [
      { name: 'id_cliente', description: 'Filtra por cliente', example: 10 },
      { name: 'id_lote', description: 'Filtra por lote', example: 45 },
      { name: 'estado', description: 'Filtra por estado', type: 'string', enum: ['pendiente', 'completada', 'cancelada'] },
    ],
  },
  {
    path: '/api/v1/contratos',
    tag: 'Ventas',
    schema: 'Contrato',
    entity: 'Contrato',
    idExample: 12,
    filters: [{ name: 'id_venta', description: 'Filtra por venta', example: 12 }],
  },
  {
    path: '/api/v1/cobranzas',
    tag: 'Ventas',
    schema: 'Cobranza',
    entity: 'Cobranza',
    female: true,
    idExample: 560,
    filters: [
      { name: 'id_contrato', description: 'Filtra por contrato', example: 12 },
      { name: 'estado', description: 'Filtra por estado', type: 'string', enum: ['pendiente', 'pagada', 'vencida'] },
    ],
  },
  {
    path: '/api/v1/pagos',
    tag: 'Ventas',
    schema: 'Pago',
    entity: 'Pago',
    idExample: 340,
    filters: [
      { name: 'id_cobranza', description: 'Filtra por cuota', example: 560 },
      { name: 'id_usuario', description: 'Filtra por usuario que registró el pago', example: 7 },
    ],
  },
  {
    path: '/api/v1/entradas-reserva',
    tag: 'Ventas',
    schema: 'EntradaReserva',
    entity: 'Entrada de reserva',
    plural: 'Entradas de reserva',
    female: true,
    idExample: 5,
    filters: [
      { name: 'id_lote', description: 'Filtra por lote reservado', example: 45 },
      { name: 'id_prospecto', description: 'Filtra por prospecto', example: 15 },
    ],
  },

  // ── Suscripciones ────────────────────────────────────────────────────────
  {
    path: '/api/v1/planes',
    tag: 'Suscripciones',
    schema: 'Plan',
    entity: 'Plan',
    idExample: 2,
    filters: [
      { name: 'clave', description: 'Filtra por clave', type: 'string', example: 'inicial' },
      { name: 'activo', description: 'Filtra por disponibilidad', type: 'boolean', example: true },
    ],
  },
  {
    path: '/api/v1/partnerships',
    tag: 'Suscripciones',
    schema: 'Partnership',
    entity: 'Partner',
    idExample: 1,
    filters: [{ name: 'codigo', description: 'Filtra por código', type: 'string', example: 'PARTNER01' }],
  },
];

/** Componentes OpenAPI (esquemas, parámetros, respuestas y seguridad). */
export const openapiComponents = {
  securitySchemes,
  parameters: openapiParameters,
  responses: openapiResponses,
  schemas: { ...errorSchemas, ...openapiSchemas },
};

/** Rutas OpenAPI de todos los módulos CRUD. */
export const openapiCrudPaths: Record<string, any> = crudModules.reduce<Record<string, any>>(
  (acc, module) => Object.assign(acc, crudPaths(module)),
  {}
);

export { openapiTags };
