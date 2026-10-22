// services/auth.service.ts
// Registro, login, perfil y alta de usuarios con acceso de Lotes al Mando.
//
// El esquema expone las RPC `crear_empresa_con_admin` y `crear_usuario_auth`,
// pero ambas exigen `auth.uid()` (sesión de usuario) y el backend opera con la
// clave de SERVICE ROLE, que no lleva sesión. Por eso estas operaciones se
// replican aquí directamente con la clave de administrador:
//
//   1. el usuario en Supabase Auth (credenciales),
//   2. la fila local en la tabla `usuario` (vinculada por email),
//   3. la asignación de roles en `usuario_rol`.
//
// El acceso posterior resuelve empresa y rol en `middlewares/sessionAuth`.
// Los límites de plan (max_proyectos / max_lotes_por_proyecto / max_usuarios)
// los aplican los triggers de la migración 028: no hace falta reimplementarlos.

import supabase from '../config/supabaseClient';
// Operaciones `auth.*` por el cliente dedicado: ver config/supabaseAuthClient.ts
import supabaseAuth from '../config/supabaseAuthClient';
import { HttpError } from '../core/errors';
import { logAudit } from './audit.service';
import { validarCodigoPartner } from './rpc.service';

export interface RegisterInput {
  email: string;
  password: string;
  nombres: string;
  /** Razón social de la empresa creada junto a la cuenta. */
  razon_social: string;
  /** RUC; puede quedar pendiente y completarse después. */
  ruc?: string;
  /** Código de partnership opcional: vincula la nueva empresa al partner. */
  codigo_partner?: string;
}

export interface SessionResult {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

export interface RegisterResult {
  user_id: string;
  id_empresa: number;
  id_usuario: number;
  id_partner: number | null;
}

/** Busca (o crea) un rol por nombre en el catálogo editable `roles`. */
async function asegurarRol(nombre: string): Promise<number> {
  const { data: existente } = await supabase
    .from('roles')
    .select('id_rol')
    .eq('nombre_rol', nombre)
    .maybeSingle();

  if (existente) return (existente as { id_rol: number }).id_rol;

  const { data: creado, error } = await supabase
    .from('roles')
    .insert([{ nombre_rol: nombre }])
    .select('id_rol')
    .single();

  if (error) throw new HttpError(500, `No se pudo crear el rol '${nombre}': ${error.message}`);
  return (creado as { id_rol: number }).id_rol;
}

/** Asigna roles a un usuario local (ignora duplicados por la PK compuesta). */
async function asignarRoles(idUsuario: number, rolesIds: number[]): Promise<void> {
  const { error } = await supabase
    .from('usuario_rol')
    .upsert(
      rolesIds.map((id_rol) => ({ id_usuario: idUsuario, id_rol })),
      { onConflict: 'id_usuario,id_rol', ignoreDuplicates: true }
    );

  if (error) throw new HttpError(500, `No se pudieron asignar los roles: ${error.message}`);
}

/**
 * Crea la cuenta de acceso en Supabase Auth y su fila local en `usuario`.
 * El email queda en minúsculas y sin espacios (clave de vinculación).
 */
async function crearCuentaAcceso(input: {
  email: string;
  password: string;
  nombres: string;
  id_empresa: number;
}): Promise<{ id_usuario: number; user_id: string }> {
  const email = input.email.trim().toLowerCase();

  if (input.password.length < 6) {
    throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres', [
      { field: 'password', message: 'Mínimo 6 caracteres' },
    ]);
  }

  const { data: auth, error: authError } = await supabaseAuth.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nombres: input.nombres },
  });

  if (authError) {
    const duplicado = /already|exist/i.test(authError.message);
    throw new HttpError(duplicado ? 409 : 400, `No se pudo crear la cuenta: ${authError.message}`);
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuario')
    .insert([
      {
        id_empresa: input.id_empresa,
        nombres: input.nombres.trim(),
        email,
        estado: 'activo',
      },
    ])
    .select('id_usuario')
    .single();

  if (usuarioError) {
    // Reversión mejor-esfuerzo: no dejar cuentas huérfanas en Supabase Auth.
    await supabaseAuth.auth.admin.deleteUser(auth.user!.id).catch(() => undefined);
    throw new HttpError(500, `No se pudo crear el usuario: ${usuarioError.message}`);
  }

  return { id_usuario: (usuario as { id_usuario: number }).id_usuario, user_id: auth.user!.id };
}

/** Registro de una nueva cuenta de empresa: cuenta + empresa + usuario + rol Administrador. */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();

  // 1) Partner opcional (catálogo global; el código decide el tenant partner).
  let idPartner: number | null = null;
  if (input.codigo_partner?.trim()) {
    idPartner = await validarCodigoPartner(input.codigo_partner);
    if (!idPartner) {
      throw new HttpError(400, 'El código de partner no existe o no está activo', [
        { field: 'codigo_partner', message: 'Código inválido' },
      ]);
    }
  }

  // 2) Empresa (tenant). Los triggers de plan no aplican: es el alta inicial.
  const { data: empresa, error: empresaError } = await supabase
    .from('empresa')
    .insert([
      {
        razon_social: input.razon_social.trim(),
        ruc: input.ruc?.trim() || null,
        estado: 'activo',
        id_partner: idPartner,
      },
    ])
    .select('id_empresa')
    .single();

  if (empresaError) throw new HttpError(500, `No se pudo crear la empresa: ${empresaError.message}`);
  const idEmpresa = (empresa as { id_empresa: number }).id_empresa;

  // 3) Cuenta de acceso + fila local.
  const { id_usuario: idUsuario, user_id: authUserId } = await crearCuentaAcceso({
    email,
    password: input.password,
    nombres: input.nombres,
    id_empresa: idEmpresa,
  });

  // 4) Rol Administrador (catálogo editable; se crea si falta).
  const idRolAdministrador = await asegurarRol('Administrador');
  await asignarRoles(idUsuario, [idRolAdministrador]);

  // Bitácora: alta de cuenta (empresa + usuario + rol Administrador).
  await logAudit(
    'usuario',
    'REGISTER',
    idUsuario,
    { email, id_empresa: idEmpresa, razon_social: input.razon_social, rol: 'Administrador' },
    { authUserId, usuarioId: idUsuario, empresaId: idEmpresa }
  );

  return {
    user_id: authUserId,
    id_empresa: idEmpresa,
    id_usuario: idUsuario,
    id_partner: idPartner,
  };
}

