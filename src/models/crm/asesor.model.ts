// models/crm/asesor.model.ts
// Tabla `asesores`: comerciales de cada empresa. UNIQUE(id_empresa, codigo).

import { Usuario } from '../identity/usuario.model';

export type AsesorEstado = 'activo' | 'inactivo';

export interface Asesor {
  id_asesor: number;
  id_empresa: number;
  /** Vincula al asesor con su cuenta de usuario (nullable). */
  id_usuario?: number | null;
  codigo: string;
  nombre_comercial: string;
  meta_ventas_mensual: number | null;
  estado: AsesorEstado;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: el asesor con su usuario incrustado. */
export interface AsesorView extends Asesor {
  usuario: Usuario | null;
}
