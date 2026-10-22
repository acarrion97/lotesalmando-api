// models/identity/empresa.model.ts
// Tabla `empresa`: el TENANT raíz del esquema.
//
// Además de los campos del frontend, la BD tiene las columnas de control de
// pago de la suscripción (migración 031) que actualiza el webhook de Hotmart:
// estado_pago, pagado_en y transaccion_id.

export type EmpresaEstadoPago = 'pendiente' | 'pagado' | 'cancelado';

export interface Empresa {
  id_empresa: number;
  razon_social: string;
  ruc: string | null;
  estado: string;
  created_at?: string | null;
  /** Clave del plan contratado (FK lógica → plan.clave). */
  plan?: string | null;
  /** Partner que patrocinó el alta (FK → partnership). */
  id_partner?: number | null;
  /** Estado de la suscripción Hotmart; lo escribe el webhook (null = nunca pagó). */
  estado_pago?: EmpresaEstadoPago | null;
  pagado_en?: string | null;
  transaccion_id?: string | null;
}
