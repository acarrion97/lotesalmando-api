// models/subscriptions/partnership.model.ts
// Tabla `partnership`: partners que patrocinan altas de empresas.
// `codigo` es único (uq_partnership_codigo) y se valida con la RPC
// `validar_codigo_partner` (upper/trim, solo estado 'activo').

export interface Partnership {
  id_partner: number;
  nombre: string;
  codigo: string;
  email?: string | null;
  estado: string;
  created_at?: string | null;
}
