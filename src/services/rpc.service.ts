// services/rpc.service.ts
// Invocación de las RPC (funciones SQL) del esquema de Lotes al Mando.
//
// El backend usa la clave de SERVICE ROLE, que no lleva sesión de usuario:
// por eso las RPC que exigen `auth.uid()` (crear_empresa_con_admin,
// crear_usuario_auth) NO se llaman desde aquí — esas operaciones se replican
// directamente en `auth.service` con la clave de administrador.
//
// Las que sí se invocan son las que el esquema expone a `anon`/`authenticated`
// o las que no exigen sesión:
//
//   aceptar_cotizacion            → transacción completa venta+contrato+cuotas
//   mapa_publico                  → mapa público por slug (RPC de solo lectura)
//   mapa_publico_registrar_interes→ registro de interés desde el mapa público
//   validar_codigo_partner        → resuelve id_partner por código

import supabase from '../config/supabaseClient';
import { HttpError } from '../core/errors';

export interface AceptarResultado {
  venta_id: number;
  contrato_id: number;
  cuotas_generadas: number;
}

/** Acepta una cotización: crea venta, marca el lote vendido, genera contrato y cuotas. */
export async function aceptarCotizacion(idCotizacion: number, idUsuario: number): Promise<AceptarResultado> {
  const { data, error } = await supabase.rpc('aceptar_cotizacion', {
    p_id_cotizacion: idCotizacion,
    p_id_usuario: idUsuario,
  });

  if (error) throw new HttpError(400, `No se pudo aceptar la cotización: ${error.message}`);

  const fila = (Array.isArray(data) ? data[0] : data) as AceptarResultado | undefined;
  if (!fila) throw new HttpError(400, 'La RPC aceptar_cotizacion no devolvió resultado');

  return fila;
}

/** Datos del mapa público de un proyecto (lotes del plano + estadísticas). */
export async function mapaPublico(slug: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('mapa_publico', { p_slug: slug });
  if (error) throw new HttpError(500, `No se pudo leer el mapa público: ${error.message}`);
  return (data as Record<string, unknown>) ?? null;
}

/**
 * Registra el interés de un visitante del mapa público en un lote: crea (o
 * reutiliza) el prospecto, la oportunidad y la actividad de seguimiento.
 */
export async function registrarInteresPublico(input: {
  slug: string;
  id_lote: number;
  nombres: string;
  email: string;
  telefono: string;
}): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('mapa_publico_registrar_interes', {
    p_slug: input.slug,
    p_id_lote: input.id_lote,
    p_nombres: input.nombres,
    p_email: input.email,
    p_telefono: input.telefono,
  });

  if (error) throw new HttpError(400, `No se pudo registrar el interés: ${error.message}`);
  return (data as Record<string, unknown>) ?? null;
}

/** Resuelve el id_partner de un código de partnership activo (null si no existe). */
export async function validarCodigoPartner(codigo: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('validar_codigo_partner', { p_codigo: codigo });
  if (error) throw new HttpError(400, `No se pudo validar el código de partner: ${error.message}`);
  return typeof data === 'number' ? data : null;
}

export const rpcService = {
  aceptarCotizacion,
  mapaPublico,
  registrarInteresPublico,
  validarCodigoPartner,
};
