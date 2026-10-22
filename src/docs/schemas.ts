// docs/schemas.ts
// Esquemas OpenAPI de las entidades del esquema de Lotes al Mando.
//
// Por cada entidad se generan DOS esquemas:
//
//   Lote       → forma COMPLETA del registro (incluye id y fechas)
//   LoteInput  → payload de creación/actualización (solo campos escribibles)
//
// El esquema de entrada se deriva del completo quitando los campos de solo
// lectura, de modo que la documentación nunca se desalinea del modelo.

type Prop = Record<string, any>;

interface EntityDef {
  /** Nombre del esquema (y entidad). */
  name: string;
  /** Columna llave primaria. */
  pk: string;
  /** Ejemplo de la llave primaria en la documentación. */
  pkExample: number;
  /** Campos escribibles: tipo, descripción y restricciones. */
  properties: Prop;
  /** Campos obligatorios al CREAR. */
  required: string[];
  /** Ejemplo realista del registro completo. */
  example: Record<string, any>;
  /**
   * Subobjetos de llaves foráneas incrustados en la RESPUESTA (no en el input):
   * nombre del campo → esquema relacionado.
   */
  relations?: Record<string, string>;
  /** Entidad de SOLO LECTURA: no se genera el esquema `XxxInput`. */
  soloLectura?: boolean;
}

const id = (description = 'Identificador único del registro'): Prop => ({
  type: 'integer',
  readOnly: true,
  example: 1,
  description,
});

const ts = (description: string): Prop => ({
  type: 'string',
  format: 'date-time',
  readOnly: true,
  example: '2026-03-04T15:30:00.000Z',
  description,
});

const money = (example: number, description: string): Prop => ({
  type: 'number',
  format: 'double',
  example,
  description,
});

const ref = (schema: string): Prop => ({ type: 'integer', description: `FK → ${schema}`, example: 1 });

