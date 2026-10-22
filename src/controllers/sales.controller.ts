// controllers/sales.controller.ts
// CRUD del módulo Comercial: clientes, cotizaciones (tabla `cotizador`),
// ventas, contratos, cobranzas, pagos y entradas de reserva.
//
// Endpoints de negocio:
//   POST /cotizaciones/:id/aceptar  → RPC aceptar_cotizacion (venta + lote
//                                     vendido + inventario + contrato + cuotas)
//   GET  /cobranzas/vencidas        → cuotas vencidas de la empresa
//   GET  /contratos/:id/cobranzas   → cronograma de pagos de un contrato
//   POST /pagos/registrar           → registra el pago y marca la cuota
//
// Multi-tenant: cliente y entradas_reserva llevan `id_empresa` (nullable);
// cotizador/ventas/contratos/cobranzas/pagos se acotan por la cadena
// lotes → manzana_bloque → etapas → proyectos.
//
// RBAC aplicado: crear_clientes, crear_/editar_cotizaciones, aprobar_ventas,
// registrar_pago.

import { Request, Response, Router } from 'express';
import supabase from '../config/supabaseClient';
import { BaseController } from '../core/base.controller';
import { BaseService } from '../core/base.service';
import { createCrudRouter } from '../core/crud.factory';
import { HttpError } from '../core/errors';
import {
  clienteRequest,
  cobranzaEstadoRequest,
  cobranzaRequest,
  contratoRequest,
  cotizacionRequest,
  entradaReservaRequest,
  pagoRequest,
  ventaRequest,
} from '../requests/sales.request';
import {
  clienteResource,
  cobranzaResource,
  contratoResource,
  cotizacionResource,
  entradaReservaResource,
  pagoResource,
  ventaResource,
} from '../resources/sales.resource';
import { requireOrg } from '../middlewares/sessionAuth';
import { requirePermission } from '../middlewares/requirePermission';
import { assignEmpresaOnCreate, filterByEmpresa, filterByEmpresaChain } from '../middlewares/tenantScope';
import { aceptarCotizacion } from '../services/rpc.service';

const send = (res: Response, error: unknown): void => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message, details: error.details });
    return;
  }
  res.status(500).json({ message: error instanceof Error ? error.message : 'Error interno del servidor' });
};

/** Cadena de tenancy desde una venta hacia la empresa. */
const VENTA_CHAIN_JOIN =
  'lotes!inner(numero_lote,estado,manzana_bloque!inner(etapas!inner(proyectos!inner(id_empresa))))';
const VENTA_CHAIN_PATH = 'lotes.manzana_bloque.etapas.proyectos.id_empresa';

// ── Clientes ────────────────────────────────────────────────────────────────
export const { router: clienteRouter } = createCrudRouter({
  table: 'cliente',
  primaryKey: 'id_cliente',
  request: clienteRequest,
  resource: clienteResource,
  entityName: 'Cliente',
  middlewares: [...requireOrg, filterByEmpresa],
  writeMiddlewares: [requirePermission('crear_clientes'), assignEmpresaOnCreate],
  tenantPath: 'id_empresa',
  defaultGetAllOptions: { orderBy: 'id_cliente', ascending: false },
});

// ── Cotizaciones (tabla `cotizador`) ────────────────────────────────────────
const cotizacionService = new BaseService('cotizador', 'id_cotizacion', [
  'cliente(nombres,email,cedula_ruc)',
  VENTA_CHAIN_JOIN,
  'asesores(codigo,nombre_comercial)',
]);
const cotizacionController = new BaseController({
  service: cotizacionService,
  request: cotizacionRequest,
  resource: cotizacionResource,
  entityName: 'Cotización',
});

