// controllers/identity.controller.ts
// CRUD del módulo Identidad: empresa (tenant raíz), configuración, usuarios,
// roles, permisos y las dos tablas de unión del RBAC.
//
// RBAC aplicado (catálogo permiso/rol_permiso/usuario_rol):
//   empresa        → crear_empresas (escritura), Superusuario (borrado)
//   configuración  → editar_configuracion
//   usuarios       → crear_usuarios / editar_usuarios / eliminar_usuarios
//   roles          → crear_roles / editar_roles / eliminar_roles
//   permisos       → crear_permisos / eliminar_permisos
//   usuario_rol    → editar_usuarios (asignar/revocar roles)
//   rol_permiso    → asignar_permisos

import { Request, Response, Router } from 'express';
import supabase from '../config/supabaseClient';
import { BaseController } from '../core/base.controller';
import { BaseService } from '../core/base.service';
import { createCrudRouter } from '../core/crud.factory';
import { HttpError } from '../core/errors';
import {
  asignarRolesRequest,
  configuracionRequest,
  empresaRequest,
  permisoRequest,
  rolPermisoRequest,
  rolRequest,
  usuarioAccesoRequest,
  usuarioRequest,
  usuarioRolRequest,
} from '../requests/identity.request';
import {
  configuracionResource,
  empresaResource,
  permisoResource,
  rolResource,
  usuarioResource,
} from '../resources/identity.resource';
import { chain } from '../middlewares/chain';
import { requireOrg } from '../middlewares/sessionAuth';
import { requirePermission } from '../middlewares/requirePermission';
import { requireSuperusuario } from '../middlewares/requireRole';
import { assignEmpresaOnCreate, filterByEmpresa } from '../middlewares/tenantScope';
import { authService } from '../services/auth.service';

const send = (res: Response, error: unknown): void => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message, details: error.details });
    return;
  }
  res.status(500).json({ message: error instanceof Error ? error.message : 'Error interno del servidor' });
};

// ── Empresa (tenant raíz) ───────────────────────────────────────────────────
const empresaService = new BaseService('empresa', 'id_empresa');
const empresaController = new BaseController({
  service: empresaService,
  request: empresaRequest,
  resource: empresaResource,
  entityName: 'Empresa',
});

export const { router: empresaRouter } = createCrudRouter({
  table: 'empresa',
  primaryKey: 'id_empresa',
  service: empresaService,
  controller: empresaController,
  // Cada empresa solo ve la SUYA (el tenant es la propia fila).
  middlewares: [...requireOrg, filterByEmpresa],
  tenantPath: 'id_empresa',
  handlers: {
    create: chain(requirePermission('crear_empresas'), empresaController.create),
    update: chain(requirePermission('crear_empresas'), empresaController.update),
    remove: chain(requireSuperusuario, empresaController.remove),
  },
  defaultGetAllOptions: { orderBy: 'id_empresa', ascending: false },
});

// ── Configuración (1:1 por empresa, con upsert) ─────────────────────────────
const configuracionService = new BaseService('configuracion', 'id_configuracion');
const configuracionController = new BaseController({
  service: configuracionService,
  request: configuracionRequest,
  resource: configuracionResource,
  entityName: 'Configuración',
});

export const { router: configuracionRouter } = createCrudRouter({
  table: 'configuracion',
  primaryKey: 'id_configuracion',
  service: configuracionService,
  controller: configuracionController,
  middlewares: [...requireOrg, filterByEmpresa],
  writeMiddlewares: [requirePermission('editar_configuracion'), assignEmpresaOnCreate],
  tenantPath: 'id_empresa',
  extraRoutes: (router) => {
    // PUT /empresa/:id_empresa — upsert idempotente (como el `save` del frontend).
    router.put(
      '/empresa/:id_empresa',
      ...requireOrg,
      requirePermission('editar_configuracion'),
      async (req: Request, res: Response) => {
        try {
          const idEmpresa = Number(req.params.id_empresa);
          if (String(idEmpresa) !== req.organizationId) {
            res.status(404).json({ message: 'Registro no encontrado' });
            return;
          }

          const payload = configuracionRequest.validateUpdate(req.body) as Record<string, unknown>;
          const { data, error } = await supabase
            .from('configuracion')
            .upsert({ ...payload, id_empresa: idEmpresa }, { onConflict: 'id_empresa' })
            .select('*')
            .single();

          if (error) throw new HttpError(400, `No se pudo guardar la configuración: ${error.message}`);
          res.json(configuracionResource.format(data));
        } catch (error) {
          send(res, error);
        }
      }
    );
  },
  defaultGetAllOptions: { orderBy: 'id_configuracion' },
});

