// resources/identity.resource.ts
// Vistas de respuesta del módulo Identidad.
//
// Las tablas incrustadas llegan con el nombre de la TABLA foránea; el
// Resource las renombra a singular (p. ej. `empresa` → objeto plano).

import { BaseResource } from '../core/base.resource';
import { Configuracion } from '../models/identity/configuracion.model';
import { Empresa } from '../models/identity/empresa.model';
import { Permiso, Rol } from '../models/identity/rol.model';
import { Usuario, UsuarioView } from '../models/identity/usuario.model';

export const empresaResource = new BaseResource<any, Empresa>((row) => ({
  id_empresa: row.id_empresa,
  razon_social: row.razon_social,
  ruc: row.ruc,
  estado: row.estado,
  created_at: row.created_at,
  plan: row.plan ?? null,
  id_partner: row.id_partner ?? null,
  estado_pago: row.estado_pago ?? null,
  pagado_en: row.pagado_en ?? null,
  transaccion_id: row.transaccion_id ?? null,
}));

export const configuracionResource = new BaseResource<any, Configuracion>((row) => ({
  id_configuracion: row.id_configuracion,
  id_empresa: row.id_empresa,
  moneda: row.moneda,
  idioma: row.idioma,
}));

export const usuarioResource = new BaseResource<any, UsuarioView>((row) => ({
  id_usuario: row.id_usuario,
  id_empresa: row.id_empresa,
  nombres: row.nombres,
  email: row.email,
  estado: row.estado,
  password_temporal_hasta: row.password_temporal_hasta ?? null,
  created_at: row.created_at,
  // La tabla incrustada se llama igual que la FK (PostgREST la devuelve como
  // `empresa` cuando el select declara `empresa(...)`).
  empresa: row.empresa ? empresaResource.format(row.empresa) : null,
}));

/** Vista SIN la subrelación (útil en listados ligeros). */
export const usuarioPlanoResource = new BaseResource<any, Usuario>((row) => ({
  id_usuario: row.id_usuario,
  id_empresa: row.id_empresa,
  nombres: row.nombres,
  email: row.email,
  estado: row.estado,
  password_temporal_hasta: row.password_temporal_hasta ?? null,
  created_at: row.created_at,
}));

export const rolResource = new BaseResource<any, Rol>((row) => ({
  id_rol: row.id_rol,
  nombre_rol: row.nombre_rol,
}));

export const permisoResource = new BaseResource<any, Permiso>((row) => ({
  id_permiso: row.id_permiso,
  nombre_permiso: row.nombre_permiso,
  modulo: row.modulo ?? null,
}));
