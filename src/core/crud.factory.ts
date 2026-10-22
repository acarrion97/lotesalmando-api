// core/crud.factory.ts
// Factory híbrido del CRUD genérico.
//
// Combina las clases base (BaseService, BaseController) con una función que las
// instancia y arma el router Express completo de una sola vez:
//
//   const { router } = createCrudRouter<Lote>({
//     table: 'lotes',
//     primaryKey: 'id_lote',
//     request: loteRequest,
//     resource: loteResource,
//   });
//
// Permite además:
//   - middlewares globales del router (ej. sessionAuth + filtro por empresa).
//   - middlewares por escritura (ej. requirePermission solo en escrituras).
//   - handlers personalizados que reemplazan al genérico.
//   - deshabilitar métodos que no apliquen.
//   - filtros por defecto de lectura (columnas, orden, paginación).
//   - registrar rutas extra (ej. PUT /:id/estado) sobre el mismo router.
//   - acotar update/remove al tenant vía `tenantPath` (columna `id_empresa`
//     directa o ruta punteada por la cadena FK incrustada).

import { Request, RequestHandler, Response, Router } from 'express';
import { BaseController } from './base.controller';
import { BaseRequest } from './base.request';
import { BaseResource } from './base.resource';
import { BaseService, GetAllOptions } from './base.service';

export type CrudMethod = 'getAll' | 'getById' | 'create' | 'update' | 'remove';

export interface CrudRouterConfig<T> {
  /** Tabla de la base de datos. */
  table: string;
  /** Llave primaria (por defecto 'id'). */
  primaryKey?: string;
  /**
   * Relaciones (llaves foráneas) a incrustar en las respuestas, en sintaxis
   * PostgREST: p. ej. `['proyectos!inner(id_empresa)']`. El objeto incrustado
   * llega con el nombre de la TABLA foránea y el Resource lo renombra.
   */
  joins?: string[];

  /** Request con validaciones + payload (opcional; sin él se usa req.body crudo). */
  request?: BaseRequest<T>;
  /** Resource con la vista de respuesta (opcional; sin él se devuelve el registro crudo). */
  resource?: BaseResource<any, any>;

  /** Servicio ya construido (para subclases con lógica propia). Si no, se instancia BaseService. */
  service?: BaseService<T>;
  /** Controlador ya construido (para subclases con handlers propios). */
  controller?: BaseController<T>;

  /** Entidad para los mensajes (ej. 'Lote'). */
  entityName?: string;

  /** Middlewares aplicados a todas las rutas (ej. requireOrg). */
  middlewares?: RequestHandler[];
  /** Middlewares solo para métodos de escritura (create/update/remove). */
  writeMiddlewares?: RequestHandler[];

  /** Handlers personalizados que reemplazan a los genéricos. */
  handlers?: Partial<Record<CrudMethod, RequestHandler>>;
  /** Métodos a deshabilitar (por defecto todos habilitados). */
  disabled?: CrudMethod[];

  /** Opciones por defecto de getAll: columnas seleccionadas y orden. */
  defaultGetAllOptions?: Pick<GetAllOptions, 'columns' | 'orderBy' | 'ascending'>;

  /** Rutas extra registradas sobre el mismo router (swagger + lógica propia). */
  extraRoutes?: (router: Router, controller: BaseController<T>, service: BaseService<T>) => void;

  /**
   * Acota update/remove a la organización activa del contexto
   * (`req.organizationId`). Es la RUTA PUNTEADA del valor de empresa dentro
   * del registro ya incrustado:
   *
   *   'id_empresa'                                  → tablas con columna directa
   *   'proyectos.id_empresa'                        → etapas, proyecto_medios
   *   'manzana_bloque.etapas.proyectos.id_empresa'  → lotes, ventas, etc.
   *
   * Si el registro pertenece a otra organización responde 404 (no filtra su
   * existencia). Debe usarse junto a los `joins` con `!inner` que incrustan
   * la cadena. Sin `tenantPath` se usa `row.organization_id` (herencia imvolt).
   */
  tenantPath?: string;
}

export interface CrudRouterResult<T> {
  router: Router;
  service: BaseService<T>;
  controller: BaseController<T>;
}

/** Lee un valor de una fila siguiendo una ruta punteada ('a.b.c'). */
function readPath(row: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
      row
    );
}

export function createCrudRouter<T = any>(config: CrudRouterConfig<T>): CrudRouterResult<T> {
  const service =
    config.service ?? new BaseService<T>(config.table, config.primaryKey ?? 'id', config.joins ?? []);

  const controller =
    config.controller ??
    new BaseController<T>({
      service,
      request: config.request,
      resource: config.resource,
      entityName: config.entityName,
    });

  const router = Router();
  const globalMiddlewares = config.middlewares ?? [];
  const writeMiddlewares = config.writeMiddlewares ?? [];
  const disabled = new Set<CrudMethod>(config.disabled ?? []);
  const handlers = config.handlers ?? {};

  // getAll con filtros por querystring (?estado=disponible&limite=20&pagina=2)
  // más las opciones por defecto de la configuración. Las claves punteadas del
  // querystring (p. ej. `?manzana_bloque.etapas.proyectos.id_empresa=1`) se
  // traducen en filtros sobre recursos incrustados de PostgREST.
  const listHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
      const { limite, pagina, ...filtros } = req.query as Record<string, string>;
      const limit = limite ? Number(limite) : undefined;
      const offset = pagina && limit ? (Number(pagina) - 1) * limit : undefined;

      const rows = await service.getAll({
        ...config.defaultGetAllOptions,
        where: filtros,
        limit,
        offset,
      });

      res.json(controller.formatMany(rows));
    } catch (error) {
      controller.sendError(res, error);
    }
  };

  const resolve = (method: CrudMethod, fallback: RequestHandler): RequestHandler =>
    handlers[method] ?? fallback;

  // Verifica que el registro pertenezca a la organización activa antes de
  // leerlo, editarlo o eliminarlo (multi-tenant). Si no existe o es de otra
  // organización responde 404, sin filtrar su existencia.
  const tenantGuard: RequestHandler = async (req: Request, res: Response, next) => {
    if (!config.tenantPath || !req.organizationId) {
      next();
      return;
    }
    try {
      const row = (await service.getById(String(req.params.id))) as Record<string, unknown>;
      const actual = readPath(row, config.tenantPath);
      if (actual != null && String(actual) !== req.organizationId) {
        res.status(404).json({ message: `Registro no encontrado` });
        return;
      }
      next();
    } catch (error) {
      controller.sendError(res, error);
    }
  };

  if (!disabled.has('getAll')) {
    router.get('/', ...globalMiddlewares, resolve('getAll', listHandler));
  }
  if (!disabled.has('getById')) {
    router.get('/:id', ...globalMiddlewares, tenantGuard, resolve('getById', controller.getById));
  }
  if (!disabled.has('create')) {
    router.post('/', ...globalMiddlewares, ...writeMiddlewares, resolve('create', controller.create));
  }
  if (!disabled.has('update')) {
    router.put('/:id', ...globalMiddlewares, ...writeMiddlewares, tenantGuard, resolve('update', controller.update));
    // El frontend REST usa PATCH; se registra como alias de PUT.
    router.patch('/:id', ...globalMiddlewares, ...writeMiddlewares, tenantGuard, resolve('update', controller.update));
  }
  if (!disabled.has('remove')) {
    router.delete('/:id', ...globalMiddlewares, ...writeMiddlewares, tenantGuard, resolve('remove', controller.remove));
  }

  config.extraRoutes?.(router, controller, service);

  return { router, service, controller };
}
