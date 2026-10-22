// controllers/crm.controller.ts
// CRUD del módulo CRM: prospectos, oportunidades (pipeline), actividades
// (seguimiento) y asesores.
//
// prospectos / oportunidades / asesores tienen `id_empresa` directo;
// actividades se acota por la cadena `prospectos!inner(id_empresa)`.
//
// RBAC aplicado: crear_/editar_/eliminar_prospectos y crear_/editar_asesores.

import { Request, Response } from 'express';
import supabase from '../config/supabaseClient';
import { BaseController } from '../core/base.controller';
import { createCrudRouter } from '../core/crud.factory';
import { HttpError } from '../core/errors';
import {
  actividadRequest,
  asesorRequest,
  oportunidadRequest,
  prospectoRequest,
} from '../requests/crm.request';
import {
  actividadResource,
  asesorConUsuarioResource,
  oportunidadResource,
  prospectoResource,
} from '../resources/crm.resource';
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

// ── Prospectos ──────────────────────────────────────────────────────────────
export const { router: prospectoRouter } = createCrudRouter({
  table: 'prospectos',
  primaryKey: 'id_prospecto',
  request: prospectoRequest,
  resource: prospectoResource,
  entityName: 'Prospecto',
  middlewares: [...requireOrg, filterByEmpresa],
  writeMiddlewares: [requirePermission('crear_prospectos'), assignEmpresaOnCreate],
  tenantPath: 'id_empresa',
  defaultGetAllOptions: { orderBy: 'id_prospecto', ascending: false },
});

// ── Oportunidades ───────────────────────────────────────────────────────────
export const { router: oportunidadRouter } = createCrudRouter({
  table: 'oportunidades',
  primaryKey: 'id_oportunidad',
  joins: ['prospectos(nombres,email,estado)', 'lotes(numero_lote,estado)'],
  request: oportunidadRequest,
  resource: oportunidadResource,
  entityName: 'Oportunidad',
  middlewares: [...requireOrg, filterByEmpresa],
  writeMiddlewares: [requirePermission('editar_prospectos'), assignEmpresaOnCreate],
  tenantPath: 'id_empresa',
  defaultGetAllOptions: { orderBy: 'id_oportunidad', ascending: false },
});

// ── Actividades ─────────────────────────────────────────────────────────────
export const { router: actividadRouter } = createCrudRouter({
  table: 'actividades',
  primaryKey: 'id_actividad',
  joins: ['prospectos!inner(nombres,id_empresa)', 'usuario(nombres,email)'],
  request: actividadRequest,
  resource: actividadResource,
  entityName: 'Actividad',
  middlewares: [...requireOrg, filterByEmpresaChain('prospectos.id_empresa')],
  writeMiddlewares: [requirePermission('crear_prospectos')],
  tenantPath: 'prospectos.id_empresa',
  // El autor por defecto es el usuario de la sesión.
  handlers: {
    create: async (req: Request, res: Response) => {
      try {
        const payload = actividadRequest.validateCreate(req.body) as Record<string, unknown>;

        // Guardia de tenant: el prospecto debe pertenecer a la empresa activa.
        const { data: prospecto } = await supabase
          .from('prospectos')
          .select('id_empresa')
          .eq('id_prospecto', payload.id_prospecto as number)
          .maybeSingle();
        if (!prospecto || String((prospecto as { id_empresa: number }).id_empresa) !== req.organizationId) {
          res.status(404).json({ message: 'Prospecto no encontrado' });
          return;
        }

        if (payload.id_usuario === undefined) payload.id_usuario = req.localUsuarioId ?? null;

        const { data, error } = await supabase
          .from('actividades')
          .insert([payload])
          .select('*')
          .single();
        if (error) throw new HttpError(400, `No se pudo registrar la actividad: ${error.message}`);
        res.status(201).json(actividadResource.format(data));
      } catch (error) {
        send(res, error);
      }
    },
  },
  defaultGetAllOptions: { orderBy: 'fecha_actividad', ascending: false },
});

// ── Asesores ────────────────────────────────────────────────────────────────
export const { router: asesorRouter } = createCrudRouter({
  table: 'asesores',
  primaryKey: 'id_asesor',
  joins: ['usuario(nombres,email)'],
  request: asesorRequest,
  resource: asesorConUsuarioResource,
  entityName: 'Asesor',
  middlewares: [...requireOrg, filterByEmpresa],
  writeMiddlewares: [requirePermission('crear_asesores'), assignEmpresaOnCreate],
  tenantPath: 'id_empresa',
  defaultGetAllOptions: { orderBy: 'id_asesor', ascending: false },
});
