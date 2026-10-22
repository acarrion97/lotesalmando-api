-- =============================================
-- 030: PERMISOS DE PLANES (+ partnerships y panel de plataforma)
-- Ejecutar en Supabase SQL Editor (igual que las demas migraciones).
-- Idempotente: se puede ejecutar mas de una vez.
--
-- Ni 028_planes.sql ni 029_partnerships.sql crean sus permisos: lo dejan a la
-- UI de Roles y Permisos. Esta migracion los crea y se los asigna al rol
-- Superusuario, para que /planes funcione de punta a punta sin pasos manuales:
--
--   ver_planes      -> oculta/muestra el menu y la ruta /planes
--   crear_planes    -> boton "Nuevo plan" y RLS de la tabla plan
--   editar_planes   -> boton "Editar"  y RLS
--   eliminar_planes -> boton "Eliminar" y RLS
--
-- Sin crear/editar/eliminar_planes, las politicas RLS de `plan` (028)
-- rechazan la escritura: la pagina se abre pero no guarda nada.
--
-- IMPORTANTE: si tu usuario NO tiene el rol Superusuario, el segundo bloque no
-- te sirve. Asignalos desde la UI de Roles y Permisos a tu rol (por ejemplo
-- Administrador); el permiso `asignar_permisos` es el que te deja otorgarlos.
-- (El panel de Plataforma/Empresas tampoco lo crea ninguna migracion, por eso
-- ver_plataforma / ver_empresas / crear_empresas van en el mismo bloque.)
-- =============================================

-- -------------------------------------------------------------
-- 1) Catalogo: crea los permisos si no existen.
--    El ON CONFLICT sin target cubre cualquier restriccion unica:
--    (nombre_permiso, modulo) de la 001, o el UNIQUE(nombre_permiso) con el
--    que la 003 pudo haber creado la tabla en alguna base.
-- -------------------------------------------------------------
INSERT INTO permiso (nombre_permiso, modulo) VALUES
  ('ver_planes',            'planes'),
  ('crear_planes',          'planes'),
  ('editar_planes',         'planes'),
  ('eliminar_planes',       'planes'),
  ('ver_partnerships',      'partnerships'),
  ('crear_partnerships',    'partnerships'),
  ('editar_partnerships',   'partnerships'),
  ('eliminar_partnerships', 'partnerships'),
  ('ver_empresas',          'empresas'),
  ('crear_empresas',        'empresas'),
  ('ver_plataforma',        'plataforma')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------
-- 2) Asigna esos permisos al rol Superusuario.
--    rol_permiso tiene PK (id_rol, id_permiso), asi que el ON CONFLICT
--    evita duplicar si ya estaban asignados.
-- -------------------------------------------------------------
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permiso p
WHERE r.nombre_rol = 'Superusuario'
  AND p.nombre_permiso IN (
    'ver_planes', 'crear_planes', 'editar_planes', 'eliminar_planes',
    'ver_partnerships', 'crear_partnerships', 'editar_partnerships',
    'eliminar_partnerships',
    'ver_empresas', 'crear_empresas', 'ver_plataforma'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- -------------------------------------------------------------
-- 3) Mantener la secuencia de permiso despues de inserciones con IDs
--    implicitos (mismo cuidado que en 024_permisos_por_modulo.sql).
-- -------------------------------------------------------------
SELECT setval(
  pg_get_serial_sequence('permiso', 'id_permiso'),
  COALESCE((SELECT MAX(id_permiso) FROM permiso), 1),
  true
);
