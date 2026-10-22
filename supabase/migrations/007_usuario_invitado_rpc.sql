-- =============================================
-- RPC: chequeo de invitacion antes de registrarse
-- Ejecutar en Supabase SQL Editor (requiere 006_row_level_security.sql
-- ya aplicada)
--
-- CONTEXTO: el flujo de registro ahora exige que un admin haya dado de
-- alta la fila `usuario` (invitacion) ANTES de que esa persona se
-- registre - ver AuthProvider.tsx `register()`. Ese chequeo corre
-- ANTES de crear la cuenta de Supabase Auth (para no dejar cuentas
-- huerfanas sin empresa si la persona no estaba invitada), es decir
-- corre sin sesion, como rol `anon`. Las politicas RLS de `usuario`
-- (006) solo permiten SELECT a `authenticated`, asi que `anon` no
-- puede leer la tabla directamente - correcto, no queremos que
-- cualquiera pueda hacer `usuario?select=*` de nuevo.
--
-- Esta funcion es la unica puerta angosta: SECURITY DEFINER (bypassea
-- RLS) pero solo devuelve las 3 columnas necesarias para UN email a
-- la vez, nunca la tabla completa. Trade-off aceptado: permite
-- confirmar si un email especifico ya tiene cuenta (enumeration side
-- channel), igual que cualquier flujo de "email ya registrado" u
-- "olvide mi contrasena" comun en otras apps.
-- =============================================

CREATE OR REPLACE FUNCTION usuario_invitado(p_email TEXT)
RETURNS TABLE(id_usuario INTEGER, id_empresa INTEGER, nombres VARCHAR)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id_usuario, id_empresa, nombres
  FROM usuario
  WHERE email = p_email
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION usuario_invitado(TEXT) TO anon, authenticated;
