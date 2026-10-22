// requests/sales.request.ts
// Validaciones del módulo Comercial: clientes, cotizaciones, ventas,
// contratos, cobranzas, pagos y entradas de reserva.

import Joi from 'joi';
import { BaseRequest } from '../core';
import { buildSchemas, dinero, email, fecha, fk, id, nombre, texto } from './helpers';

// ── Cliente ─────────────────────────────────────────────────────────────────
const clienteShape = {
  id_empresa: fk().allow(null).description('Empresa del cliente (nullable: clientes heredados)'),
  nombres: nombre(2, 255).description('Nombre del cliente'),
  cedula_ruc: Joi.string().trim().pattern(/^\d{10}$|^\d{13}$|$/).allow(null, '').description('Cédula (10) o RUC (13)'),
  email: email().allow(null, '').description('Correo del cliente'),
  telefono: texto(50).description('Teléfono del cliente'),
};

export const clienteRequest = new BaseRequest(
  buildSchemas(clienteShape, { required: ['nombres'] })
);

// ── Cotización (tabla `cotizador`) ──────────────────────────────────────────
const cotizacionShape = {
  id_cliente: fk().description('Cliente que recibe la cotización'),
  id_lote: fk().description('Lote cotizado'),
  precio_ofertado: dinero().description('Precio ofertado en USD'),
  estado: Joi.string()
    .valid('pendiente', 'aceptada', 'rechazada')
    .description('Estado de la cotización'),
  id_asesor: fk().allow(null).description('Asesor que gestiona la cotización'),
  monto_entrada: dinero().description('Entrala/enganche (debe ser menor al precio ofertado)'),
  num_cuotas: Joi.number().integer().min(1).max(600).description('Número de cuotas (mínimo 1)'),
};

export const cotizacionRequest = new BaseRequest(
  buildSchemas(cotizacionShape, {
    required: ['id_cliente', 'id_lote', 'precio_ofertado'],
    defaults: { estado: 'pendiente', monto_entrada: 0, num_cuotas: 12 },
  })
);

// ── Venta ───────────────────────────────────────────────────────────────────
const ventaShape = {
  id_cliente: fk().description('Cliente comprador'),
  id_lote: fk().description('Lote vendido'),
  id_cotizacion: fk().allow(null).description('Cotización aceptada (única por venta)'),
  id_usuario: fk().description('Usuario que registra la venta'),
  precio_final: dinero().description('Precio final de la venta'),
  estado: Joi.string().valid('pendiente', 'completada', 'cancelada').description('Estado de la venta'),
  id_asesor: fk().allow(null).description('Asesor de la venta'),
};

export const ventaRequest = new BaseRequest(
  buildSchemas(ventaShape, {
    required: ['id_cliente', 'id_lote', 'id_usuario', 'precio_final'],
    defaults: { estado: 'pendiente' },
  })
);

// ── Contrato ────────────────────────────────────────────────────────────────
const contratoShape = {
  id_venta: fk().description('Venta asociada (única por contrato)'),
  numero_contrato: nombre(1, 100).description('Número de contrato'),
  monto_total: dinero().description('Monto total del contrato'),
};

export const contratoRequest = new BaseRequest(
  buildSchemas(contratoShape, { required: ['id_venta', 'numero_contrato', 'monto_total'] })
);

// ── Cobranza (cuota) ────────────────────────────────────────────────────────
const cobranzaShape = {
  id_contrato: fk().description('Contrato de la cuota'),
  numero_cuota: Joi.number().integer().min(1).description('Número de cuota (1..n)'),
  monto_cuota: dinero().description('Monto de la cuota'),
  estado: Joi.string().valid('pendiente', 'pagada', 'vencida').description('Estado de la cuota'),
  fecha_vencimiento: fecha().description('Fecha de vencimiento'),
};

export const cobranzaRequest = new BaseRequest(
  buildSchemas(cobranzaShape, {
    required: ['id_contrato', 'numero_cuota', 'monto_cuota', 'fecha_vencimiento'],
    defaults: { estado: 'pendiente' },
  })
);

/** Cambio de estado de una cuota (marcar pagada/vencida). */
export const cobranzaEstadoRequest = new BaseRequest({
  create: Joi.object({
    estado: Joi.string().valid('pendiente', 'pagada', 'vencida').required().description('Nuevo estado'),
  }),
});

// ── Pago ────────────────────────────────────────────────────────────────────
const pagoShape = {
  id_cobranza: fk().description('Cuota pagada'),
  id_usuario: fk().description('Usuario que registra el pago'),
  monto_pagado: dinero().description('Monto pagado en USD'),
  fecha_pago: fecha().description('Fecha del pago; por defecto, hoy'),
};

export const pagoRequest = new BaseRequest(
  buildSchemas(pagoShape, { required: ['id_cobranza', 'id_usuario', 'monto_pagado'] })
);

// ── Entrada de reserva ──────────────────────────────────────────────────────
const entradaReservaShape = {
  id_lote: fk().description('Lote reservado'),
  id_prospecto: fk().allow(null).description('Prospecto que reserva'),
  id_empresa: fk().allow(null).description('Empresa (denormalizado para el filtrado)'),
  id_usuario: fk().description('Usuario que registra la entrada'),
  monto: Joi.number().precision(2).min(0.01).description('Monto de la entrada (debe ser mayor a 0)'),
  fecha_pago: fecha().description('Fecha del pago; por defecto, hoy'),
};

export const entradaReservaRequest = new BaseRequest(
  buildSchemas(entradaReservaShape, {
    required: ['id_lote', 'id_usuario', 'monto'],
  })
);

export { id };
