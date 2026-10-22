-- =============================================
-- Lotes al Mando - Rol Superusuario + permisos de gestion de roles
-- Ejecutar despues de 024_permisos_por_modulo.sql
-- =============================================
--
-- Crea el rol "Superusuario": el administrador de la plataforma Lotes al Mando,
-- encargado SOLO de las configuraciones del sistema (configuracion general,
-- gestion de roles y permisos, y el alta de usuarios para asignarles roles).
-- A diferencia del "Administrador" de empresa, NO opera el negocio (no ve
-- inventario, comercial ni financiero).
--
-- Tambien agrega los permisos que la UI de Roles y Permisos usa, siguiendo la
-- misma convencion de la 024 (ver_/crear_/editar_/eliminar_/accion_<recurso>).
--
-- Idempotente: se puede re-ejecutar sin efecto secundario.

-- 1) Permiso de acceso a la pagina de gestion de roles y permisos, y los de
--    acciones sobre roles/permisos. ON CONFLICT DO NOTHING evita duplicados.
INSERT INTO permiso (nombre_permiso, modulo) VALUES
  ('ver_roles',          'roles'),
  ('crear_roles',        'roles'),
  ('editar_roles',       'roles'),
  ('eliminar_roles',     'roles'),
  ('crear_permisos',     'permisos'),
  ('eliminar_permisos',  'permisos'),
  ('asignar_permisos',   'permisos')
ON CONFLICT DO NOTHING;

-- 2) Rol Superusuario. Se inserta con nombre fijo y se reutiliza si ya existe
--    (el catalogo de roles es editable, pero este rol lo crea la plataforma).
INSERT INTO roles (nombre_rol)
VALUES ('Superusuario')
ON CONFLICT (nombre_rol) DO NOTHING;

-- 3) Permisos del Superusuario: SOLO configuracion del sistema.
--    - Configuracion general de la plataforma.
--    - Gestion de roles y permisos (la nueva pagina).
--    - Alta de usuarios: necesario para asignarles roles desde Usuarios.
--    NO recibe modulos operativos (inventario/comercial/financiero).
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permiso p
WHERE r.nombre_rol = 'Superusuario'
  AND p.nombre_permiso IN (
    'ver_dashboard',
    'ver_configuracion',
    'editar_configuracion',
    'ver_roles',
    'crear_roles',
    'editar_roles',
    'eliminar_roles',
    'ver_permisos',
    'crear_permisos',
    'eliminar_permisos',
    'asignar_permisos',
    'ver_usuarios',
    'crear_usuarios',
    'editar_usuarios'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- 4) El Administrador de empresa tambien gestiona roles/permisos (recibe todos
--    los permisos del catalogo en 024; se refuerza aqui por si se corre esta
--    migracion antes que aquella no lo haya hecho con los nuevos).
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permiso p
WHERE r.nombre_rol = 'Administrador'
  AND p.nombre_permiso IN ('ver_roles', 'crear_roles', 'editar_roles', 'eliminar_roles',
                           'crear_permisos', 'eliminar_permisos', 'asignar_permisos')
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- 5) Mantener la secuencia de permisos.
SELECT setval(
  pg_get_serial_sequence('permiso', 'id_permiso'),
  COALESCE((SELECT MAX(id_permiso) FROM permiso), 1),
  true
);
