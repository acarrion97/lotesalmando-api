// index.ts
// LOTES AL MANDO API — GESTIÓN DE LOTES, CRM Y VENTAS
// Backend para la plataforma de lotesalmando.com.
//
// Arquitectura: monolito modular Express + TypeScript sobre el MISMO esquema
// Supabase que usa el frontend (service role key, solo backend). Cada módulo
// expone su CRUD genérico bajo /api/v1, generado por `core/crud.factory`:
//
//   identidad       /empresas /configuracion /usuarios /roles /permisos
//                   /roles-usuarios /roles-permisos
//   inventario      /proyectos /proyecto-medios /mapas /etapas /manzanas
//                   /lotes /inventario
//   crm             /prospectos /oportunidades /actividades /asesores
//   ventas          /clientes /cotizaciones /ventas /contratos /cobranzas
//                   /pagos /entradas-reserva
//   suscripciones   /planes /partnerships
//   público         /api/v1/publico/mapas/:slug (+ /interes) /planes
//   alertas         /api/v1/alertas
//
// Convenciones multi-tenant:
//   - Las tablas con `id_empresa` directo se filtran con `?id_empresa=` forzado.
//   - Las que cuelgan por cadena FK (lotes, ventas, cobranzas…) se acotan con
//     el join `!inner` y el filtro punteado (p. ej.
//     `manzana_bloque.etapas.proyectos.id_empresa`).

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { config } from './config/global';
import authRoutes from './routes/auth.route';
import publicRoutes from './routes/public.route';
import alertasRoutes from './routes/alertas.route';
import {
  configuracionRouter,
  empresaRouter,
  permisoRouter,
  rolPermisoRouter,
  rolRouter,
  usuarioRolRouter,
  usuarioRouter,
} from './routes/identity.route';
import {
  etapaRouter,
  inventarioRouter,
  loteRouter,
  manzanaRouter,
  mapaRouter,
  proyectoMedioRouter,
  proyectoRouter,
} from './routes/inventory.route';
import {
  actividadRouter,
  asesorRouter,
  oportunidadRouter,
  prospectoRouter,
} from './routes/crm.route';
import {
  clienteRouter,
  cobranzaRouter,
  contratoRouter,
  cotizacionRouter,
  entradaReservaRouter,
  pagoRouter,
  ventaRouter,
} from './routes/sales.route';
import { planRouter, partnershipRouter } from './routes/subscriptions.route';
import { openapiComponents, openapiCrudPaths, openapiTags } from './docs';

dotenv.config();

const app = express();

// ── Middleware global ────────────────────────────────────────────────────────
app.use(cors({ origin: config.allowedOrigin }));
app.use(express.json({ limit: '10mb' }));

// ── Salud del servicio ──────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    service: 'lotesalmando-api',
    brand: 'Lotes al Mando',
    status: 'ok',
    time: new Date().toISOString(),
  });
});

// ── Registro de rutas ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// identidad
app.use('/api/v1/empresas', empresaRouter);
app.use('/api/v1/configuracion', configuracionRouter);
app.use('/api/v1/usuarios', usuarioRouter);
app.use('/api/v1/roles', rolRouter);
app.use('/api/v1/permisos', permisoRouter);
app.use('/api/v1/roles-usuarios', usuarioRolRouter);
app.use('/api/v1/roles-permisos', rolPermisoRouter);

// inventario
app.use('/api/v1/proyectos', proyectoRouter);
app.use('/api/v1/proyecto-medios', proyectoMedioRouter);
app.use('/api/v1/mapas', mapaRouter);
app.use('/api/v1/etapas', etapaRouter);
app.use('/api/v1/manzanas', manzanaRouter);
app.use('/api/v1/lotes', loteRouter);
app.use('/api/v1/inventario', inventarioRouter);

// crm
app.use('/api/v1/prospectos', prospectoRouter);
app.use('/api/v1/oportunidades', oportunidadRouter);
app.use('/api/v1/actividades', actividadRouter);
app.use('/api/v1/asesores', asesorRouter);

