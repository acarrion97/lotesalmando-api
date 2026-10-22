// models/sales/cobranza.model.ts
// Tabla `cobranzas`: cuotas del contrato. Las genera la RPC
// `aceptar_cotizacion` con la fórmula sin interés:
//   cuota_base = ceil(financiado / num_cuotas); la última absorbe el redondeo.
// `fecha_vencimiento` = fecha_base + i meses (i = 1..n).

import { Contrato } from './contrato.model';

export type CobranzaEstado = 'pendiente' | 'pagada' | 'vencida';

export interface Cobranza {
  id_cobranza: number;
  id_contrato: number;
  numero_cuota: number;
  monto_cuota: number;
  estado: CobranzaEstado;
  fecha_vencimiento: string;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: la cuota con su contrato incrustado. */
export interface CobranzaView extends Cobranza {
  contrato: Contrato | null;
}
