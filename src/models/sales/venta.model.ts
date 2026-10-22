// models/sales/venta.model.ts
// Tabla `ventas`: una venta por cotización (índice único uq_ventas_cotizacion).
// El tenant se deriva por la cadena: lotes → manzana_bloque → etapas → proyectos.

import { Cliente } from './cliente.model';
import { Lote } from '../inventory/lote.model';
import { Usuario } from '../identity/usuario.model';
import { Asesor } from '../crm/asesor.model';

export type VentaEstado = 'pendiente' | 'completada' | 'cancelada';

export interface Venta {
  id_venta: number;
  id_cliente: number;
  id_lote: number;
  id_cotizacion?: number | null;
  id_usuario: number;
  precio_final: number;
  estado: VentaEstado;
  id_asesor?: number | null;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: la venta con sus FK incrustadas. */
export interface VentaView extends Venta {
  cliente: Cliente | null;
  lote: Lote | null;
  usuario: Usuario | null;
  asesor: Asesor | null;
}