// ventas
app.use('/api/v1/clientes', clienteRouter);
app.use('/api/v1/cotizaciones', cotizacionRouter);
app.use('/api/v1/ventas', ventaRouter);
app.use('/api/v1/contratos', contratoRouter);
app.use('/api/v1/cobranzas', cobranzaRouter);
app.use('/api/v1/pagos', pagoRouter);
app.use('/api/v1/entradas-reserva', entradaReservaRouter);

// suscripciones
app.use('/api/v1/planes', planRouter);
app.use('/api/v1/partnerships', partnershipRouter);

// público (sin token) + alertas
app.use('/api/v1/publico', publicRoutes);
app.use('/api/v1/alertas', alertasRoutes);

// ── Documentación Swagger ───────────────────────────────────────────────────
// Combina las rutas comentadas con @swagger (auth, público, roles…) con las
// rutas CRUD generadas desde `src/docs` (esquemas + ejemplos + errores).
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Lotes al Mando API',
      version: '1.0.0',
      description: [
        'API de **Lotes al Mando**: inventario de lotes, CRM, ventas, cobranzas y suscripciones.',
        '',
        '### Cómo usar esta documentación',
        '1. Autentícate en `POST /api/auth/login` y copia el `access_token`.',
        '2. Pulsa **Authorize** 🔒 e ingresa el token (el API lo envía como `Authorization: Bearer <token>`).',
        '3. Cada endpoint de lista acepta filtros por columna exacta (`?estado=disponible&codigo_catastral=SM-01-A-012`)',
        '   y paginación (`?limite=20&pagina=1`).',
        '',
        '### Convenciones',
        '- **Errores**: siempre `{ "message": string, "details"?: [{ field, message }] }`.',
        '- **Multi-empresa**: todas las lecturas se acotan a la empresa del token; el header `X-Empresa-Id` permite operar en otra empresa si el usuario pertenece a varias.',
        '- **Cadenas FK**: los recursos sin `id_empresa` directo (lotes, ventas, cobranzas…) se filtran por la cadena hacia `proyectos`.',
        '- **RPCs**: `POST /cotizaciones/{id}/aceptar` ejecuta la transacción completa `aceptar_cotizacion` (venta + lote vendido + inventario + contrato + cuotas).',
        '- **Público**: `/api/v1/publico/*` no requiere token (mapa interactivo y planes).',
        '- **Auditoría**: las escrituras quedan registradas en `audit_logs` si la tabla existe (migración `033_audit_logs.sql`).',
      ].join('\n'),
      license: { name: 'MIT' },
      contact: { name: 'Soporte Lotes al Mando', email: 'soporte@lotesalmando.com' },
    },
    servers: [
      { url: `http://localhost:${config.port}`, description: 'Desarrollo local' },
    ],
    tags: openapiTags,
    components: openapiComponents,
    // Todo el API requiere token; /auth/* y /publico/* lo desactivan.
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const spec = swaggerJsdoc(swaggerOptions) as Record<string, any>;
spec.paths = { ...openapiCrudPaths, ...(spec.paths ?? {}) };

// Identencia visual de la documentación (paleta Lotes al Mando).
const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: 'Lotes al Mando API — Documentación',
  customCss: `
    .swagger-ui .topbar { background-color: #0b3d2e; }
    .swagger-ui .topbar a span { color: #ffffff; }
    .swagger-ui .info .title { color: #1a7f5a; }
    .swagger-ui .info .description p { color: #1d2b26; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background-color: #0b3d2e; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method,
    .swagger-ui .opblock.opblock-put .opblock-summary-method,
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { background-color: #1a7f5a; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background-color: #bd3b3b; }
    .swagger-ui .btn.execute { background-color: #1a7f5a; border-color: #1a7f5a; }
    .swagger-ui .scheme-container { background: #f2f7f4; box-shadow: none; border: 1px solid #dfeae4; }
  `,
};

app.use('/documentacion', swaggerUi.serve, swaggerUi.setup(spec, swaggerUiOptions));

// ── Arranque ────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`Lotes al Mando API escuchando en http://localhost:${config.port}`);
  console.log(`Documentación: http://localhost:${config.port}/documentacion`);
});

export default app;
