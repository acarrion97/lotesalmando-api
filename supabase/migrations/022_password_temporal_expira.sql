-- =============================================
-- Contraseña temporal con vencimiento (24h) + olvidé mi contraseña
-- Ejecutar en Supabase SQL Editor (requiere 021_crear_usuario_auth_rpc.sql)
--
-- CONTEXTO: el panel crea cuentas de acceso con una contraseña temporal
-- predecible (usuario del correo + "*", ver passwordDeEmail()). Para que
-- ese atajo no quede para siempre:
--   1. La columna `password_temporal_hasta` marca cuándo vence. La pone
--      crear_usuario_auth() al dar de alta (+24h).
--   2. La app compara esa fecha en el login y en cada arranque de
--      sesion (AuthProvider): vencida, se cierra la sesión y el usuario
--      debe restablecer su contraseña desde "Olvidé mi contraseña".
--   3. password_definitiva() borra el sello cuando el usuario define
--      su propia contraseña (flujo de recuperación).
--
-- IMPORTANTE: esto es un control de la APP, no del servidor. GoTrue no
-- vence contraseñas, así que la contraseña temporal seguiría siendo
-- válida para un ataque directo a la API de Auth hasta que el usuario
-- la cambie. Se acepta como mitigación del atajo "contraseña adivinable
-- para siempre"; si algún día hace falta bloqueo duro, toca un cron
-- (pg_cron / Edge Function) que cambie la password en auth.users.
-- =============================================

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS password_temporal_hasta TIMESTAMPTZ;

COMMENT ON COLUMN usuario.password_temporal_hasta IS
  'Vencimiento de la contraseña temporal otorgada al crear la cuenta desde el panel. NULL = sin vencimiento (definida por el usuario).';

-- =============================================
-- crear_usuario_auth(): misma que 021, ahora estampando el vencimiento
-- =============================================

CREATE OR REPLACE FUNCTION crear_usuario_auth(
  p_email TEXT,
  p_password TEXT,
  p_nombres TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_empresa_admin INTEGER;
  v_auth_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesion requerida para crear cuentas de acceso';
  END IF;

  SELECT id_empresa INTO v_empresa_admin
  FROM usuario
  WHERE lower(email) = lower(auth.email())
  LIMIT 1;

  IF v_empresa_admin IS NULL THEN
    RAISE EXCEPTION 'No autorizado: tu usuario no esta dado de alta en ninguna empresa';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM usuario
    WHERE lower(email) = v_email
      AND id_empresa = v_empresa_admin
  ) THEN
    RAISE EXCEPTION 'El correo % no esta invitado en tu empresa', v_email;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Ya existe una cuenta de acceso para %', v_email;
  END IF;

  v_auth_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_auth_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nombres', p_nombres),
    now(),
    now()
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_auth_id::text,
    v_auth_id,
    jsonb_build_object(
      'sub', v_auth_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(), now(), now()
  );

  -- Sello de vencimiento: la contraseña temporal vale 24 horas.
  UPDATE usuario
  SET password_temporal_hasta = now() + interval '24 hours'
  WHERE lower(email) = v_email
    AND id_empresa = v_empresa_admin;

  RETURN v_auth_id;
END;
$$;

REVOKE ALL ON FUNCTION crear_usuario_auth(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crear_usuario_auth(TEXT, TEXT, TEXT) TO authenticated;

-- =============================================
-- password_definitiva(): el usuario definio su propia contraseña
-- (la llamo la app despues de updateUser({ password }) en el flujo de
-- recuperacion), asi que se borra el sello de vencimiento.
-- =============================================

CREATE OR REPLACE FUNCTION password_definitiva()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE usuario
  SET password_temporal_hasta = NULL
  WHERE lower(email) = lower(auth.email());
$$;

-- Solo con sesion iniciada: nadie puede borrar el sello de otro.
REVOKE ALL ON FUNCTION password_definitiva() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION password_definitiva() TO authenticated;

-- PostgREST cachea el esquema: sin esto, la funcion recien creada no se
-- ve desde la API hasta que recicla la conexion ("Could not find the
-- function ... in the schema cache").
NOTIFY pgrst, 'reload schema';