export const { router: cotizacionRouter } = createCrudRouter({
  table: 'cotizador',
  primaryKey: 'id_cotizacion',
  service: cotizacionService,
  controller: cotizacionController,
  joins: ['cliente(nombres,email,cedula_ruc)', VENTA_CHAIN_JOIN, 'asesores(codigo,nombre_comercial)'],
  request: cotizacionRequest,
  resource: cotizacionResource,
  entityName: 'Cotización',
  middlewares: [...requireOrg, filterByEmpresaChain(VENTA_CHAIN_PATH)],
  writeMiddlewares: [requirePermission('crear_cotizaciones')],
  tenantPath: VENTA_CHAIN_PATH,
  extraRoutes: (router) => {
    // POST /:id/aceptar — transacción completa vía RPC `aceptar_cotizacion`:
    // crea la venta, marca el lote vendido (+ inventario), genera el contrato
    // y las cuotas (cobranzas). Idempotente: si ya fue aceptada, devuelve 400.
    router.post(
      '/:id/aceptar',
      ...requireOrg,
      requirePermission('aprobar_ventas'),
      async (req: Request, res: Response) => {
        try {
          const resultado = await aceptarCotizacion(Number(req.params.id), req.localUsuarioId!);
          res.status(201).json({
            message: 'Cotización aceptada: venta, contrato y cuotas generados',
            ...resultado,
          });
        } catch (error) {
          send(res, error);
        }
      }
    );
  },
  defaultGetAllOptions: { orderBy: 'id_cotizacion', ascending: false },
});

// ── Ventas ──────────────────────────────────────────────────────────────────
export const { router: ventaRouter } = createCrudRouter({
  table: 'ventas',
  primaryKey: 'id_venta',
  joins: ['cliente(nombres,email,cedula_ruc)', VENTA_CHAIN_JOIN, 'usuario(nombres,email)', 'asesores(codigo,nombre_comercial)'],
  request: ventaRequest,
  resource: ventaResource,
  entityName: 'Venta',
  middlewares: [...requireOrg, filterByEmpresaChain(VENTA_CHAIN_PATH)],
  writeMiddlewares: [requirePermission('crear_ventas')],
  tenantPath: VENTA_CHAIN_PATH,
  defaultGetAllOptions: { orderBy: 'id_venta', ascending: false },
});

// ── Contratos ───────────────────────────────────────────────────────────────
export const { router: contratoRouter } = createCrudRouter({
  table: 'contratos',
  primaryKey: 'id_contrato',
  joins: [
    'ventas!inner(precio_final,estado,id_lote,id_cliente,id_usuario,' +
      'lotes!inner(numero_lote,estado,manzana_bloque!inner(etapas!inner(proyectos!inner(id_empresa)))))',
  ],
  request: contratoRequest,
  resource: contratoResource,
  entityName: 'Contrato',
  middlewares: [...requireOrg, filterByEmpresaChain('ventas.lotes.manzana_bloque.etapas.proyectos.id_empresa')],
  writeMiddlewares: [requirePermission('aprobar_ventas')],
  tenantPath: 'ventas.lotes.manzana_bloque.etapas.proyectos.id_empresa',
  extraRoutes: (router) => {
    // GET /:id/cobranzas — el cronograma de cuotas del contrato.
    router.get('/:id/cobranzas', ...requireOrg, async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from('cobranzas')
          .select('*')
          .eq('id_contrato', Number(req.params.id))
          .order('numero_cuota', { ascending: true });

        if (error) throw new HttpError(500, `No se pudieron leer las cuotas: ${error.message}`);
        res.json(cobranzaResource.formatMany(data ?? []));
      } catch (error) {
        send(res, error);
      }
    });
  },
  defaultGetAllOptions: { orderBy: 'id_contrato', ascending: false },
});

// ── Cobranzas ───────────────────────────────────────────────────────────────
const COBRANZA_CHAIN_JOIN =
  'contratos!inner(ventas!inner(lotes!inner(manzana_bloque!inner(etapas!inner(proyectos!inner(id_empresa))))))';
const COBRANZA_CHAIN_PATH = 'contratos.ventas.lotes.manzana_bloque.etapas.proyectos.id_empresa';

