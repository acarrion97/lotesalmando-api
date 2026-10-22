import { createClient } from '@supabase/supabase-js';
import { config } from './global';

// Cliente EXCLUSIVO de autenticación (Supabase Auth).
//
// Motivo: `signInWithPassword` GUARDA la sesión en memoria del cliente, y
// supabase-js envía después el JWT del usuario (rol `authenticated`) en las
// consultas PostgREST en lugar de la service role key. Si el login usara el
// cliente compartido (`supabaseClient`), TODA la BD a partir de ese momento
// se consultaría como el último usuario logueado: las tablas con RLS
// (p. ej. `audit_logs`) rechazarían la escritura con
// "new row violates row-level security policy" y los filtros por tenant
// dependerían de las políticas en vez del service role.
//
// Por eso: la sesión vive SOLO en este cliente y solo se usan sus métodos
// `auth.*`; el resto de la API habla con Supabase por `supabaseClient`,
// que nunca tiene sesión y siempre va con la service role key.
const supabaseAuth = createClient(config.db.url, config.db.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, storageKey: 'lotesalmando-api-auth' },
});

export default supabaseAuth;
