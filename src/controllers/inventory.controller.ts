// controllers/inventory.controller.ts
// CRUD del módulo Inventario: proyectos, medios del proyecto, mapas (plano
// público), etapas, manzanas, lotes y la bitácora de cambios de estado.
//
// Multi-tenant: casi todas las tablas del módulo NO tienen `id_empresa`; el
// tenant se resuelve por la cadena FK
//   lotes → manzana_bloque → etapas → proyectos → id_empresa
// incrustada con `!inner` y filtrada por la ruta punteada (PostgREST).
//
// RBAC aplicado: crear_/editar_/eliminar_<recurso> por módulo, más
// `cambiar_estado_lotes` para los cambios de estado del lote.

import { Request, Response } from 'express';
import supabase from '../config/supabaseClient';
import { BaseController } from '../core/base.controller';
import { BaseService } from '../core/base.service';
import { createCrudRouter } from '../core/crud.factory';
import { HttpError } from '../core/errors';
import {
  etapaRequest,
  inventarioRequest,
  loteEstadoRequest,
  lotePoligonoRequest,
  loteRequest,
  manzanaRequest,
  mapaRequest,
  mapaSlugRequest,
  proyectoMedioRequest,
  proyectoRequest,
} from '../requests/inventory.request';
import {
  etapaConProyectoResource,
  inventarioResource,
  loteConManzanaResource,
  manzanaConEtapaResource,
  mapaConProyectoResource,
  proyectoConEmpresaResource,
  proyectoMedioConProyectoResource,
} from '../resources/inventory.resource';
import { chain } from '../middlewares/chain';
import { requireOrg } from '../middlewares/sessionAuth';
import { requirePermission } from '../middlewares/requirePermission';
import { assignEmpresaOnCreate, filterByEmpresa, filterByEmpresaChain } from '../middlewares/tenantScope';

const send = (res: Response, error: unknown): void => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message, details: error.details });
    return;
  }
  res.status(500).json({ message: error instanceof Error ? error.message : 'Error interno del servidor' });
};

/** Cadena de tenancy de los lotes y todo lo que cuelga de ellos. */
const LOTE_CHAIN_JOIN =
  'manzana_bloque!inner(nombre_codigo,etapas!inner(nombre,proyectos!inner(id_proyecto,nombre,id_empresa)))';
const LOTE_CHAIN_PATH = 'manzana_bloque.etapas.proyectos.id_empresa';

// ── Proyectos ───────────────────────────────────────────────────────────────
export const { router: proyectoRouter } = createCrudRouter({
  table: 'proyectos',
  primaryKey: 'id_proyecto',
  joins: ['empresa(id_empresa,razon_social)'],
  request: proyectoRequest,
  resource: proyectoConEmpresaResource,
  entityName: 'Proyecto',
  middlewares: [...requireOrg, filterByEmpresa],
  writeMiddlewares: [requirePermission('crear_proyectos'), assignEmpresaOnCreate],
  tenantPath: 'id_empresa',
  defaultGetAllOptions: { orderBy: 'id_proyecto', ascending: false },
});

// ── Proyecto medio (galería del proyecto) ───────────────────────────────────
const proyectoMedioService = new BaseService(
  'proyecto_medios',
  'id_proyecto_medio',
  ['proyectos!inner(id_empresa)']
);
const proyectoMedioController = new BaseController({
  service: proyectoMedioService,
  request: proyectoMedioRequest,
  resource: proyectoMedioConProyectoResource,
  entityName: 'Medio del proyecto',
});

export const { router: proyectoMedioRouter } = createCrudRouter({
  table: 'proyecto_medios',
  primaryKey: 'id_proyecto_medio',
  service: proyectoMedioService,
  controller: proyectoMedioController,
  joins: ['proyectos!inner(id_empresa)'],
  middlewares: [...requireOrg, filterByEmpresaChain('proyectos.id_empresa')],
  writeMiddlewares: [requirePermission('editar_proyectos')],
  tenantPath: 'proyectos.id_empresa',
  extraRoutes: (router) => {
    // GET /proyecto/:id_proyecto — galería completa de un proyecto (orden desc).
    router.get('/proyecto/:id_proyecto', ...requireOrg, async (req: Request, res: Response) => {
      try {
        const idProyecto = Number(req.params.id_proyecto);
        const { data: proyecto } = await supabase
          .from('proyectos')
          .select('id_empresa')
          .eq('id_proyecto', idProyecto)
          .maybeSingle();

        if (!proyecto || String((proyecto as { id_empresa: number }).id_empresa) !== req.organizationId) {
          res.status(404).json({ message: 'Proyecto no encontrado' });
          return;
        }

        const { data, error } = await supabase
          .from('proyecto_medios')
          .select('*')
          .eq('id_proyecto', idProyecto)
          .order('orden', { ascending: false })
          .order('id_proyecto_medio', { ascending: false });

        if (error) throw new HttpError(500, `No se pudieron leer los medios: ${error.message}`);
        res.json(proyectoMedioConProyectoResource.formatMany(data ?? []));
      } catch (error) {
        send(res, error);
      }
    });
  },
  defaultGetAllOptions: { orderBy: 'orden', ascending: false },
});

