// middlewares/tenantScope.ts
// Acota cada operación CRUD a la empresa activa del contexto.
//
// `orgContext` (sessionAuth) resuelve la empresa del usuario autenticado y la
// deja en `req.organizationId`. Estos middlewares la aplican:
//
//   filterByEmpresa       → tablas con columna `id_empresa` directa: fuerza el
//                           filtro `?id_empresa=` en el listado.
//   filterByEmpresaChain  → tablas sin `id_empresa` (lotes, ventas…): fuerza
//                           el filtro sobre la cadena FK incrustada, p. ej.
//                           `?manzana_bloque.etapas.proyectos.id_empresa=`.
//   assignEmpresaOnCreate → inyecta `id_empresa` en el payload de creación
//                           (solo tablas con columna directa).
//
// Las tablas globales (roles, permiso, plan, partnership) no los usan: son
// catálogos compartidos por todas las empresas.

import { NextFunction, Request, Response } from 'express';

/** Fuerza `id_empresa` como filtro en GET / (listados de tablas con columna directa). */
export const filterByEmpresa = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.organizationId) {
    (req.query as Record<string, unknown>).id_empresa = req.organizationId;
  }
  next();
};

/**
 * Fuerza el filtro de TENANT sobre una cadena FK incrustada en el listado.
 *
 *   filterByEmpresaChain('manzana_bloque.etapas.proyectos.id_empresa')
 *
 * Requiere que el CRUD declare sus `joins` con `!inner` en la misma cadena
 * (p. ej. `['manzana_bloque!inner(etapas!inner(proyectos!inner(id_empresa)))']`).
 */
export const filterByEmpresaChain =
  (path: string) => (req: Request, _res: Response, next: NextFunction): void => {
    if (req.organizationId) {
      (req.query as Record<string, unknown>)[path] = req.organizationId;
    }
    next();
  };

/** Inyecta `id_empresa` en el body de creación (no pisa un valor explícito). */
export const assignEmpresaOnCreate = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.organizationId && req.body && typeof req.body === 'object' && req.body.id_empresa === undefined) {
    req.body = { ...req.body, id_empresa: Number(req.organizationId) };
  }
  next();
};
