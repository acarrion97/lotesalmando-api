-- =============================================
-- Fix: token NULL en auth.users rompen el login
-- Ejecutar en Supabase SQL Editor (requiere 021 y 022 ya aplicadas)
--
-- CONTEXTO / BUG: crear_usuario_auth() insertaba la fila en auth.users
-- sin tocar confirmation_token, recovery_token, email_change,
-- email_change_token_new ni email_change_token_current. En el esquema de
-- auth de este proyecto esas columnas aceptan NULL (el DEFAULT '' que
-- trae el schema de Supabase no aplica cuando la tabla ya existia), y
-- GoTrue las escanea a string en TODA consulta de usuario
-- (FindUserByEmail, login, refresh...). Si son NULL, la consulta truena
-- y el login responde:
--   {"code":"unexpected_failure","message":"Database error querying schema"}
-- aunque la contraseña sea correcta.
--
-- Evidencia: un usuario creado por GoTrue (Add user / registro) tiene
-- '' en esas columnas; el creado por nuestra RPC tenia NULL y no podia
-- iniciar sesion.
-- =============================================

-- 1. Reparar las filas ya creadas (solo las que tienen NULL; las que
--    creó GoTrue ya tienen '' y no se tocan).
UPDATE auth.users
SET confirmation_token       = COALESCE(confirmation_token, ''),
    recovery_token           = COALESCE(recovery_token, ''),
    email_change             = COALESCE(email_change, ''),
    email_change_token_new   = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change             = COALESCE(phone_change, ''),
    reauthentication_token   = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR phone_change IS NULL
   OR reauthentication_token IS NULL;

-- 2. La función, ahora escribiendo '' explicitamente en cada token para
--    que la fila quede identica a la que genera GoTrue.
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

  -- Los tokens van como '' (no NULL) igual que los usuarios que crea
  -- GoTrue: NULL rompe los scans de GoTrue y el login falla con
  -- "Database error querying schema".
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_auth_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '', '', '', '', '', '', '',
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

-- Refrescar el caché de PostgREST por las dudas.
NOTIFY pgrst, 'reload schema';
