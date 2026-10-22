// models/identity/rol.model.ts
// Catálogos y tablas de unión del RBAC:
//   roles (id_rol, nombre_rol)            — catálogo editable
//   permiso (id_permiso, nombre_permiso, modulo) — catálogo editable
//   usuario_rol (PK: id_usuario + id_rol)
//   rol_permiso (PK: id_rol + id_permiso)

export interface Rol {
  id_rol: number;
  nombre_rol: string;
}

export interface Permiso {
  id_permiso: number;
  nombre_permiso: string;
  modulo: string | null;
}

export interface UsuarioRol {
  id_usuario: number;
  id_rol: number;
  fecha_asignacion?: string | null;
}

export interface RolPermiso {
  id_rol: number;
  id_permiso: number;
}
