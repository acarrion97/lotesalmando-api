// requests/inventory.request.ts
// Validaciones del módulo Inventario: proyectos, medios, mapas, etapas,
// manzanas, lotes (incl. polígono del plano) y bitácora de inventario.

import Joi from 'joi';
import { BaseRequest } from '../core';
import { buildSchemas, dinero, fk, id, nombre, texto } from './helpers';

// ── Proyecto ────────────────────────────────────────────────────────────────
const proyectoShape = {
  id_empresa: fk().description('Empresa dueña del proyecto'),
  nombre: nombre(2, 255).description('Nombre del proyecto'),
};

export const proyectoRequest = new BaseRequest(
  buildSchemas(proyectoShape, { required: ['nombre'] })
);

// ── Proyecto medio (foto/video del proyecto) ────────────────────────────────
const proyectoMedioShape = {
  id_proyecto: fk().description('Proyecto al que pertenece el medio'),
  tipo: Joi.string().valid('imagen', 'video').description('Tipo de medio'),
  url: Joi.string().uri({ allowRelative: false }).max(2000).description('URL pública del archivo (bucket medios)'),
  orden: Joi.number().integer().min(0).description('Posición en la galería; si no se envía, se calcula MAX+1'),
};

export const proyectoMedioRequest = new BaseRequest(
  buildSchemas(proyectoMedioShape, { required: ['id_proyecto', 'tipo', 'url'] })
);

// ── Mapa (plano interactivo del proyecto) ───────────────────────────────────
const mapaShape = {
  id_proyecto: fk().description('Proyecto al que pertenece el plano'),
  url_publica: Joi.string().uri().max(2000).allow(null, '').description('Imagen del plano (bucket mapas)'),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]{2,80}$/).allow(null, '').description('Enlace público corto (único)'),
};

export const mapaRequest = new BaseRequest(
  buildSchemas(mapaShape, { required: ['id_proyecto'] })
);

export const slug = (): Joi.StringSchema =>
  Joi.string().trim().lowercase().pattern(/^[a-z0-9-]{2,80}$/).description('Enlace público corto (único)');

/** Cambio de slug del mapa público. */
export const mapaSlugRequest = new BaseRequest({
  create: Joi.object({
    slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]{2,80}$/).required().description('Nuevo slug'),
  }),
});

// ── Etapa ───────────────────────────────────────────────────────────────────
const etapaShape = {
  id_proyecto: fk().description('Proyecto al que pertenece la etapa'),
  nombre: nombre(1, 255).description('Nombre de la etapa'),
  orden: Joi.number().integer().min(0).description('Orden de aparición'),
};

export const etapaRequest = new BaseRequest(
  buildSchemas(etapaShape, { required: ['id_proyecto', 'nombre'] })
);

// ── Manzana / bloque ────────────────────────────────────────────────────────
const manzanaShape = {
  id_etapa: fk().description('Etapa a la que pertenece la manzana'),
  nombre_codigo: nombre(1, 255).description('Nombre o código de la manzana (p. ej. A, B1)'),
};

export const manzanaRequest = new BaseRequest(
  buildSchemas(manzanaShape, { required: ['id_etapa'] })
);

// ── Lote ────────────────────────────────────────────────────────────────────
const puntoPlano = Joi.array()
  .items(Joi.number().min(0).max(1), Joi.number().min(0).max(1))
  .length(2)
  .description('Vértice [x, y] normalizado a 0..1 sobre el plano');

const loteShape = {
  id_manzana: fk().description('Manzana a la que pertenece el lote'),
  numero_lote: nombre(1, 100).description('Número o código del lote'),
  precio_lista: dinero().allow(null).description('Precio de lista en USD'),
  estado: Joi.string()
    .valid('disponible', 'reservado', 'vendido', 'en_negociacion', 'bloqueado', 'no_disponible')
    .description('Estado comercial del lote'),
  superficie_m2: Joi.number().precision(2).min(0).allow(null).description('Superficie en m²'),
  codigo_catastral: texto(50).description('Código catastral (único por proyecto)'),
  medidas: texto(255).description('Medidas (p. ej. "8,00 x 18,00")'),
  poligono: Joi.array().items(puntoPlano).allow(null).description('Polígono del lote sobre el plano'),
};

export const loteRequest = new BaseRequest(
  buildSchemas(loteShape, {
    required: ['id_manzana', 'numero_lote'],
    defaults: { estado: 'disponible' },
  })
);

/** Cambio de estado del lote (registra el movimiento en `inventario`). */
export const loteEstadoRequest = new BaseRequest({
  create: Joi.object({
    estado: Joi.string()
      .valid('disponible', 'reservado', 'vendido', 'en_negociacion', 'bloqueado', 'no_disponible')
      .required()
      .description('Nuevo estado del lote'),
  }),
});

/** Guardar el polígono de un lote en el plano. */
export const lotePoligonoRequest = new BaseRequest({
  create: Joi.object({
    poligono: Joi.array().items(puntoPlano).min(3).required().description('Vértices del polígono'),
  }),
});

// ── Inventario (bitácora de cambios de estado) ──────────────────────────────
const inventarioShape = {
  id_lote: fk().description('Lote afectado'),
  id_usuario: fk().description('Usuario que registró el cambio'),
  estado_anterior: nombre(1, 50).description('Estado previo del lote'),
  estado_nuevo: nombre(1, 50).description('Estado nuevo del lote'),
};

export const inventarioRequest = new BaseRequest(
  buildSchemas(inventarioShape, { required: ['id_lote', 'id_usuario', 'estado_nuevo'] })
);

export { id };