export async function login(email: string, password: string): Promise<SessionResult> {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.session) {
    // Los intentos fallidos NO se registran en la bitácora: el email podría
    // no pertenecer a nadie y no debe quedar asociado a una cuenta.
    throw new HttpError(401, 'Credenciales inválidas');
  }

  // Bitácora: inicio de sesión (empresa resuelta por email en `usuario`).
  const { data: local } = await supabase
    .from('usuario')
    .select('id_usuario, id_empresa')
    .eq('email', email.trim().toLowerCase())
    .limit(1)
    .maybeSingle();

  await logAudit(
    'usuario',
    'LOGIN',
    (local as { id_usuario?: number } | null)?.id_usuario ?? null,
    { email },
    {
      authUserId: data.user.id,
      usuarioId: (local as { id_usuario?: number } | null)?.id_usuario,
      empresaId: (local as { id_empresa?: number } | null)?.id_empresa ?? null,
    }
  );

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user_id: data.user.id,
  };
}

/** Perfil local del usuario + roles y permisos dentro de su empresa. */
export async function me(email: string | undefined): Promise<Record<string, unknown>> {
  if (!email) throw new HttpError(401, 'El token no incluye un correo de acceso');

  const { data: filas, error } = await supabase
    .from('usuario')
    .select('*, empresa(id_empresa, razon_social, plan)')
    .eq('email', email.trim().toLowerCase());

  if (error) throw new HttpError(500, `No se pudo leer el usuario: ${error.message}`);
  const fila = ((filas ?? []) as Array<Record<string, unknown>>)[0];
  if (!fila) throw new HttpError(404, 'El usuario no tiene una cuenta registrada en la plataforma');

  const idUsuario = fila.id_usuario as number;

  const { data: asignaciones } = await supabase
    .from('usuario_rol')
    .select('id_rol, roles(nombre_rol, rol_permiso(permiso(nombre_permiso, modulo)))')
    .eq('id_usuario', idUsuario);

  const roles = (asignaciones ?? []).map((asignacion) => {
    const rol = asignacion.roles as unknown as
      | {
          nombre_rol: string;
          rol_permiso?: Array<{ permiso: { nombre_permiso: string; modulo: string } | null }>;
        }
      | null;

    return {
      id_rol: asignacion.id_rol,
      nombre_rol: rol?.nombre_rol ?? 'sin-rol',
      permisos: (rol?.rol_permiso ?? [])
        .map((vinculo) => vinculo?.permiso?.nombre_permiso)
        .filter((nombre): nombre is string => Boolean(nombre)),
    };
  });

  const { empresa, ...resto } = fila;

  return {
    usuario: { ...resto, empresa: empresa ?? null },
    roles,
  };
}

export interface AltaUsuarioInput {
  email: string;
  password: string;
  nombres: string;
  /** Por defecto, la empresa activa de la sesión. */
  id_empresa?: number;
  /** Roles a asignar (por defecto, Vendedor). */
  roles?: number[];
}

/**
 * Alta de un usuario con acceso ( réplica de la RPC `crear_usuario_auth`):
 * crea la cuenta en Supabase Auth, la fila local y le asigna roles.
 */
export async function crearUsuarioConAcceso(input: AltaUsuarioInput, empresaSesion: number): Promise<{
  id_usuario: number;
  user_id: string;
}> {
  const idEmpresa = input.id_empresa ?? empresaSesion;

  // Verificación de tenant: el admin solo puede dar de alta en su empresa.
  if (idEmpresa !== empresaSesion) {
    throw new HttpError(403, 'No puedes crear usuarios en otra empresa');
  }

  const { data: auth, error: authError } = await supabaseAuth.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { nombres: input.nombres },
  });

  if (authError) {
    const duplicado = /already|exist/i.test(authError.message);
    throw new HttpError(duplicado ? 409 : 400, `No se pudo crear la cuenta: ${authError.message}`);
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuario')
    .insert([
      {
        id_empresa: idEmpresa,
        nombres: input.nombres.trim(),
        email: input.email.trim().toLowerCase(),
        estado: 'activo',
      },
    ])
    .select('id_usuario')
    .single();

  if (usuarioError) {
    await supabaseAuth.auth.admin.deleteUser(auth.user!.id).catch(() => undefined);
    throw new HttpError(500, `No se pudo crear el usuario: ${usuarioError.message}`);
  }

  const idUsuario = (usuario as { id_usuario: number }).id_usuario;
  const rolesIds = input.roles?.length ? input.roles : [await asegurarRol('Vendedor')];
  await asignarRoles(idUsuario, rolesIds);

  await logAudit(
    'usuario',
    'CREATE',
    idUsuario,
    { email: input.email, id_empresa: idEmpresa, roles: rolesIds },
    { authUserId: auth.user!.id, usuarioId: idUsuario, empresaId: idEmpresa }
  );

  return { id_usuario: idUsuario, user_id: auth.user!.id };
}

export const authService = { register, login, me, crearUsuarioConAcceso, asegurarRol, asignarRoles };
