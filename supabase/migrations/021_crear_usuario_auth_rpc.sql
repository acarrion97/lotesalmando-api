-- =============================================
-- RPC: alta de cuenta Supabase Auth desde el panel
-- Ejecutar en Supabase SQL Editor (requiere 007_usuario_invitado_rpc.sql
-- ya aplicada)
--
-- CONTEXTO: antes, "Nuevo Usuario" en UsuariosPage solo creaba la fila
-- `usuario` (invitacion) y la persona tenia que completar el registro en
-- /registro para elegir su contrasena. Ahora el panel crea tambien la
-- cuenta de acceso, con una contrasena temporal derivada del correo
-- (ver passwordDeEmail() en la app).
--
-- COMO SE CREA EL USUARIO DE AUTH: el navegador no puede llamar a
-- auth.admin.createUser() porque eso exige la service_role_key (que no
-- puede vivir en el front). Esta funcion SECURITY DEFINER corre en
-- Postgres (rol postgres, dueño de las tablas) y inserta directamente en
-- auth.users + auth.identities con la password ya hasheada (bcrypt via
-- pgcrypto). Es el mismo resultado que produce GoTrue en un signUp():
--   - aud/role = 'authenticated'
--   - email_confirmed_at = now()  -> puede entrar de una, sin esperar
--     el correo de confirmacion (incluso si "Confirm email" esta activo)
--
-- SEGURIDAD: solo se puede llamar con sesion iniciada, y solo da de alta
-- correos que ya tengan fila `usuario` (invitacion) EN LA MISMA EMPRESA
-- del admin que llama. Un admin de la empresa A no puede crear cuentas
-- para la empresa B. No devuelve la password ni datos de auth.
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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
  -- Sin sesion no hay admin que validar
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesion requerida para crear cuentas de acceso';
  END IF;

  -- Empresa del admin que llama
  SELECT id_empresa INTO v_empresa_admin
  FROM usuario
  WHERE lower(email) = lower(auth.email())
  LIMIT 1;

  IF v_empresa_admin IS NULL THEN
    RAISE EXCEPTION 'No autorizado: tu usuario no esta dado de alta en ninguna empresa';
  END IF;

  -- La invitacion (fila usuario) debe existir y ser de la misma empresa.
  -- El alta de la fila la hace el panel ANTES de llamar a esta RPC.
  IF NOT EXISTS (
    SELECT 1 FROM usuario
    WHERE lower(email) = v_email
      AND id_empresa = v_empresa_admin
  ) THEN
    RAISE EXCEPTION 'El correo % no esta invitado en tu empresa', v_email;
  END IF;

  -- Ya existe cuenta de acceso para ese correo
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

  RETURN v_auth_id;
END;
$$;

-- Solo usuarios logueados (admins del panel). Nunca anon ni public:
-- sin esto cualquiera podria dar de alta cuentas sin invitacion.
REVOKE ALL ON FUNCTION crear_usuario_auth(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crear_usuario_auth(TEXT, TEXT, TEXT) TO authenticated;
