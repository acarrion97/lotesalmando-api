// resources/crm.resource.ts
// Vistas de respuesta del módulo CRM: prospectos, oportunidades, actividades
// y asesores.

import { BaseResource } from '../core/base.resource';
import { ActividadView } from '../models/crm/actividad.model';
import { Asesor, AsesorView } from '../models/crm/asesor.model';
import { OportunidadView } from '../models/crm/oportunidad.model';
import { Prospecto } from '../models/crm/prospecto.model';
import { usuarioPlanoResource } from './identity.resource';
import { loteResource } from './inventory.resource';

export const prospectoResource = new BaseResource<any, Prospecto>((row) => ({
  id_prospecto: row.id_prospecto,
  id_empresa: row.id_empresa,
  id_asesor: row.id_asesor ?? null,
  nombres: row.nombres,
  email: row.email ?? null,
  telefono: row.telefono ?? null,
  origen: row.origen ?? null,
  estado: row.estado,
  notas: row.notas ?? null,
  fecha_ultimo_seguimiento: row.fecha_ultimo_seguimiento ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
}));

export const oportunidadResource = new BaseResource<any, OportunidadView>((row) => ({
  id_oportunidad: row.id_oportunidad,
  id_empresa: row.id_empresa,
  id_prospecto: row.id_prospecto,
  id_lote: row.id_lote ?? null,
  etapa: row.etapa,
  valor_estimado: row.valor_estimado,
  notas: row.notas ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
  prospecto: row.prospectos ? prospectoResource.format(row.prospectos) : null,
  lote: row.lotes ? loteResource.format(row.lotes) : null,
}));

export const actividadResource = new BaseResource<any, ActividadView>((row) => ({
  id_actividad: row.id_actividad,
  id_prospecto: row.id_prospecto,
  id_usuario: row.id_usuario ?? null,
  tipo: row.tipo,
  descripcion: row.descripcion ?? null,
  fecha_actividad: row.fecha_actividad,
  created_at: row.created_at,
  prospecto: row.prospectos ? prospectoResource.format(row.prospectos) : null,
  usuario: row.usuario ? usuarioPlanoResource.format(row.usuario) : null,
}));

export const asesorResource = new BaseResource<any, Asesor>((row) => ({
  id_asesor: row.id_asesor,
  id_empresa: row.id_empresa,
  id_usuario: row.id_usuario ?? null,
  codigo: row.codigo,
  nombre_comercial: row.nombre_comercial,
  meta_ventas_mensual: row.meta_ventas_mensual,
  estado: row.estado,
  created_at: row.created_at,
}));

export const asesorConUsuarioResource = new BaseResource<any, AsesorView>((row) => ({
  ...asesorResource.format(row),
  usuario: row.usuario ? usuarioPlanoResource.format(row.usuario) : null,
}));