// ── Mapas (plano público del proyecto) ──────────────────────────────────────
const mapaService = new BaseService('mapas', 'id_mapa', ['proyectos!inner(id_empresa)']);
const mapaController = new BaseController({
  service: mapaService,
  request: mapaRequest,
  resource: mapaConProyectoResource,
  entityName: 'Mapa',
});

export const { router: mapaRouter } = createCrudRouter({
  table: 'mapas',
  primaryKey: 'id_mapa',
  service: mapaService,
  controller: mapaController,
  joins: ['proyectos!inner(id_empresa)'],
  middlewares: [...requireOrg, filterByEmpresaChain('proyectos.id_empresa')],
  writeMiddlewares: [requirePermission('crear_mapas')],
  tenantPath: 'proyectos.id_empresa',
  extraRoutes: (router) => {
    // GET /de-proyecto/:id_proyecto — el plano del proyecto (el repo usa limit 1).
    router.get('/de-proyecto/:id_proyecto', ...requireOrg, async (req: Request, res: Response) => {
      try {
        const idProyecto = Number(req.params.id_proyecto);
        const { data: proyecto } = await supabase
          .from('proyectos')
          .select('id_empresa')
          .eq('id_proyecto', idProyecto)
          .maybeSingle();

        if (!proyecto || String((proyecto as { id_empresa: number }).id_empresa) !== req.organizationId) {
          res.status(404).json({ message: 'Proyecto no encontrado' });
          return;
        }

        const { data, error } = await supabase
          .from('mapas')
          .select('*')
          .eq('id_proyecto', idProyecto)
          .limit(1)
          .maybeSingle();

        if (error) throw new HttpError(500, `No se pudo leer el mapa: ${error.message}`);
        if (!data) {
          res.status(404).json({ message: 'El proyecto no tiene un mapa configurado' });
          return;
        }
        res.json(mapaConProyectoResource.format(data));
      } catch (error) {
        send(res, error);
      }
    });

    // PUT /:id/slug — cambia el enlace público (único; devuelve 409 si existe).
    router.put('/:id/slug', ...requireOrg, requirePermission('editar_mapas'), async (req: Request, res: Response) => {
      try {
        // Guardia de tenant: el mapa debe pertenecer a la empresa activa.
        const { data: previo } = await supabase
          .from('mapas')
          .select('id_mapa, proyectos!inner(id_empresa)')
          .eq('id_mapa', Number(req.params.id))
          .maybeSingle();
        if (
          !previo ||
          String((previo as unknown as { proyectos: { id_empresa: number } }).proyectos.id_empresa) !== req.organizationId
        ) {
          res.status(404).json({ message: 'Mapa no encontrado' });
          return;
        }

        const { slug } = mapaSlugRequest.validateCreate(req.body) as { slug: string };
        const { data, error } = await supabase
          .from('mapas')
          .update({ slug })
          .eq('id_mapa', Number(req.params.id))
          .select('*')
          .maybeSingle();

        if (error) {
          const duplicado = error.code === '23505';
          res.status(duplicado ? 409 : 400).json({
            message: duplicado ? 'Ese slug ya está en uso por otro proyecto' : error.message,
          });
          return;
        }
        if (!data) {
          res.status(404).json({ message: 'Mapa no encontrado' });
          return;
        }
        res.json(mapaConProyectoResource.format(data));
      } catch (error) {
        send(res, error);
      }
    });
  },
  defaultGetAllOptions: { orderBy: 'id_mapa', ascending: false },
});

// ── Etapas ──────────────────────────────────────────────────────────────────
export const { router: etapaRouter } = createCrudRouter({
  table: 'etapas',
  primaryKey: 'id_etapa',
  joins: ['proyectos!inner(id_proyecto,nombre,id_empresa)'],
  request: etapaRequest,
  resource: etapaConProyectoResource,
  entityName: 'Etapa',
  middlewares: [...requireOrg, filterByEmpresaChain('proyectos.id_empresa')],
  writeMiddlewares: [requirePermission('crear_etapas')],
  tenantPath: 'proyectos.id_empresa',
  defaultGetAllOptions: { orderBy: 'orden', ascending: true },
});

