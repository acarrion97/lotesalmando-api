// models/sales/contrato.model.ts
// Tabla `contratos`: UN contrato por venta (UNIQUE id_venta).
// El tenant se deriva: contratos → ventas → lotes → … → proyectos.

import { Venta } from './venta.model';

export interface Contrato {
  id_contrato: number;
  id_venta: number;
  numero_contrato: string;
  monto_total: number;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: el contrato con su venta incrustada. */
export interface ContratoView extends Contrato {
  venta: Venta | null;
}
