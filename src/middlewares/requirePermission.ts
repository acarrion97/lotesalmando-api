// middlewares/requirePermission.ts
// RBAC fino por PERMISO, alineado al catálogo `permiso` / `rol_permiso` /
// `usuario_rol` del esquema (migraciones 003, 024, 025 y 030).
//
//   router.post('/', ...requireOrg, requirePermission('crear_lotes'), handler)
//
// Evaluación:
//   1. Los roles Administrador y Superusuario tienen acceso total (bypass).
//   2. Cualquier otro rol debe tener el permiso asignado vía
//      usuario_rol → rol_permiso → permiso.nombre_permiso.
//
// Los permisos se cargan UNA vez por petición y quedan en `req.userPermisos`.

import { NextFunction, Request, Response } from 'express';
import supabase from '../config/supabaseClient';
import { FULL_ACCESS_ROLES } from './requireRole';

/** Carga los permisos del usuario local en la empresa activa. */
async function cargarPermisos(req: Request): Promise<string[]> {
  if (req.userPermisos) return req.userPermisos;
  if (!req.localUsuarioId) return [];

  const { data, error } = await supabase
    .from('usuario_rol')
    .select('id_rol, rol_permiso(permiso(nombre_permiso))')
    .eq('id_usuario', req.localUsuarioId);

  if (error) throw new Error(error.message);

  const permisos = new Set<string>();
  for (const fila of data ?? []) {
    const vinculos = fila.rol_permiso as unknown as
      | Array<{ permiso: { nombre_permiso: string } | null }>
      | null;
    for (const vinculo of vinculos ?? []) {
      if (vinculo?.permiso?.nombre_permiso) permisos.add(vinculo.permiso.nombre_permiso);
    }
  }

  req.userPermisos = [...permisos];
  return req.userPermisos;
}

/** Permite la acción si el usuario tiene el permiso indicado (o rol de acceso total). */
export const requirePermission =
  (...nombres: string[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (FULL_ACCESS_ROLES.includes(req.orgRole ?? '')) {
        next();
        return;
      }

      if (!req.localUsuarioId) {
        res.status(401).json({ message: 'Sesión no iniciada' });
        return;
      }

      const permisos = await cargarPermisos(req);
      const falta = nombres.find((nombre) => !permisos.includes(nombre));

      if (falta) {
        res.status(403).json({
          message: `No tienes el permiso "${falta}" para realizar esta acción.`,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Error al validar permisos' });
    }
  };

/** Solo lectura: cualquier usuario con cuenta activa (el permiso `ver_*` es opcional). */
export const requireSession = (_req: Request, _res: Response, next: NextFunction): void => next();
