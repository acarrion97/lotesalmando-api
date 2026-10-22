// resources/sales.resource.ts
// Vistas de respuesta del módulo Comercial: clientes, cotizaciones, ventas,
// contratos, cobranzas, pagos y entradas de reserva.

import { BaseResource } from '../core/base.resource';
import { Cliente } from '../models/sales/cliente.model';
import { CobranzaView } from '../models/sales/cobranza.model';
import { ContratoView } from '../models/sales/contrato.model';
import { CotizacionView } from '../models/sales/cotizacion.model';
import { EntradaReservaView } from '../models/sales/entrada_reserva.model';
import { PagoView } from '../models/sales/pago.model';
import { VentaView } from '../models/sales/venta.model';
import { asesorResource } from './crm.resource';
import { usuarioPlanoResource } from './identity.resource';
import { loteResource } from './inventory.resource';

export const clienteResource = new BaseResource<any, Cliente>((row) => ({
  id_cliente: row.id_cliente,
  id_empresa: row.id_empresa ?? null,
  nombres: row.nombres,
  cedula_ruc: row.cedula_ruc ?? null,
  email: row.email ?? null,
  telefono: row.telefono ?? null,
  created_at: row.created_at,
}));

export const cotizacionResource = new BaseResource<any, CotizacionView>((row) => ({
  id_cotizacion: row.id_cotizacion,
  id_cliente: row.id_cliente,
  id_lote: row.id_lote,
  precio_ofertado: row.precio_ofertado,
  estado: row.estado,
  id_asesor: row.id_asesor ?? null,
  monto_entrada: row.monto_entrada,
  num_cuotas: row.num_cuotas,
  created_at: row.created_at,
  cliente: row.cliente ? clienteResource.format(row.cliente) : null,
  lote: row.lotes ? loteResource.format(row.lotes) : null,
  asesor: row.asesores ? asesorResource.format(row.asesores) : null,
}));

export const ventaResource = new BaseResource<any, VentaView>((row) => ({
  id_venta: row.id_venta,
  id_cliente: row.id_cliente,
  id_lote: row.id_lote,
  id_cotizacion: row.id_cotizacion ?? null,
  id_usuario: row.id_usuario,
  precio_final: row.precio_final,
  estado: row.estado,
  id_asesor: row.id_asesor ?? null,
  created_at: row.created_at,
  cliente: row.cliente ? clienteResource.format(row.cliente) : null,
  lote: row.lotes ? loteResource.format(row.lotes) : null,
  usuario: row.usuario ? usuarioPlanoResource.format(row.usuario) : null,
  asesor: row.asesores ? asesorResource.format(row.asesores) : null,
}));

export const contratoResource = new BaseResource<any, ContratoView>((row) => ({
  id_contrato: row.id_contrato,
  id_venta: row.id_venta,
  numero_contrato: row.numero_contrato,
  monto_total: row.monto_total,
  created_at: row.created_at,
  venta: row.ventas ? ventaResource.format(row.ventas) : null,
}));

export const cobranzaResource = new BaseResource<any, CobranzaView>((row) => ({
  id_cobranza: row.id_cobranza,
  id_contrato: row.id_contrato,
  numero_cuota: row.numero_cuota,
  monto_cuota: row.monto_cuota,
  estado: row.estado,
  fecha_vencimiento: row.fecha_vencimiento,
  created_at: row.created_at,
  contrato: row.contratos ? contratoResource.format(row.contratos) : null,
}));

export const pagoResource = new BaseResource<any, PagoView>((row) => ({
  id_pago: row.id_pago,
  id_cobranza: row.id_cobranza,
  id_usuario: row.id_usuario,
  monto_pagado: row.monto_pagado,
  fecha_pago: row.fecha_pago,
  created_at: row.created_at,
  cobranza: row.cobranzas ? cobranzaResource.format(row.cobranzas) : null,
  usuario: row.usuario ? usuarioPlanoResource.format(row.usuario) : null,
}));

export const entradaReservaResource = new BaseResource<any, EntradaReservaView>((row) => ({
  id_entrada: row.id_entrada,
  id_lote: row.id_lote,
  id_prospecto: row.id_prospecto ?? null,
  id_empresa: row.id_empresa ?? null,
  id_usuario: row.id_usuario,
  monto: row.monto,
  fecha_pago: row.fecha_pago,
  created_at: row.created_at,
  lote: row.lotes ? loteResource.format(row.lotes) : null,
  prospecto: row.prospectos
    ? { id_prospecto: row.prospectos.id_prospecto, nombres: row.prospectos.nombres, estado: row.prospectos.estado }
    : null,
  usuario: row.usuario ? usuarioPlanoResource.format(row.usuario) : null,
}));
