// models/crm/prospecto.model.ts
// Tabla `prospectos`: personas captadas (CRM), propias de cada empresa.

export type ProspectoEstado =
  | 'nuevo'
  | 'contactado'
  | 'interesado'
  | 'negociacion'
  | 'reserva'
  | 'perdido';

export interface Prospecto {
  id_prospecto: number;
  id_empresa: number;
  /** Sin FK declarada en la migración 003 (se asigna a mano). */
  id_asesor?: number | null;
  nombres: string;
  email?: string | null;
  telefono?: string | null;
  origen: string | null;
  estado: ProspectoEstado;
  notas?: string | null;
  fecha_ultimo_seguimiento?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