// ── Manzanas ────────────────────────────────────────────────────────────────
export const { router: manzanaRouter } = createCrudRouter({
  table: 'manzana_bloque',
  primaryKey: 'id_manzana',
  joins: ['etapas!inner(nombre,orden,proyectos!inner(id_proyecto,nombre,id_empresa))'],
  request: manzanaRequest,
  resource: manzanaConEtapaResource,
  entityName: 'Manzana',
  middlewares: [...requireOrg, filterByEmpresaChain('etapas.proyectos.id_empresa')],
  writeMiddlewares: [requirePermission('crear_manzanas')],
  tenantPath: 'etapas.proyectos.id_empresa',
  defaultGetAllOptions: { orderBy: 'id_manzana' },
});

// ── Lotes ───────────────────────────────────────────────────────────────────
const loteService = new BaseService('lotes', 'id_lote', [LOTE_CHAIN_JOIN]);
const loteController = new BaseController({
  service: loteService,
  request: loteRequest,
  resource: loteConManzanaResource,
  entityName: 'Lote',
});

export const { router: loteRouter } = createCrudRouter({
  table: 'lotes',
  primaryKey: 'id_lote',
  service: loteService,
  controller: loteController,
  joins: [LOTE_CHAIN_JOIN],
  request: loteRequest,
  resource: loteConManzanaResource,
  entityName: 'Lote',
  middlewares: [...requireOrg, filterByEmpresaChain(LOTE_CHAIN_PATH)],
  writeMiddlewares: [requirePermission('crear_lotes')],
  tenantPath: LOTE_CHAIN_PATH,
  extraRoutes: (router) => {
    // PUT /:id/estado — cambia el estado del lote y deja el movimiento en la
    // bitácora `inventario` (estado_anterior → estado_nuevo), como el frontend.
    router.put(
      '/:id/estado',
      ...requireOrg,
      requirePermission('cambiar_estado_lotes'),
      async (req: Request, res: Response) => {
        try {
          const { estado } = loteEstadoRequest.validateCreate(req.body) as { estado: string };
          const idLote = Number(req.params.id);

          const { data: lote } = await supabase
            .from('lotes')
            .select('estado')
            .eq('id_lote', idLote)
            .maybeSingle();
          if (!lote) {
            res.status(404).json({ message: 'Lote no encontrado' });
            return;
          }

          const estadoAnterior = (lote as { estado: string }).estado;
          const { data: actualizado, error } = await supabase
            .from('lotes')
            .update({ estado })
            .eq('id_lote', idLote)
            .select('*')
            .single();

          if (error) throw new HttpError(400, `No se pudo cambiar el estado: ${error.message}`);

          // Bitácora de inventario (mejor-esfuerzo: no invalida el cambio).
          if (estadoAnterior !== estado) {
            await supabase.from('inventario').insert([
              {
                id_lote: idLote,
                id_usuario: req.localUsuarioId,
                estado_anterior: estadoAnterior,
                estado_nuevo: estado,
              },
            ]);
          }

          res.json(loteConManzanaResource.format(actualizado));
        } catch (error) {
          send(res, error);
        }
      }
    );

    // PUT /:id/poligono — guarda los vértices del lote sobre el plano.
    router.put(
      '/:id/poligono',
      ...requireOrg,
      requirePermission('editar_lotes'),
      async (req: Request, res: Response) => {
        try {
          const { poligono } = lotePoligonoRequest.validateCreate(req.body) as { poligono: Array<[number, number]> };
          const { data, error } = await supabase
            .from('lotes')
            .update({ poligono })
            .eq('id_lote', Number(req.params.id))
            .select('*')
            .maybeSingle();

          if (error) throw new HttpError(400, `No se pudo guardar el polígono: ${error.message}`);
          if (!data) {
            res.status(404).json({ message: 'Lote no encontrado' });
            return;
          }
          res.json(loteConManzanaResource.format(data));
        } catch (error) {
          send(res, error);
        }
      }
    );
  },
  defaultGetAllOptions: { orderBy: 'id_lote' },
});

// ── Inventario (bitácora de cambios de estado) ──────────────────────────────
export const { router: inventarioRouter } = createCrudRouter({
  table: 'inventario',
  primaryKey: 'id_inventario',
  joins: [
    'lotes!inner(id_lote,numero_lote,estado,manzana_bloque!inner(etapas!inner(proyectos!inner(id_empresa))))',
    'usuario(nombres,email)',
  ],
  request: inventarioRequest,
  resource: inventarioResource,
  entityName: 'Movimiento de inventario',
  middlewares: [...requireOrg, filterByEmpresaChain('lotes.manzana_bloque.etapas.proyectos.id_empresa')],
  // Escritura manual reservada: los movimientos reales los deja el cambio de
  // estado del lote (PUT /lotes/:id/estado).
  writeMiddlewares: [requirePermission('crear_inventario')],
  tenantPath: 'lotes.manzana_bloque.etapas.proyectos.id_empresa',
  defaultGetAllOptions: { orderBy: 'id_inventario', ascending: false },
});
