// middlewares/chain.ts
// Compone middlewares/handlers en serie: cada uno llama a `next()` para pasar
// al siguiente. Se usa para enganchar permisos delante de un handler genérico
// del CRUD:
//
//   handlers: { create: chain(requirePermission('crear_lotes'), loteController.create) }

import { RequestHandler } from 'express';

export const chain =
  (...fns: RequestHandler[]): RequestHandler =>
  (req, res, next) => {
    const [head, ...rest] = fns;
    if (!head) {
      next();
      return;
    }
    head(req, res, (err) => (err ? next(err) : chain(...rest)(req, res, next)));
  };
