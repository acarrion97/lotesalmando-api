// models/inventory/inventario.model.ts
// Tabla `inventario`: bitácora de cambios de estado de los lotes
// (estado_anterior → estado_nuevo), con el usuario que lo realizó.

import { Lote } from './lote.model';
import { Usuario } from '../identity/usuario.model';

export interface Inventario {
  id_inventario: number;
  id_lote: number;
  id_usuario: number;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: el movimiento con lote y usuario incrustados. */
export interface InventarioView extends Inventario {
  lote: Lote | null;
  usuario: Usuario | null;
}
