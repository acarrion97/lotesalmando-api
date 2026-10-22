// models/subscriptions/plan.model.ts
// Tabla `plan`: planes de suscripción de la plataforma. La clave (`clave`) es
// la que referencia `empresa.plan` (FK lógica). Los límites (max_proyectos,
// max_lotes_por_proyecto, max_usuarios) los aplican los triggers 028.

export interface Plan {
  id_plan: number;
  clave: string;
  nombre: string;
  descripcion?: string | null;
  /** Imagen en el bucket `planes`. */
  imagen_url?: string | null;
  /** Link de checkout Hotmart. */
  url_checkout?: string | null;
  /** USD mensual; NULL = el plan no se muestra públicamente. */
  precio?: number | null;
  orden: number;
  activo: boolean;
  max_proyectos?: number | null;
  max_lotes_por_proyecto?: number | null;
  max_usuarios?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}
