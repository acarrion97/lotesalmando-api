// requests/subscriptions.request.ts
// Validaciones del módulo Suscripciones: planes de la plataforma y partners.

import Joi from 'joi';
import { BaseRequest } from '../core';
import { buildSchemas, dinero, email, nombre, texto } from './helpers';

// ── Plan ────────────────────────────────────────────────────────────────────
const planShape = {
  clave: nombre(2, 50).description('Clave única del plan (basico, inicial, avanzado)'),
  nombre: nombre(2, 150).description('Nombre visible del plan'),
  descripcion: Joi.string().trim().max(2000).allow(null, '').description('Descripción del plan'),
  imagen_url: Joi.string().uri().allow(null, '').description('Imagen del plan (bucket planes)'),
  url_checkout: Joi.string().uri().allow(null, '').description('Link de checkout Hotmart'),
  precio: dinero().allow(null).description('USD mensual; NULL = no se muestra públicamente'),
  orden: Joi.number().integer().min(0).description('Orden de aparición'),
  activo: Joi.boolean().description('Si el plan admite nuevas suscripciones'),
  max_proyectos: Joi.number().integer().min(0).allow(null).description('Límite de proyectos (NULL = sin límite)'),
  max_lotes_por_proyecto: Joi.number().integer().min(0).allow(null).description('Límite de lotes por proyecto'),
  max_usuarios: Joi.number().integer().min(0).allow(null).description('Límite de usuarios'),
};

export const planRequest = new BaseRequest(
  buildSchemas(planShape, {
    required: ['clave', 'nombre'],
    defaults: { orden: 0, activo: true },
  })
);

// ── Partnership ─────────────────────────────────────────────────────────────
const partnershipShape = {
  nombre: nombre(2, 150).description('Nombre del partner'),
  codigo: Joi.string().trim().uppercase().min(2).max(50).description('Código único del partner'),
  email: email().allow(null, '').description('Correo de contacto'),
  estado: nombre(1, 50).description('Estado (activo/inactivo)'),
};

export const partnershipRequest = new BaseRequest(
  buildSchemas(partnershipShape, {
    required: ['nombre', 'codigo'],
    defaults: { estado: 'activo' },
  })
);

/** Validación de código de partner (usado en el registro público). */
export const codigoPartnerRequest = new BaseRequest({
  create: Joi.object({
    codigo_partner: Joi.string().trim().uppercase().min(2).max(50).required().description('Código de partner'),
  }),
});

export { texto };