// ── Usuario ─────────────────────────────────────────────────────────────────
const usuarioService = new BaseService('usuario', 'id_usuario', ['empresa(id_empresa,razon_social,plan)']);
const usuarioController = new BaseController({
  service: usuarioService,
  request: usuarioRequest,
  resource: usuarioResource,
  entityName: 'Usuario',
});

export const { router: usuarioRouter } = createCrudRouter({
  table: 'usuario',
  primaryKey: 'id_usuario',
  service: usuarioService,
  controller: usuarioController,
  middlewares: [...requireOrg, filterByEmpresa],
  writeMiddlewares: [requirePermission('crear_usuarios'), assignEmpresaOnCreate],
  tenantPath: 'id_empresa',
  extraRoutes: (router) => {
    // POST /con-acceso — alta con cuenta de Supabase Auth (réplica de la RPC
    // crear_usuario_auth, que exige sesión y el backend usa service role).
    router.post(
      '/con-acceso',
      ...requireOrg,
      requirePermission('crear_usuarios'),
      async (req: Request, res: Response) => {
        try {
          const input = usuarioAccesoRequest.validateCreate(req.body) as Parameters<
            typeof authService.crearUsuarioConAcceso
          >[0];
          const resultado = await authService.crearUsuarioConAcceso(input, Number(req.organizationId));
          res.status(201).json({ message: 'Usuario creado con cuenta de acceso', ...resultado });
        } catch (error) {
          send(res, error);
        }
      }
    );

    // POST /:id/roles — asigna roles a un usuario (reemplaza su conjunto).
    router.post(
      '/:id/roles',
      ...requireOrg,
      requirePermission('editar_usuarios'),
      async (req: Request, res: Response) => {
        try {
          const idUsuario = Number(req.params.id);
          const { roles } = asignarRolesRequest.validateCreate(req.body) as { roles: number[] };

          // Verificación de tenant: el usuario debe pertenecer a la empresa.
          const { data: usuario } = await supabase
            .from('usuario')
            .select('id_empresa')
            .eq('id_usuario', idUsuario)
            .maybeSingle();
          if (!usuario || String((usuario as { id_empresa: number }).id_empresa) !== req.organizationId) {
            res.status(404).json({ message: 'Registro no encontrado' });
            return;
          }

          // Reemplazo idempotente del conjunto de roles.
          await supabase.from('usuario_rol').delete().eq('id_usuario', idUsuario);
          await authService.asignarRoles(idUsuario, roles);

          res.json({ message: 'Roles asignados correctamente', id_usuario: idUsuario, roles });
        } catch (error) {
          send(res, error);
        }
      }
    );

    // DELETE /:id/roles/:rol_id — revoca un rol puntual.
    router.delete(
      '/:id/roles/:rol_id',
      ...requireOrg,
      requirePermission('editar_usuarios'),
      async (req: Request, res: Response) => {
        try {
          const { error } = await supabase
            .from('usuario_rol')
            .delete()
            .eq('id_usuario', Number(req.params.id))
            .eq('id_rol', Number(req.params.rol_id));

          if (error) throw new HttpError(400, `No se pudo revocar el rol: ${error.message}`);
          res.json({ message: 'Rol revocado correctamente' });
        } catch (error) {
          send(res, error);
        }
      }
    );
  },
  defaultGetAllOptions: { orderBy: 'id_usuario', ascending: false },
});