const definitions: EntityDef[] = [
  // ── Identidad ────────────────────────────────────────────────────────────
  {
    name: 'Empresa',
    pk: 'id_empresa',
    pkExample: 1,
    properties: {
      razon_social: { type: 'string', maxLength: 255, example: 'Ciudadela San Lucas S.A.', description: 'Razón social' },
      ruc: { type: 'string', pattern: '^\\d{13}$', nullable: true, example: '1792345678001', description: 'RUC de 13 dígitos' },
      estado: { type: 'string', maxLength: 50, default: 'activo', description: 'Estado de la empresa' },
      plan: { type: 'string', nullable: true, example: 'inicial', description: 'Clave del plan contratado' },
      id_partner: { type: 'integer', nullable: true, example: 1, description: 'FK → Partnership' },
      estado_pago: { type: 'string', enum: ['pendiente', 'pagado', 'cancelado'], nullable: true, readOnly: true, description: 'Lo escribe el webhook de Hotmart' },
    },
    required: ['razon_social'],
    example: {
      id_empresa: 1,
      razon_social: 'Ciudadela San Lucas S.A.',
      ruc: '1792345678001',
      estado: 'activo',
      created_at: '2025-10-01T14:05:00.000Z',
      plan: 'inicial',
      id_partner: 1,
      estado_pago: 'pagado',
      pagado_en: '2026-01-12T10:00:00.000Z',
      transaccion_id: 'HM-998877',
    },
  },
  {
    name: 'Configuracion',
    pk: 'id_configuracion',
    pkExample: 1,
    properties: {
      id_empresa: ref('Empresa'),
      moneda: { type: 'string', maxLength: 10, nullable: true, example: 'USD', description: 'Moneda' },
      idioma: { type: 'string', maxLength: 10, nullable: true, example: 'es', description: 'Idioma' },
    },
    required: ['id_empresa'],
    example: { id_configuracion: 1, id_empresa: 1, moneda: 'USD', idioma: 'es' },
  },
  {
    name: 'Usuario',
    pk: 'id_usuario',
    pkExample: 7,
    properties: {
      id_empresa: ref('Empresa'),
      nombres: { type: 'string', maxLength: 255, example: 'Andrea Salazar', description: 'Nombres completos' },
      email: { type: 'string', format: 'email', example: 'andrea@ciudadelasanlucas.ec', description: 'Correo vinculado con Supabase Auth' },
      estado: { type: 'string', enum: ['activo', 'inactivo'], default: 'activo', description: 'Estado de la cuenta' },
      password_temporal_hasta: { type: 'string', format: 'date-time', nullable: true, description: 'Vigencia de la contraseña temporal' },
    },
    required: ['id_empresa', 'nombres', 'email'],
    example: {
      id_usuario: 7,
      id_empresa: 1,
      nombres: 'Andrea Salazar',
      email: 'andrea@ciudadelasanlucas.ec',
      estado: 'activo',
      password_temporal_hasta: null,
      created_at: '2025-10-01T14:06:00.000Z',
    },
    relations: { empresa: 'Empresa' },
  },
  {
    name: 'Rol',
    pk: 'id_rol',
    pkExample: 1,
    properties: {
      nombre_rol: { type: 'string', maxLength: 100, example: 'Administrador', description: 'Nombre del rol' },
    },
    required: ['nombre_rol'],
    example: { id_rol: 1, nombre_rol: 'Administrador' },
  },
  {
    name: 'Permiso',
    pk: 'id_permiso',
    pkExample: 5,
    properties: {
      nombre_permiso: { type: 'string', maxLength: 150, example: 'crear_lotes', description: 'Nombre del permiso (<accion>_<recurso>)' },
      modulo: { type: 'string', maxLength: 100, nullable: true, example: 'lotes', description: 'Módulo' },
    },
    required: ['nombre_permiso'],
    example: { id_permiso: 5, nombre_permiso: 'crear_lotes', modulo: 'lotes' },
  },

  // ── Inventario ───────────────────────────────────────────────────────────
  {
    name: 'Proyecto',
    pk: 'id_proyecto',
    pkExample: 3,
    properties: {
      id_empresa: ref('Empresa'),
      nombre: { type: 'string', maxLength: 255, example: 'Ciudadela San Lucas', description: 'Nombre del proyecto' },
    },
    required: ['nombre'],
    example: { id_proyecto: 3, id_empresa: 1, nombre: 'Ciudadela San Lucas', created_at: '2025-10-02T10:00:00.000Z' },
    relations: { empresa: 'Empresa' },
  },
  {
    name: 'ProyectoMedio',
    pk: 'id_proyecto_medio',
    pkExample: 12,
    properties: {
      id_proyecto: ref('Proyecto'),
      tipo: { type: 'string', enum: ['imagen', 'video'], description: 'Tipo de medio' },
      url: { type: 'string', format: 'uri', example: 'https://cdn.supabase.co/medios/fachada.jpg', description: 'URL pública (bucket medios)' },
      orden: { type: 'integer', description: 'Posición; si no se envía, se calcula MAX+1' },
    },
    required: ['id_proyecto', 'tipo', 'url'],
    example: { id_proyecto_medio: 12, id_proyecto: 3, tipo: 'imagen', url: 'https://cdn.supabase.co/medios/fachada.jpg', orden: 4, created_at: '2026-01-10T09:00:00.000Z' },
  },
  {
    name: 'Mapa',
    pk: 'id_mapa',
    pkExample: 3,
    properties: {
      id_proyecto: ref('Proyecto'),
      url_publica: { type: 'string', format: 'uri', nullable: true, description: 'Imagen del plano (bucket mapas)' },
      slug: { type: 'string', pattern: '^[a-z0-9-]{2,80}$', nullable: true, example: 'ciudadela-san-lucas', description: 'Enlace público corto (único)' },
    },
    required: ['id_proyecto'],
    example: { id_mapa: 3, id_proyecto: 3, url_publica: 'https://cdn.supabase.co/mapas/plano.png', slug: 'ciudadela-san-lucas', created_at: '2025-11-01T08:00:00.000Z' },
  },
  {
    name: 'Etapa',
    pk: 'id_etapa',
    pkExample: 2,
    properties: {
      id_proyecto: ref('Proyecto'),
      nombre: { type: 'string', maxLength: 255, example: 'Etapa 1', description: 'Nombre de la etapa' },
      orden: { type: 'integer', nullable: true, description: 'Orden de aparición' },
    },
    required: ['id_proyecto', 'nombre'],
    example: { id_etapa: 2, id_proyecto: 3, nombre: 'Etapa 1', orden: 1 },
  },
  {
    name: 'Manzana',
    pk: 'id_manzana',
    pkExample: 8,
    properties: {
      id_etapa: ref('Etapa'),
      nombre_codigo: { type: 'string', maxLength: 255, nullable: true, example: 'A', description: 'Nombre o código de la manzana' },
    },
    required: ['id_etapa'],
    example: { id_manzana: 8, id_etapa: 2, nombre_codigo: 'A' },
  },
  {
    name: 'Lote',
    pk: 'id_lote',
    pkExample: 45,
    properties: {
      id_manzana: ref('Manzana'),
      numero_lote: { type: 'string', maxLength: 100, example: '12', description: 'Número o código del lote' },
      precio_lista: { ...money(13400, 'Precio de lista en USD'), nullable: true },
      estado: {
        type: 'string',
        enum: ['disponible', 'reservado', 'vendido', 'en_negociacion', 'bloqueado', 'no_disponible'],
        default: 'disponible',
        description: 'Estado comercial del lote',
      },
      superficie_m2: { type: 'number', nullable: true, example: 144, description: 'Superficie en m²' },
      codigo_catastral: { type: 'string', maxLength: 50, nullable: true, example: 'SM-01-A-012', description: 'Código catastral (único)' },
      medidas: { type: 'string', maxLength: 255, nullable: true, example: '8,00 x 18,00', description: 'Medidas' },
      poligono: {
        type: 'array',
        nullable: true,
        description: 'Vértices [x, y] normalizados 0..1 sobre el plano',
        items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      },
    },
    required: ['id_manzana', 'numero_lote'],
    example: {
      id_lote: 45,
      id_manzana: 8,
      numero_lote: '12',
      precio_lista: 13400,
      estado: 'disponible',
      superficie_m2: 144,
      codigo_catastral: 'SM-01-A-012',
      medidas: '8,00 x 18,00',
      poligono: [[0.12, 0.34], [0.2, 0.34], [0.2, 0.45], [0.12, 0.45]],
    },
  },
  {
    name: 'Inventario',
    pk: 'id_inventario',
    pkExample: 230,
    properties: {
      id_lote: ref('Lote'),
      id_usuario: ref('Usuario'),
      estado_anterior: { type: 'string', maxLength: 50, nullable: true, example: 'disponible', description: 'Estado previo' },
      estado_nuevo: { type: 'string', maxLength: 50, example: 'vendido', description: 'Estado nuevo' },
    },
    required: ['id_lote', 'id_usuario', 'estado_nuevo'],
    example: { id_inventario: 230, id_lote: 45, id_usuario: 7, estado_anterior: 'disponible', estado_nuevo: 'vendido', created_at: '2026-02-14T16:00:00.000Z' },
  },

  // ── CRM ──────────────────────────────────────────────────────────────────
  {
    name: 'Prospecto',
    pk: 'id_prospecto',
    pkExample: 15,
    properties: {
      id_empresa: ref('Empresa'),
      id_asesor: { ...ref('Asesor'), nullable: true },
      nombres: { type: 'string', maxLength: 255, example: 'María Pérez', description: 'Nombre del prospecto' },
      email: { type: 'string', format: 'email', nullable: true, example: 'maria@correo.com' },
      telefono: { type: 'string', maxLength: 50, nullable: true, example: '+593987654321' },
      origen: { type: 'string', maxLength: 100, default: 'directo', example: 'mapa', description: 'Canal de captación' },
      estado: { type: 'string', enum: ['nuevo', 'contactado', 'interesado', 'negociacion', 'reserva', 'perdido'], default: 'nuevo' },
      notas: { type: 'string', maxLength: 5000, nullable: true },
      fecha_ultimo_seguimiento: { type: 'string', format: 'date-time', nullable: true },
    },
    required: ['nombres'],
    example: {
      id_prospecto: 15,
      id_empresa: 1,
      id_asesor: 2,
      nombres: 'María Pérez',
      email: 'maria@correo.com',
      telefono: '+593987654321',
      origen: 'mapa',
      estado: 'interesado',
      notas: 'Le interesa el lote 12 de la manzana A',
      fecha_ultimo_seguimiento: '2026-03-01T10:00:00.000Z',
      created_at: '2026-02-20T09:00:00.000Z',
    },
  },
  {
    name: 'Oportunidad',
    pk: 'id_oportunidad',
    pkExample: 9,
    properties: {
      id_empresa: ref('Empresa'),
      id_prospecto: ref('Prospecto'),
      id_lote: { ...ref('Lote'), nullable: true },
      etapa: { type: 'string', enum: ['contactado', 'interesado', 'negociacion', 'reserva', 'perdido'], default: 'contactado' },
      valor_estimado: { ...money(13400, 'Valor estimado'), nullable: true },
      notas: { type: 'string', maxLength: 5000, nullable: true },
    },
    required: ['id_prospecto'],
    example: {
      id_oportunidad: 9,
      id_empresa: 1,
      id_prospecto: 15,
      id_lote: 45,
      etapa: 'negociacion',
      valor_estimado: 13400,
      notas: 'Pide 48 cuotas sin interés',
      created_at: '2026-02-21T11:00:00.000Z',
    },
    relations: { prospecto: 'Prospecto' },
  },
  {
    name: 'Actividad',
    pk: 'id_actividad',
    pkExample: 88,
    properties: {
      id_prospecto: ref('Prospecto'),
      id_usuario: { ...ref('Usuario'), nullable: true },
      tipo: { type: 'string', maxLength: 50, example: 'llamada', description: 'Tipo de actividad' },
      descripcion: { type: 'string', maxLength: 2000, nullable: true },
      fecha_actividad: { type: 'string', format: 'date-time', description: 'Por defecto, ahora' },
    },
    required: ['id_prospecto', 'tipo'],
    example: { id_actividad: 88, id_prospecto: 15, id_usuario: 7, tipo: 'llamada', descripcion: 'Le envié el plan de pagos', fecha_actividad: '2026-03-01T10:05:00.000Z', created_at: '2026-03-01T10:05:00.000Z' },
  },
  {
    name: 'Asesor',
    pk: 'id_asesor',
    pkExample: 2,
    properties: {
      id_empresa: ref('Empresa'),
      id_usuario: { ...ref('Usuario'), nullable: true },
      codigo: { type: 'string', maxLength: 50, example: 'AS-01', description: 'Código comercial (único por empresa)' },
      nombre_comercial: { type: 'string', maxLength: 255, example: 'Carlos Andrade' },
      meta_ventas_mensual: { ...money(20000, 'Meta mensual en USD'), default: 0 },
      estado: { type: 'string', enum: ['activo', 'inactivo'], default: 'activo' },
    },
    required: ['codigo', 'nombre_comercial'],
    example: { id_asesor: 2, id_empresa: 1, id_usuario: 8, codigo: 'AS-01', nombre_comercial: 'Carlos Andrade', meta_ventas_mensual: 20000, estado: 'activo', created_at: '2025-10-05T09:00:00.000Z' },
  },

  // ── Ventas ───────────────────────────────────────────────────────────────
  {
    name: 'Cliente',
    pk: 'id_cliente',
    pkExample: 10,
    properties: {
      id_empresa: { ...ref('Empresa'), nullable: true, description: 'Nullable: clientes antiguos sin empresa' },
      nombres: { type: 'string', maxLength: 255, example: 'María Pérez' },
      cedula_ruc: { type: 'string', nullable: true, example: '1712345678', description: 'Cédula (10) o RUC (13)' },
      email: { type: 'string', format: 'email', nullable: true, example: 'maria@correo.com' },
      telefono: { type: 'string', maxLength: 50, nullable: true, example: '+593987654321' },
    },
    required: ['nombres'],
    example: { id_cliente: 10, id_empresa: 1, nombres: 'María Pérez', cedula_ruc: '1712345678', email: 'maria@correo.com', telefono: '+593987654321', created_at: '2026-02-20T09:10:00.000Z' },
  },
  {
    name: 'Cotizacion',
    pk: 'id_cotizacion',
    pkExample: 21,
    properties: {
      id_cliente: ref('Cliente'),
      id_lote: ref('Lote'),
      precio_ofertado: money(13400, 'Precio ofertado en USD'),
      estado: { type: 'string', enum: ['pendiente', 'aceptada', 'rechazada'], default: 'pendiente' },
      id_asesor: { ...ref('Asesor'), nullable: true },
      monto_entrada: { ...money(1340, 'Entrada/enganche'), default: 0 },
      num_cuotas: { type: 'integer', minimum: 1, default: 12, description: 'Número de cuotas' },
    },
    required: ['id_cliente', 'id_lote', 'precio_ofertado'],
    example: {
      id_cotizacion: 21,
      id_cliente: 10,
      id_lote: 45,
      precio_ofertado: 13400,
      estado: 'pendiente',
      id_asesor: 2,
      monto_entrada: 1340,
      num_cuotas: 47,
      created_at: '2026-02-21T12:00:00.000Z',
    },
    relations: { cliente: 'Cliente', lote: 'Lote', asesor: 'Asesor' },
  },
  {
    name: 'Venta',
    pk: 'id_venta',
    pkExample: 12,
    properties: {
      id_cliente: ref('Cliente'),
      id_lote: ref('Lote'),
      id_cotizacion: { ...ref('Cotizacion'), nullable: true, description: 'Única por venta (índice único)' },
      id_usuario: ref('Usuario'),
      precio_final: money(13400, 'Precio final'),
      estado: { type: 'string', enum: ['pendiente', 'completada', 'cancelada'], default: 'pendiente' },
      id_asesor: { ...ref('Asesor'), nullable: true },
    },
    required: ['id_cliente', 'id_lote', 'id_usuario', 'precio_final'],
    example: { id_venta: 12, id_cliente: 10, id_lote: 45, id_cotizacion: 21, id_usuario: 7, precio_final: 13400, estado: 'completada', id_asesor: 2, created_at: '2026-02-14T16:00:00.000Z' },
    relations: { cliente: 'Cliente', lote: 'Lote', usuario: 'Usuario', asesor: 'Asesor' },
  },
  {
    name: 'Contrato',
    pk: 'id_contrato',
    pkExample: 12,
    properties: {
      id_venta: ref('Venta'),
      numero_contrato: { type: 'string', maxLength: 100, example: 'C-1740000000000', description: 'Número de contrato' },
      monto_total: money(13400, 'Monto total del contrato'),
    },
    required: ['id_venta', 'numero_contrato', 'monto_total'],
    example: { id_contrato: 12, id_venta: 12, numero_contrato: 'C-1740000000000', monto_total: 13400, created_at: '2026-02-14T16:00:01.000Z' },
    relations: { venta: 'Venta' },
  },
  {
    name: 'Cobranza',
    pk: 'id_cobranza',
    pkExample: 560,
    properties: {
      id_contrato: ref('Contrato'),
      numero_cuota: { type: 'integer', minimum: 1, example: 1 },
      monto_cuota: money(257, 'Monto de la cuota'),
      estado: { type: 'string', enum: ['pendiente', 'pagada', 'vencida'], default: 'pendiente' },
      fecha_vencimiento: { type: 'string', format: 'date', example: '2026-03-14' },
    },
    required: ['id_contrato', 'numero_cuota', 'monto_cuota', 'fecha_vencimiento'],
    example: { id_cobranza: 560, id_contrato: 12, numero_cuota: 1, monto_cuota: 257, estado: 'pendiente', fecha_vencimiento: '2026-03-14', created_at: '2026-02-14T16:00:01.000Z' },
  },
  {
    name: 'Pago',
    pk: 'id_pago',
    pkExample: 340,
    properties: {
      id_cobranza: ref('Cobranza'),
      id_usuario: ref('Usuario'),
      monto_pagado: money(257, 'Monto pagado'),
      fecha_pago: { type: 'string', format: 'date', description: 'Por defecto, hoy' },
    },
    required: ['id_cobranza', 'id_usuario', 'monto_pagado'],
    example: { id_pago: 340, id_cobranza: 560, id_usuario: 7, monto_pagado: 257, fecha_pago: '2026-03-10', created_at: '2026-03-10T15:00:00.000Z' },
  },
  {
    name: 'EntradaReserva',
    pk: 'id_entrada',
    pkExample: 5,
    properties: {
      id_lote: ref('Lote'),
      id_prospecto: { ...ref('Prospecto'), nullable: true },
      id_empresa: { ...ref('Empresa'), nullable: true, description: 'Denormalizado para el filtrado por tenant' },
      id_usuario: ref('Usuario'),
      monto: { ...money(500, 'Monto de la entrada'), minimum: 0.01 },
      fecha_pago: { type: 'string', format: 'date', description: 'Por defecto, hoy' },
    },
    required: ['id_lote', 'id_usuario', 'monto'],
    example: { id_entrada: 5, id_lote: 45, id_prospecto: 15, id_empresa: 1, id_usuario: 7, monto: 500, fecha_pago: '2026-02-25', created_at: '2026-02-25T10:00:00.000Z' },
    relations: { lote: 'Lote', prospecto: 'Prospecto', usuario: 'Usuario' },
  },

  // ── Suscripciones ────────────────────────────────────────────────────────
  {
    name: 'Plan',
    pk: 'id_plan',
    pkExample: 2,
    properties: {
      clave: { type: 'string', maxLength: 50, example: 'inicial', description: 'Clave única (referenciada por empresa.plan)' },
      nombre: { type: 'string', maxLength: 150, example: 'Inicial' },
      descripcion: { type: 'string', nullable: true },
      imagen_url: { type: 'string', format: 'uri', nullable: true },
      url_checkout: { type: 'string', format: 'uri', nullable: true, description: 'Link Hotmart' },
      precio: { ...money(29, 'USD mensual'), nullable: true, description: 'NULL = no se muestra públicamente' },
      orden: { type: 'integer' },
      activo: { type: 'boolean', default: true },
      max_proyectos: { type: 'integer', nullable: true, description: 'NULL = sin límite' },
      max_lotes_por_proyecto: { type: 'integer', nullable: true },
      max_usuarios: { type: 'integer', nullable: true },
    },
    required: ['clave', 'nombre'],
    example: {
      id_plan: 2,
      clave: 'inicial',
      nombre: 'Inicial',
      descripcion: 'Hasta 3 proyectos y 10 usuarios',
      imagen_url: 'https://cdn.supabase.co/planes/inicial.png',
      url_checkout: 'https://pay.hotmart.com/inicial',
      precio: 29,
      orden: 2,
      activo: true,
      max_proyectos: 3,
      max_lotes_por_proyecto: 250,
      max_usuarios: 10,
      created_at: '2025-12-01T10:00:00.000Z',
    },
  },
  {
    name: 'Partnership',
    pk: 'id_partner',
    pkExample: 1,
    properties: {
      nombre: { type: 'string', maxLength: 150, example: 'Partner Andes' },
      codigo: { type: 'string', maxLength: 50, example: 'PARTNER01', description: 'Código único (mayúsculas)' },
      email: { type: 'string', format: 'email', nullable: true },
      estado: { type: 'string', maxLength: 50, default: 'activo' },
    },
    required: ['nombre', 'codigo'],
    example: { id_partner: 1, nombre: 'Partner Andes', codigo: 'PARTNER01', email: 'aliados@partnerandes.ec', estado: 'activo', created_at: '2025-12-10T10:00:00.000Z' },
  },
];

