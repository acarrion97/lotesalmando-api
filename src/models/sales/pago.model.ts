// models/sales/pago.model.ts
// Tabla `pagos`: abonos contra una cuota (cobranza), registrados por un
// usuario de la empresa. El tenant se deriva por la cadena de FK.

import { Cobranza } from './cobranza.model';
import { Usuario } from '../identity/usuario.model';

export interface Pago {
  id_pago: number;
  id_cobranza: number;
  id_usuario: number;
  monto_pagado: number;
  fecha_pago: string;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: el pago con cuota y usuario incrustados. */
export interface PagoView extends Pago {
  cobranza: Cobranza | null;
  usuario: Usuario | null;
}
