// models/identity/usuario.model.ts
// Tabla `usuario`: usuarios locales de cada empresa, vinculados por EMAIL con
// Supabase Auth. UNIQUE(id_empresa, email).

import { Empresa } from './empresa.model';

export type UsuarioEstado = 'activo' | 'inactivo';

export interface Usuario {
  id_usuario: number;
  id_empresa: number;
  nombres: string;
  email: string;
  estado: UsuarioEstado;
  /** Si tiene valor, la contraseña actual es temporal hasta esa fecha. */
  password_temporal_hasta?: string | null;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: el usuario con su empresa incrustada. */
export interface UsuarioView extends Usuario {
  /** Relación incrustada (FK → empresa). */
  empresa: Empresa | null;
}
