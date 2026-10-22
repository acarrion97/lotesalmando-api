// requests/helpers.ts
// Utilidades compartidas por los Requests (validación Joi + payload limpio).
//
// Cada Request se declara con UN solo "shape" (los campos de la tabla) y a partir
// de ahí se generan los dos esquemas que necesita el núcleo:
//
//   create → agrega los campos obligatorios y los valores por defecto
//   update → el mismo shape sin obligatorios (PATCH parcial seguro)
//
// Los campos manejados por la base (llaves primarias y marcas de tiempo) no se
// declaran aquí: `stripUnknown` los descarta si el cliente los envía.

import Joi from 'joi';

export type SchemaShape = Record<string, Joi.Schema>;

export interface BuildSchemasOptions {
  /** Campos obligatorios al CREAR. */
  required?: string[];
  /** Valores por defecto aplicados solo al crear (nunca al actualizar). */
  defaults?: Record<string, unknown>;
}

/** Genera los esquemas create/update de un módulo. */
export function buildSchemas(
  shape: SchemaShape,
  { required = [], defaults = {} }: BuildSchemasOptions = {}
): { create: Joi.ObjectSchema; update: Joi.ObjectSchema } {
  const createShape: SchemaShape = { ...shape };

  required.forEach((key) => {
    createShape[key] = createShape[key].required();
  });

  Object.entries(defaults).forEach(([key, value]) => {
    createShape[key] = createShape[key].default(value as any);
  });

  return { create: Joi.object(createShape), update: Joi.object({ ...shape }) };
}

/** Llave primaria autoincremental. */
export const id = (): Joi.NumberSchema =>
  Joi.number().integer().positive().description('Identificador único del registro');

/** Número entero positivo usado para las foreign keys. */
export const fk = (): Joi.NumberSchema =>
  Joi.number().integer().positive().description('Identificador del registro relacionado');

/** Texto corto requerido por el negocio (nombre, código…). */
export const nombre = (min = 2, max = 255): Joi.StringSchema =>
  Joi.string().trim().min(min).max(max).description('Nombre');

/** Texto libre opcional. */
export const texto = (max = 255): Joi.StringSchema =>
  Joi.string().trim().max(max).allow(null, '').optional().description('Texto');

/** Correo electrónico normalizado a minúsculas. */
export const email = (): Joi.StringSchema =>
  Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(255)
    .description('Correo electrónico');

/** Dinero (2 decimales, no negativo). */
export const dinero = (): Joi.NumberSchema =>
  Joi.number().precision(2).min(0).description('Monto en USD');

/** Fecha en cualquier formato ISO aceptado por Postgres (date o timestamptz). */
export const fecha = () =>
  Joi.date().iso().description('Fecha (YYYY-MM-DD o timestamp ISO 8601)');

/** Estado genérico `activo | inactivo`. */
export const estadoActivo = (): Joi.StringSchema =>
  Joi.string().valid('activo', 'inactivo').description('Estado lógico del registro');
