// models/crm/actividad.model.ts
// Tabla `actividades`: seguimientos realizados a un prospecto
// (llamada, visita, whatsapp, correo…).

import { Prospecto } from './prospecto.model';
import { Usuario } from '../identity/usuario.model';

export interface Actividad {
  id_actividad: number;
  id_prospecto: number;
  id_usuario?: number | null;
  tipo: string;
  descripcion?: string | null;
  fecha_actividad?: string | null;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: la actividad con prospecto y usuario incrustados. */
export interface ActividadView extends Actividad {
  prospecto: Prospecto | null;
  usuario: Usuario | null;
}
