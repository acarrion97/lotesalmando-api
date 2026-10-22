// requests/crm.request.ts
// Validaciones del módulo CRM: prospectos, oportunidades, actividades y
// asesores.

import Joi from 'joi';
import { BaseRequest } from '../core';
import { buildSchemas, dinero, email, fecha, fk, id, nombre, texto } from './helpers';

// ── Prospecto ───────────────────────────────────────────────────────────────
const prospectoShape = {
  id_empresa: fk().description('Empresa dueña del prospecto'),
  id_asesor: fk().allow(null).description('Asesor asignado'),
  nombres: nombre(2, 255).description('Nombre del prospecto'),
  email: email().allow(null, '').description('Correo del prospecto'),
  telefono: texto(50).description('Teléfono / WhatsApp'),
  origen: texto(100).description('Canal de captación (directo, mapa, referral…)'),
  estado: Joi.string()
    .valid('nuevo', 'contactado', 'interesado', 'negociacion', 'reserva', 'perdido')
    .description('Estado en el pipeline'),
  notas: Joi.string().trim().max(5000).allow(null, '').description('Notas de seguimiento'),
  fecha_ultimo_seguimiento: fecha().allow(null).description('Último contacto registrado'),
};

export const prospectoRequest = new BaseRequest(
  buildSchemas(prospectoShape, {
    required: ['nombres'],
    defaults: { origen: 'directo', estado: 'nuevo' },
  })
);

// ── Oportunidad ─────────────────────────────────────────────────────────────
const oportunidadShape = {
  id_empresa: fk().description('Empresa dueña de la oportunidad'),
  id_prospecto: fk().description('Prospecto de la oportunidad'),
  id_lote: fk().allow(null).description('Lote de interés (opcional)'),
  etapa: Joi.string()
    .valid('contactado', 'interesado', 'negociacion', 'reserva', 'perdido')
    .description('Etapa del pipeline'),
  valor_estimado: dinero().allow(null).description('Valor estimado de la operación'),
  notas: Joi.string().trim().max(5000).allow(null, '').description('Notas'),
};

export const oportunidadRequest = new BaseRequest(
  buildSchemas(oportunidadShape, {
    required: ['id_prospecto'],
    defaults: { etapa: 'contactado' },
  })
);

// ── Actividad ───────────────────────────────────────────────────────────────
const actividadShape = {
  id_prospecto: fk().description('Prospecto atendido'),
  id_usuario: fk().allow(null).description('Usuario que registró la actividad'),
  tipo: nombre(1, 50).description('Tipo de actividad (llamada, visita, whatsapp…)'),
  descripcion: Joi.string().trim().max(2000).allow(null, '').description('Detalle de la actividad'),
  fecha_actividad: fecha().description('Fecha de la actividad; por defecto, ahora'),
};

export const actividadRequest = new BaseRequest(
  buildSchemas(actividadShape, { required: ['id_prospecto', 'tipo'] })
);

// ── Asesor ──────────────────────────────────────────────────────────────────
const asesorShape = {
  id_empresa: fk().description('Empresa del asesor'),
  id_usuario: fk().allow(null).description('Cuenta de usuario vinculada'),
  codigo: nombre(1, 50).description('Código comercial (único por empresa)'),
  nombre_comercial: nombre(2, 255).description('Nombre comercial del asesor'),
  meta_ventas_mensual: dinero().description('Meta de ventas mensual en USD'),
  estado: Joi.string().valid('activo', 'inactivo').description('Estado del asesor'),
};

export const asesorRequest = new BaseRequest(
  buildSchemas(asesorShape, {
    required: ['codigo', 'nombre_comercial'],
    defaults: { meta_ventas_mensual: 0, estado: 'activo' },
  })
);

export { id };