// ── Rol (catálogo global editable) ──────────────────────────────────────────
export const { router: rolRouter } = createCrudRouter({
  table: 'roles',
  primaryKey: 'id_rol',
  request: rolRequest,
  resource: rolResource,
  entityName: 'Rol',
  middlewares: [...requireOrg],
  writeMiddlewares: [requirePermission('crear_roles')],
  defaultGetAllOptions: { orderBy: 'id_rol' },
});

// ── Permiso (catálogo global editable) ──────────────────────────────────────
export const { router: permisoRouter } = createCrudRouter({
  table: 'permiso',
  primaryKey: 'id_permiso',
  request: permisoRequest,
  resource: permisoResource,
  entityName: 'Permiso',
  middlewares: [...requireOrg],
  // El catálogo no tiene `editar_permisos` sembrado: se crea y se elimina.
  writeMiddlewares: [requirePermission('crear_permisos')],
  disabled: ['update'],
  defaultGetAllOptions: { orderBy: 'id_permiso' },
});

// ── usuario_rol (PK compuesta: asignar / revocar) ───────────────────────────
export const usuarioRolRouter = Router();

/**
 * @swagger
 * /api/v1/roles-usuarios:
 *   get:
 *     summary: Lista las asignaciones de rol a usuario
 *     tags: [Identidad]
 *     parameters:
 *       - { in: query, name: id_usuario, schema: { type: integer }, example: 7 }
 *       - { in: query, name: id_rol, schema: { type: integer }, example: 1 }
 *   post:
 *     summary: Asigna un rol a un usuario
 *     tags: [Identidad]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_usuario, id_rol]
 *             properties:
 *               id_usuario: { type: integer, example: 7 }
 *               id_rol: { type: integer, example: 1 }
 *   delete:
 *     summary: Revoca un rol de un usuario
 *     tags: [Identidad]
 *     parameters:
 *       - { in: path, name: id_usuario, schema: { type: integer }, required: true, example: 7 }
 *       - { in: path, name: id_rol, schema: { type: integer }, required: true, example: 1 }
 */
usuarioRolRouter.get('/', ...requireOrg, async (req: Request, res: Response) => {
  try {
    const filtros = req.query as Record<string, string>;
    let query = supabase
      .from('usuario_rol')
      .select('*, roles(nombre_rol), usuario!inner(id_empresa, nombres, email)');

    // Acota a la empresa activa (los usuarios son de la empresa).
    if (req.organizationId) query = query.eq('usuario.id_empresa', Number(req.organizationId));
    Object.keys(filtros).forEach((key) => {
      if (key !== 'limite' && key !== 'pagina') query = query.eq(key, filtros[key] as never);
    });

    const { data, error } = await query.order('fecha_asignacion', { ascending: false });
    if (error) throw new HttpError(500, `No se pudieron leer las asignaciones: ${error.message}`);

    res.json(
      (data ?? []).map((fila: Record<string, any>) => ({
        id_usuario: fila.id_usuario,
        id_rol: fila.id_rol,
        fecha_asignacion: fila.fecha_asignacion,
        rol: fila.roles ? rolResource.format(fila.roles) : null,
        usuario: fila.usuario
          ? { id_usuario: fila.usuario.id_usuario, nombres: fila.usuario.nombres, email: fila.usuario.email }
          : null,
      }))
    );
  } catch (error) {
    send(res, error);
  }
});

usuarioRolRouter.post('/', ...requireOrg, requirePermission('editar_usuarios'), async (req: Request, res: Response) => {
  try {
    const payload = usuarioRolRequest.validateCreate(req.body) as { id_usuario: number; id_rol: number };

    const { data: usuario } = await supabase
      .from('usuario')
      .select('id_empresa')
      .eq('id_usuario', payload.id_usuario)
      .maybeSingle();
    if (!usuario || String((usuario as { id_empresa: number }).id_empresa) !== req.organizationId) {
      res.status(404).json({ message: 'Registro no encontrado' });
      return;
    }

    const { error } = await supabase
      .from('usuario_rol')
      .upsert([payload], { onConflict: 'id_usuario,id_rol', ignoreDuplicates: true });
    if (error) throw new HttpError(400, `No se pudo asignar el rol: ${error.message}`);

    res.status(201).json({ message: 'Rol asignado correctamente', ...payload });
  } catch (error) {
    send(res, error);
  }
});