const cobranzaService = new BaseService('cobranzas', 'id_cobranza', [COBRANZA_CHAIN_JOIN]);
const cobranzaController = new BaseController({
  service: cobranzaService,
  request: cobranzaRequest,
  resource: cobranzaResource,
  entityName: 'Cobranza',
});

const cobranzaCrud = createCrudRouter({
  table: 'cobranzas',
  primaryKey: 'id_cobranza',
  service: cobranzaService,
  controller: cobranzaController,
  joins: [COBRANZA_CHAIN_JOIN],
  request: cobranzaRequest,
  resource: cobranzaResource,
  entityName: 'Cobranza',
  middlewares: [...requireOrg, filterByEmpresaChain(COBRANZA_CHAIN_PATH)],
  writeMiddlewares: [requirePermission('registrar_pago')],
  tenantPath: COBRANZA_CHAIN_PATH,
  defaultGetAllOptions: { orderBy: 'fecha_vencimiento', ascending: true },
}).router;

// Las rutas ESPECÍFICAS se registran ANTES del CRUD para que no las capture
// el comodín GET /:id.
export const cobranzaRouter = Router();

/**
 * @swagger
 * /api/v1/cobranzas/vencidas:
 *   get:
 *     summary: Cuotas vencidas de la empresa activa (fecha de vencimiento pasada y sin pagar)
 *     tags: [Cobranzas]
 *     responses:
 *       200:
 *         description: Lista de cuotas vencidas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Cobranza' }
 */
cobranzaRouter.get('/vencidas', ...requireOrg, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('cobranzas')
      .select(`id_cobranza, id_contrato, numero_cuota, monto_cuota, estado, fecha_vencimiento, created_at, ${COBRANZA_CHAIN_JOIN}`)
      .eq(COBRANZA_CHAIN_PATH, Number(req.organizationId))
      .eq('estado', 'pendiente')
      .lt('fecha_vencimiento', new Date().toISOString().slice(0, 10))
      .order('fecha_vencimiento', { ascending: true });

    if (error) throw new HttpError(500, `No se pudieron leer las cuotas vencidas: ${error.message}`);
    res.json(cobranzaResource.formatMany(data ?? []));
  } catch (error) {
    send(res, error);
  }
});

/**
 * @swagger
 * /api/v1/cobranzas/{id}/estado:
 *   patch:
 *     summary: Cambia el estado de una cuota (pagada / vencida / pendiente)
 *     tags: [Cobranzas]
 *     parameters:
 *       - { in: path, name: id, schema: { type: integer }, required: true, example: 12 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado: { type: string, enum: [pendiente, pagada, vencida], example: pagada }
 */
cobranzaRouter.patch('/:id/estado', ...requireOrg, requirePermission('registrar_pago'), async (req: Request, res: Response) => {
  try {
    const { estado } = cobranzaEstadoRequest.validateCreate(req.body) as { estado: string };
    const { data, error } = await supabase
      .from('cobranzas')
      .update({ estado })
      .eq('id_cobranza', Number(req.params.id))
      .select('*')
      .maybeSingle();

    if (error) throw new HttpError(400, `No se pudo actualizar la cuota: ${error.message}`);
    if (!data) {
      res.status(404).json({ message: 'Cobranza no encontrada' });
      return;
    }
    res.json(cobranzaResource.format(data));
  } catch (error) {
    send(res, error);
  }
});

cobranzaRouter.use(cobranzaCrud);

// ── Pagos ───────────────────────────────────────────────────────────────────
const PAGO_CHAIN_JOIN =
  'cobranzas!inner(id_contrato,numero_cuota,monto_cuota,estado,fecha_vencimiento,' +
  'contratos!inner(ventas!inner(lotes!inner(manzana_bloque!inner(etapas!inner(proyectos!inner(id_empresa)))))))';
const PAGO_CHAIN_PATH = 'cobranzas.contratos.ventas.lotes.manzana_bloque.etapas.proyectos.id_empresa';

const pagoService = new BaseService('pagos', 'id_pago', [PAGO_CHAIN_JOIN, 'usuario(nombres,email)']);
const pagoController = new BaseController({
  service: pagoService,
  request: pagoRequest,
  resource: pagoResource,
  entityName: 'Pago',
});