/** Construye los esquemas completos + Input a partir de las definiciones. */
function buildEntitySchemas(defs: EntityDef[]): Record<string, any> {
  const schemas: Record<string, any> = {};

  // Primera pasada: forma completa sin relaciones (los $ref se resuelven luego).
  for (const def of defs) {
    const properties: Prop = {
      [def.pk]: id(),
      ...def.properties,
      created_at: ts('Fecha de creación'),
    };

    // Relaciones incrustadas: solo en la respuesta.
    for (const [campo, schema] of Object.entries(def.relations ?? {})) {
      properties[campo] = {
        type: 'object',
        nullable: true,
        description: `Relación incrustada (FK → ${schema})`,
        $ref: `#/components/schemas/${schema}`,
      };
    }

    schemas[def.name] = {
      type: 'object',
      description: `Registro completo de ${def.name}`,
      properties,
      example: def.example,
    };
  }

  // Segunda pasada: esquemas de entrada (sin campos de solo lectura ni relaciones).
  for (const def of defs) {
    if (def.soloLectura) continue;

    const properties: Prop = {};
    for (const [campo, prop] of Object.entries(def.properties)) {
      if (prop.readOnly) continue;
      properties[campo] = prop;
    }

    schemas[`${def.name}Input`] = {
      type: 'object',
      description: `Payload de creación/actualización de ${def.name}`,
      properties,
      required: def.required,
      example: Object.fromEntries(
        Object.entries(def.example).filter(
          ([campo]) => def.required.includes(campo) || (def.properties[campo] && !def.properties[campo].readOnly)
        )
      ),
    };
  }

  return schemas;
}

export const openapiSchemas = buildEntitySchemas(definitions);
