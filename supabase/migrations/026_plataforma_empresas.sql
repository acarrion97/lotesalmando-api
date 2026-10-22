-- =============================================
-- Lotes al Mando - Plataforma: empresas y metricas
-- Ejecutar despues de 025_superusuario_roles_permisos.sql
-- =============================================
--
-- Soporta las dos secciones de superadmin:
--   1) /empresas      -> crear una empresa nueva junto con su cuenta admin.
--   2) /plataforma    -> dashboard con cuantas empresas y usuarios hay.
--
-- Nota sobre permisos: las paginas estan tras `ver_empresas` y `ver_plataforma`
-- en el frontend. Esos nombres se crean desde la UI de Roles y Permisos (o con
-- INSERT manual). Ademas, la RPC `crear_empresa_con_admin` vuelve a chequear
-- `crear_empresas` en el servidor, como defensa en profundidad: aunque el front
-- se bypasee, sin ese permiso la BD rechaza la creacion.
--
-- Idempotente: se puede re-ejecutar sin efecto secundario.

-- -------------------------------------------------------------
-- 1) created_at en empresa y usuario
-- -------------------------------------------------------------
-- Sin estas columnas no se puede responder "cuantas empresas/usuarios se han
-- registrado" (ni "este mes"). Se agregan con default now() y se backfillea
-- para que las filas existentes no queden en NULL.

ALTER TABLE empresa ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE empresa SET created_at = now() WHERE created_at IS NULL;
UPDATE usuario SET created_at = now() WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_empresa_created_at ON empresa(created_at);
CREATE INDEX IF NOT EXISTS idx_usuario_created_at ON usuario(created_at);

-- -------------------------------------------------------------
-- 2) RPC: crear una empresa nueva + su cuenta de admin, atomicamente
-- -------------------------------------------------------------
-- El navegador no puede llamar a auth.admin.createUser() (requiere la
-- service_role_key). Esta funcion SECURITY DEFINER corre en Postgres y hace
-- las tres altas en una sola transaccion:
--   empresa -> usuario (admin de esa empresa) -> auth.users + auth.identities
-- Es el mismo resultado que produce el flujo publico de registro
-- (AuthProvider.registerNuevaEmpresa), pero hecho por un superadmin desde el
-- panel y sin depender de la sesion del cliente.
--
-- Los tokens de auth.users van como '' (no NULL), igual que en
-- 023_auth_tokens_no_null.sql: NULL rompe los scans de GoTrue y el login
-- falla con "Database error querying schema".
--
-- SEGURIDAD: solo lo puede llamar quien tenga el permiso `crear_empresas`
-- asignado a traves de usuario_rol -> rol_permiso -> permiso. Devuelve el
-- id_empresa creado, o lanza excepcion con un mensaje claro.

CREATE OR REPLACE FUNCTION crear_empresa_con_admin(
  p_razon_social TEXT,
  p_ruc TEXT,
  p_admin_nombres TEXT,
  p_admin_email TEXT,
  p_admin_password TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_email TEXT := lower(trim(p_admin_email));
  v_id_empresa INTEGER;
  v_auth_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesion requerida para crear empresas';
  END IF;

  -- Autorizacion en el servidor: el que llama debe tener `crear_empresas`.
  -- Esto no reemplaza al gating del frontend; lo refuerza.
  IF NOT EXISTS (
    SELECT 1
    FROM usuario u
    JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
    JOIN rol_permiso rp ON rp.id_rol   = ur.id_rol
    JOIN permiso    p  ON p.id_permiso = rp.id_permiso
    WHERE lower(u.email) = lower(auth.email())
      AND p.nombre_permiso = 'crear_empresas'
  ) THEN
    RAISE EXCEPTION 'No autorizado: necesitas el permiso crear_empresas';
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'El email del admin es obligatorio';
  END IF;

  IF p_admin_password IS NULL OR length(p_admin_password) < 6 THEN
    RAISE EXCEPTION 'La contrasena debe tener al menos 6 caracteres';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Ya existe una cuenta de acceso para %', v_email;
  END IF;

  INSERT INTO empresa (razon_social, ruc, estado)
  VALUES (trim(p_razon_social), nullif(trim(p_ruc), ''), 'activo')
  RETURNING id_empresa INTO v_id_empresa;

  INSERT INTO usuario (id_empresa, nombres, email, estado)
  VALUES (v_id_empresa, trim(p_admin_nombres), v_email, 'activo');

  v_auth_id := gen_random_uuid();

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
    crypt(p_admin_password, gen_salt('bf')),
    now(),
    '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nombres', p_admin_nombres),
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

  RETURN v_id_empresa;
END;
$$;

-- Solo usuarios logueados (admins del panel). Nunca anon ni public.
REVOKE ALL ON FUNCTION crear_empresa_con_admin(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crear_empresa_con_admin(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
