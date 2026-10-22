// requests/identity.request.ts
// Validaciones del módulo Identidad: empresa, configuración, usuarios, roles,
// permisos y las dos tablas de unión del RBAC.

import Joi from 'joi';
import { BaseRequest } from '../core';
import { buildSchemas, dinero, email, estadoActivo, fecha, fk, id, nombre, texto } from './helpers';

// ── Empresa (tenant raíz) ───────────────────────────────────────────────────
const empresaShape = {
  razon_social: Joi.string().trim().min(2).max(255).description('Razón social de la empresa'),
  ruc: Joi.string().trim().pattern(/^\d{13}$|$/).allow(null, '').description('RUC de 13 dígitos (opcional)'),
  estado: Joi.string().max(50).description('Estado de la empresa (activo/inactivo)'),
  plan: Joi.string().max(50).allow(null, '').description('Clave del plan contratado (basico/inicial/avanzado)'),
  id_partner: fk().allow(null).description('Partner que patrocinó el alta'),
  estado_pago: Joi.string()
    .valid('pendiente', 'pagado', 'cancelado')
    .allow(null)
    .description('Estado de la suscripción Hotmart (lo escribe el webhook)'),
};

export const empresaRequest = new BaseRequest(
  buildSchemas(empresaShape, {
    required: ['razon_social'],
    defaults: { estado: 'activo' },
  })
);

// ── Configuración (1:1 por empresa) ─────────────────────────────────────────
const configuracionShape = {
  id_empresa: fk().description('Empresa dueña de la configuración'),
  moneda: Joi.string().trim().max(10).allow(null, '').description('Moneda (p. ej. USD)'),
  idioma: Joi.string().trim().max(10).allow(null, '').description('Idioma (p. ej. es)'),
};

export const configuracionRequest = new BaseRequest(
  buildSchemas(configuracionShape, { required: ['id_empresa'] })
);

// ── Usuario ─────────────────────────────────────────────────────────────────
const usuarioShape = {
  id_empresa: fk().description('Empresa a la que pertenece el usuario'),
  nombres: Joi.string().trim().min(2).max(255).description('Nombres completos del usuario'),
  email: email().description('Correo vinculado con Supabase Auth'),
  estado: estadoActivo().description('Estado de la cuenta'),
  password_temporal_hasta: fecha().allow(null).description('Vigencia de la contraseña temporal'),
};

export const usuarioRequest = new BaseRequest(
  buildSchemas(usuarioShape, {
    required: ['id_empresa', 'nombres', 'email'],
    defaults: { estado: 'activo' },
  })
);

/** Alta de usuario con cuenta de acceso (réplica de la RPC crear_usuario_auth). */
export const usuarioAccesoRequest = new BaseRequest({
  create: Joi.object({
    nombres: Joi.string().trim().min(2).max(255).required().description('Nombres completos'),
    email: email().required().description('Correo de acceso'),
    password: Joi.string().min(6).max(72).required().description('Contraseña (mínimo 6 caracteres)'),
    id_empresa: fk().description('Empresa; por defecto, la de la sesión'),
    roles: Joi.array().items(id()).min(1).description('Roles a asignar; por defecto, Vendedor'),
  }),
});

// ── Rol / Permiso (catálogos globales editables) ────────────────────────────
const rolShape = {
  nombre_rol: nombre(2, 100).description('Nombre del rol (Administrador, Vendedor, Gerente…)'),
};

export const rolRequest = new BaseRequest(buildSchemas(rolShape, { required: ['nombre_rol'] }));

const permisoShape = {
  nombre_permiso: nombre(2, 150).description('Nombre del permiso (convención <accion>_<recurso>)'),
  modulo: texto(100).description('Módulo al que pertenece el permiso'),
};

export const permisoRequest = new BaseRequest(
  buildSchemas(permisoShape, { required: ['nombre_permiso'] })
);

// ── Uniones del RBAC (PK compuesta: se asignan/revocan, no se editan) ───────
export const usuarioRolRequest = new BaseRequest({
  create: Joi.object({
    id_usuario: fk().required().description('Usuario al que se asigna el rol'),
    id_rol: fk().required().description('Rol asignado'),
  }),
});

export const rolPermisoRequest = new BaseRequest({
  create: Joi.object({
    id_rol: fk().required().description('Rol al que se asigna el permiso'),
    id_permiso: fk().required().description('Permiso asignado'),
  }),
});

// ── Asignación de roles a un usuario (detalle operativo) ────────────────────
export const asignarRolesRequest = new BaseRequest({
  create: Joi.object({
    roles: Joi.array().items(id()).min(1).required().description('Roles a asignar'),
  }),
});

/** Dinero re-exportado para los controllers que lo necesitan. */
export { dinero };
