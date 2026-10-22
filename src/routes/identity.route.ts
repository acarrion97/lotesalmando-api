// routes/identity.route.ts
// Routers del módulo Identidad: empresa, configuración, usuarios, roles,
// permisos y las uniones del RBAC. Documentación OpenAPI en `src/docs`.

export {
  configuracionRouter,
  empresaRouter,
  permisoRouter,
  rolPermisoRouter,
  rolRouter,
  usuarioRolRouter,
  usuarioRouter,
} from '../controllers/identity.controller';