usuarioRolRouter.delete(
  '/:id_usuario/:id_rol',
  ...requireOrg,
  requirePermission('editar_usuarios'),
  async (req: Request, res: Response) => {
    try {
      const { error } = await supabase
        .from('usuario_rol')
        .delete()
        .eq('id_usuario', Number(req.params.id_usuario))
        .eq('id_rol', Number(req.params.id_rol));

      if (error) throw new HttpError(400, `No se pudo revocar el rol: ${error.message}`);
      res.json({ message: 'Rol revocado correctamente' });
    } catch (error) {
      send(res, error);
    }
  }
);

// ── rol_permiso (PK compuesta: asignar / revocar) ───────────────────────────
export const rolPermisoRouter = Router();

/**
 * @swagger
 * /api/v1/roles-permisos:
 *   get:
 *     summary: Lista las asignaciones de permiso a rol
 *     tags: [Identidad]
 *     parameters:
 *       - { in: query, name: id_rol, schema: { type: integer }, example: 1 }
 *       - { in: query, name: id_permiso, schema: { type: integer }, example: 5 }
 *   post:
 *     summary: Asigna un permiso a un rol
 *     tags: [Identidad]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_rol, id_permiso]
 *             properties:
 *               id_rol: { type: integer, example: 1 }
 *               id_permiso: { type: integer, example: 5 }
 *   delete:
 *     summary: Revoca un permiso de un rol
 *     tags: [Identidad]
 *     parameters:
 *       - { in: path, name: id_rol, schema: { type: integer }, required: true, example: 1 }
 *       - { in: path, name: id_permiso, schema: { type: integer }, required: true, example: 5 }
 */
rolPermisoRouter.get('/', ...requireOrg, async (req: Request, res: Response) => {
  try {
    const filtros = req.query as Record<string, string>;
    let query = supabase.from('rol_permiso').select('*, permiso(nombre_permiso, modulo), roles(nombre_rol)');
    Object.keys(filtros).forEach((key) => {
      if (key !== 'limite' && key !== 'pagina') query = query.eq(key, filtros[key] as never);
    });

    const { data, error } = await query.order('id_rol', { ascending: true });
    if (error) throw new HttpError(500, `No se pudieron leer los permisos de rol: ${error.message}`);

    res.json(
      (data ?? []).map((fila: Record<string, any>) => ({
        id_rol: fila.id_rol,
        id_permiso: fila.id_permiso,
        rol: fila.roles ? rolResource.format(fila.roles) : null,
        permiso: fila.permiso ? permisoResource.format(fila.permiso) : null,
      }))
    );
  } catch (error) {
    send(res, error);
  }
});

rolPermisoRouter.post('/', ...requireOrg, requirePermission('asignar_permisos'), async (req: Request, res: Response) => {
  try {
    const payload = rolPermisoRequest.validateCreate(req.body) as { id_rol: number; id_permiso: number };
    const { error } = await supabase
      .from('rol_permiso')
      .upsert([payload], { onConflict: 'id_rol,id_permiso', ignoreDuplicates: true });
    if (error) throw new HttpError(400, `No se pudo asignar el permiso: ${error.message}`);

    res.status(201).json({ message: 'Permiso asignado correctamente', ...payload });
  } catch (error) {
    send(res, error);
  }
});

rolPermisoRouter.delete(
  '/:id_rol/:id_permiso',
  ...requireOrg,
  requirePermission('asignar_permisos'),
  async (req: Request, res: Response) => {
    try {
      const { error } = await supabase
        .from('rol_permiso')
        .delete()
        .eq('id_rol', Number(req.params.id_rol))
        .eq('id_permiso', Number(req.params.id_permiso));

      if (error) throw new HttpError(400, `No se pudo revocar el permiso: ${error.message}`);
      res.json({ message: 'Permiso revocado correctamente' });
    } catch (error) {
      send(res, error);
    }
  }
);
