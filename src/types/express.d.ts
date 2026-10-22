// types/express.d.ts
// Extensiones de `Request` que usan los middlewares de sesión y el núcleo MVC.

import 'express';

declare global {
  namespace Express {
    interface Request {
      /** UUID del usuario en Supabase Auth. */
      userId?: string;
      /** Fila completa del usuario de Supabase Auth. */
      user?: Record<string, unknown>;
      /** Empresa (tenant) activa resuelta desde la fila local `usuario`. */
      organizationId?: string;
      /** Fila local del usuario en la tabla `usuario` (id_usuario). */
      localUsuarioId?: number;
      /** Primer rol asignado en `usuario_rol` → `roles.nombre_rol`. */
      orgRole?: string;
      /** Permisos (`permiso.nombre_permiso`) del usuario; los carga requirePermission. */
      userPermisos?: string[];
    }
  }
}

export {};
