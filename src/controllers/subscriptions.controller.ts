// controllers/subscriptions.controller.ts
// CRUD del módulo Suscripciones: planes de la plataforma y partnerships.
//
// Son catálogos GLOBALES (no tenant-scoped): cualquier usuario autenticado
// puede leerlos; la escritura exige los permisos del módulo. Los límites de
// plan (max_proyectos / max_lotes_por_proyecto / max_usuarios) los aplican los
// triggers de la migración 028 directamente en la BD.

import { createCrudRouter } from '../core/crud.factory';
import { planRequest, partnershipRequest } from '../requests/subscriptions.request';
import { planResource, partnershipResource } from '../resources/subscriptions.resource';
import { requireOrg } from '../middlewares/sessionAuth';
import { requirePermission } from '../middlewares/requirePermission';

// ── Planes ──────────────────────────────────────────────────────────────────
export const { router: planRouter } = createCrudRouter({
  table: 'plan',
  primaryKey: 'id_plan',
  request: planRequest,
  resource: planResource,
  entityName: 'Plan',
  middlewares: [...requireOrg],
  writeMiddlewares: [requirePermission('crear_planes')],
  defaultGetAllOptions: { orderBy: 'orden', ascending: true },
});

// ── Partnerships ────────────────────────────────────────────────────────────
export const { router: partnershipRouter } = createCrudRouter({
  table: 'partnership',
  primaryKey: 'id_partner',
  request: partnershipRequest,
  resource: partnershipResource,
  entityName: 'Partner',
  middlewares: [...requireOrg],
  writeMiddlewares: [requirePermission('crear_partnerships')],
  defaultGetAllOptions: { orderBy: 'id_partner', ascending: false },
});
