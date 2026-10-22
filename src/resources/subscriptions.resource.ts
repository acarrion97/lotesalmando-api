// resources/subscriptions.resource.ts
// Vistas de respuesta del módulo Suscripciones: planes y partnerships.

import { BaseResource } from '../core/base.resource';
import { Partnership } from '../models/subscriptions/partnership.model';
import { Plan } from '../models/subscriptions/plan.model';

export const planResource = new BaseResource<any, Plan>((row) => ({
  id_plan: row.id_plan,
  clave: row.clave,
  nombre: row.nombre,
  descripcion: row.descripcion ?? null,
  imagen_url: row.imagen_url ?? null,
  url_checkout: row.url_checkout ?? null,
  precio: row.precio ?? null,
  orden: row.orden,
  activo: row.activo,
  max_proyectos: row.max_proyectos ?? null,
  max_lotes_por_proyecto: row.max_lotes_por_proyecto ?? null,
  max_usuarios: row.max_usuarios ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at ?? null,
}));

export const partnershipResource = new BaseResource<any, Partnership>((row) => ({
  id_partner: row.id_partner,
  nombre: row.nombre,
  codigo: row.codigo,
  email: row.email ?? null,
  estado: row.estado,
  created_at: row.created_at,
}));
