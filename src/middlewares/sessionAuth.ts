// middlewares/sessionAuth.ts
// Valida el token Bearer de Supabase Auth y resuelve el contexto de EMPRESA
// (multi-tenant) sobre el esquema de Lotes al Mando.
//
//   Authorization: Bearer <access_token>
//   X-Empresa-Id: <id_empresa>   (opcional; si falta se usa la del usuario)
//
// `sessionAuth` comprueba el token con Supabase Auth. `orgContext` traduce ese
// usuario a la fila local `usuario` (por email — la tabla permite el mismo
// email en varias empresas) y resuelve:
//
//   req.organizationId  → id_empresa activo (se usa como tenant en los CRUD)
//   req.localUsuarioId  → id_usuario local (auditoría + permisos)
//   req.orgRole         → nombre del primer rol en usuario_rol → roles
//
// El RBAC de Lotes al Mando es por PERMISO (permiso / rol_permiso /
// usuario_rol); `requirePermission` es quien lo evalúa en las escrituras.

import { NextFunction, Request, Response } from 'express';
// `auth.*` por el cliente dedicado para que la validación del token nunca
// deje sesión en el cliente compartido (ver config/supabaseAuthClient.ts).
import supabaseAuth from '../config/supabaseAuthClient';
import supabase from '../config/supabaseClient';

interface UsuarioRow {
  id_usuario: number;
  id_empresa: number;
  email: string;
  estado: string;
}

/** Devuelve 401 si no hay token válido. */
export const sessionAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ message: 'Token de autenticación no proporcionado' });
      return;
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ message: 'Token de autenticación inválido o expirado' });
      return;
    }

    req.userId = data.user.id;
    req.user = data.user as unknown as Record<string, unknown>;
    next();
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error de autenticación' });
  }
};

/**
 * Resuelve la empresa activa y el rol del usuario dentro de ella.
 * Debe ejecutarse DESPUÉS de `sessionAuth`.
 *
 * Reglas: un usuario ajeno no puede leer ni editar los registros de otra
 * empresa; el tenant se resuelve desde su fila en `usuario`.
 */
export const orgContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Sesión no iniciada' });
      return;
    }

    const email = (req.user as { email?: string } | undefined)?.email;
    if (!email) {
      res.status(401).json({ message: 'El token no incluye un correo de acceso' });
      return;
    }

    const { data: filas, error: usuarioError } = await supabase
      .from('usuario')
      .select('id_usuario, id_empresa, email, estado')
      .eq('email', email);

    if (usuarioError) throw new Error(usuarioError.message);

    const candidatas = ((filas ?? []) as UsuarioRow[]).filter((fila) => fila.estado !== 'inactivo');
    if (candidatas.length === 0) {
      res.status(403).json({ message: 'El usuario no tiene una cuenta activa en la plataforma' });
      return;
    }

    // El mismo email puede existir en varias empresas: el header decide.
    const empresaSolicitada = (req.headers['x-empresa-id'] as string | undefined)?.trim();
    const local = empresaSolicitada
      ? candidatas.find((fila) => String(fila.id_empresa) === empresaSolicitada)
      : candidatas[0];

    if (!local) {
      res.status(403).json({ message: 'El usuario no pertenece a la empresa solicitada' });
      return;
    }

    const { data: asignaciones, error: rolesError } = await supabase
      .from('usuario_rol')
      .select('id_rol, roles(nombre_rol)')
      .eq('id_usuario', local.id_usuario);

    if (rolesError) throw new Error(rolesError.message);

    const rol = (asignaciones ?? [])
      .map((asignacion) => (asignacion.roles as unknown as { nombre_rol?: string } | null)?.nombre_rol)
      .find((nombre): nombre is string => Boolean(nombre));

    req.organizationId = String(local.id_empresa);
    req.orgRole = rol;
    // Fila local en `usuario`: la usa la bitácora de auditoría y los permisos.
    req.localUsuarioId = local.id_usuario;
    next();
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Error de contexto de empresa' });
  }
};

/**
 * Middlewares combinados usados por los routers CRUD: sesión + empresa.
 */
export const requireOrg = [sessionAuth, orgContext];
