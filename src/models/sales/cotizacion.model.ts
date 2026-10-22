// models/sales/cotizacion.model.ts
// Tabla `cotizador`: presupuestos de venta por lote. Al ACEPTAR una cotización
// la RPC `aceptar_cotizacion` crea la venta, marca el lote vendido, genera el
// contrato y las cuotas (cobranzas) en una sola transacción.
//
// Ojo: existe un constraint diferido (migración 012) que impide que una
// cotización quede en estado 'aceptada' sin una venta asociada.

import { Cliente } from './cliente.model';
import { Lote } from '../inventory/lote.model';
import { Asesor } from '../crm/asesor.model';

export type CotizacionEstado = 'pendiente' | 'aceptada' | 'rechazada';

export interface Cotizacion {
  id_cotizacion: number;
  id_cliente: number;
  id_lote: number;
  precio_ofertado: number;
  /** DEFAULT 'pendiente' (la columna real de la BD). */
  estado: CotizacionEstado;
  id_asesor?: number | null;
  /** Entrada (enganche); CHECK >= 0. */
  monto_entrada: number;
  /** Número de cuotas; CHECK >= 1. */
  num_cuotas: number;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: la cotización con cliente, lote y asesor incrustados. */
export interface CotizacionView extends Cotizacion {
  cliente: Cliente | null;
  lote: Lote | null;
  asesor: Asesor | null;
}
