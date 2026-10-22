// models/sales/entrada_reserva.model.ts
// Tabla `entradas_reserva`: dinero recibido para apartar un lote antes de la
// venta. `id_empresa` está denormalizado (nullable) para el filtrado por
// tenant; CHECK monto > 0.

import { Lote } from '../inventory/lote.model';
import { Prospecto } from '../crm/prospecto.model';
import { Usuario } from '../identity/usuario.model';

export interface EntradaReserva {
  id_entrada: number;
  id_lote: number;
  id_prospecto?: number | null;
  id_empresa?: number | null;
  id_usuario: number;
  monto: number;
  fecha_pago: string;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: la entrada con lote, prospecto y usuario incrustados. */
export interface EntradaReservaView extends EntradaReserva {
  lote: Lote | null;
  /** Vista parcial del prospecto incrustado. */
  prospecto: Pick<Prospecto, 'id_prospecto' | 'nombres' | 'estado'> | null;
  usuario: Usuario | null;
}