export const { router: pagoRouter } = createCrudRouter({
  table: 'pagos',
  primaryKey: 'id_pago',
  service: pagoService,
  controller: pagoController,
  joins: [PAGO_CHAIN_JOIN, 'usuario(nombres,email)'],
  request: pagoRequest,
  resource: pagoResource,
  entityName: 'Pago',
  middlewares: [...requireOrg, filterByEmpresaChain(PAGO_CHAIN_PATH)],
  writeMiddlewares: [requirePermission('registrar_pago')],
  tenantPath: PAGO_CHAIN_PATH,
  extraRoutes: (router) => {
    // POST /registrar — registra el pago Y marca la cuota como pagada cuando
    // la suma de pagos cubre el monto de la cuota (transacción mejor-esfuerzo).
    router.post('/registrar', ...requireOrg, requirePermission('registrar_pago'), async (req: Request, res: Response) => {
      try {
        const payload = pagoRequest.validateCreate(req.body) as {
          id_cobranza: number;
          id_usuario: number;
          monto_pagado: number;
          fecha_pago?: string;
        };

        // Guardia de tenant: la cuota debe pertenecer a la empresa activa.
        const { data: cobranza } = await supabase
          .from('cobranzas')
          .select(`id_cobranza, monto_cuota, estado, ${COBRANZA_CHAIN_JOIN}`)
          .eq('id_cobranza', payload.id_cobranza)
          .maybeSingle();
        if (
          !cobranza ||
          String(
            (cobranza as any).contratos?.ventas?.lotes?.manzana_bloque?.etapas?.proyectos?.id_empresa
          ) !== req.organizationId
        ) {
          res.status(404).json({ message: 'Cobranza no encontrada' });
          return;
        }

        const { data: pago, error } = await supabase
          .from('pagos')
          .insert([
            {
              ...payload,
              fecha_pago: payload.fecha_pago ?? new Date().toISOString().slice(0, 10),
            },
          ])
          .select('*')
          .single();
        if (error) throw new HttpError(400, `No se pudo registrar el pago: ${error.message}`);

        // ¿La cuota queda saldada?
        const { data: pagos } = await supabase
          .from('pagos')
          .select('monto_pagado')
          .eq('id_cobranza', payload.id_cobranza);

        const acumulado = (pagos ?? []).reduce((suma, fila) => suma + Number(fila.monto_pagado ?? 0), 0);
        const montoCuota = Number((cobranza as { monto_cuota: number }).monto_cuota);
        let cuotaPagada = false;

        if (acumulado >= montoCuota) {
          const { error: updateError } = await supabase
            .from('cobranzas')
            .update({ estado: 'pagada' })
            .eq('id_cobranza', payload.id_cobranza);
          cuotaPagada = !updateError;
        }

        res.status(201).json({
          message: cuotaPagada ? 'Pago registrado: cuota saldada' : 'Pago registrado',
          pago: pagoResource.format(pago),
          acumulado,
          monto_cuota: montoCuota,
          cuota_pagada: cuotaPagada,
        });
      } catch (error) {
        send(res, error);
      }
    });
  },
  defaultGetAllOptions: { orderBy: 'id_pago', ascending: false },
});

// ── Entradas de reserva ─────────────────────────────────────────────────────
export const { router: entradaReservaRouter } = createCrudRouter({
  table: 'entradas_reserva',
  primaryKey: 'id_entrada',
  joins: ['lotes(numero_lote,estado)', 'prospectos(nombres,estado)', 'usuario(nombres,email)'],
  request: entradaReservaRequest,
  resource: entradaReservaResource,
  entityName: 'Entrada de reserva',
  middlewares: [...requireOrg, filterByEmpresa],
  writeMiddlewares: [requirePermission('registrar_pago'), assignEmpresaOnCreate],
  tenantPath: 'id_empresa',
  defaultGetAllOptions: { orderBy: 'id_entrada', ascending: false },
});
