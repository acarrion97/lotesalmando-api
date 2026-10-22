// middlewares/requireRole.ts
// RBAC grueso por nombre de rol (catálogo `roles` de Lotes al Mando:
// Administrador, Vendedor, Gerente, Superusuario).
//
//   router.delete('/:id', ...requireOrg, requireRole('Administrador'), handler)
//
// El RBAC fino (permisos por módulo) vive en `requirePermission`; estos
// middlewares quedan para acciones reservadas a un rol concreto (p. ej.
// eliminar empresas o gestionar partnerships).

import { NextFunction, Request, Response } from 'express';

export const ORG_ROLES = ['Administrador', 'Vendedor', 'Gerente', 'Superusuario'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Roles con acceso total: sus permisos se consideran completos. */
export const FULL_ACCESS_ROLES = ['Administrador', 'Superusuario'];

const normalize = (value: string | undefined): string => (value ?? '').toLowerCase();

/** Permite la acción solo a los roles indicados (comparación sin mayúsculas). */
export const requireRole =
  (...allowed: OrgRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const role = normalize(req.orgRole);

    if (!role) {
      res.status(403).json({ message: 'El usuario no tiene un rol asignado en la empresa' });
      return;
    }

    if (!allowed.map(normalize).includes(role)) {
      res.status(403).json({
        message: `Tu rol "${req.orgRole}" no tiene permiso para esta acción. Requiere: ${allowed.join(' o ')}.`,
      });
      return;
    }

    next();
  };

/** Solo el rol Superusuario (acciones de plataforma). */
export const requireSuperusuario = requireRole('Superusuario');
