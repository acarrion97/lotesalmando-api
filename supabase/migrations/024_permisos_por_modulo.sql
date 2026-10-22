-- =============================================
-- Lotes al Mando - Permisos por modulo (catalogo completo)
-- Ejecutar despues de 003_seed_roles_permisos.sql
-- =============================================
--
-- El frontend ahora decide el menu, las rutas, las acciones y el alcance de
-- datos segun los permisos que vienen de la BD (usuario_rol -> rol_permiso ->
-- permiso). El catalogo de 003 solo cubria algunos modulos, asi que aqui se
-- completa con un permiso "ver_<modulo>" por cada seccion navegable y se
-- reasignan los roles para que un Vendedor SOLO vea lo comercial/ventas.
--
-- Convencion de nombres (reconocida por src/presentation/permisos):
--   ver_<modulo>               -> acceso al menu y a la ruta del modulo
--   crear_|editar_|eliminar_   -> acciones (botones) dentro del modulo
--   ver_registros_de_todos     -> alcance de datos: ver todos, no solo los propios
--
-- Idempotente: se puede re-ejecutar sin efecto secundario.

-- 1) Completar el catalogo de permisos con los modulos que faltaban.
--    ON CONFLICT DO NOTHING evita duplicar si ya existen.
INSERT INTO permiso (nombre_permiso, modulo) VALUES
  ('ver_dashboard',        'dashboard'),
  ('ver_proyectos',        'proyectos'),
  ('ver_etapas',           'etapas'),
  ('ver_manzanas',         'manzanas'),
  ('ver_mapas',            'mapas'),
  ('ver_lotes',            'lotes'),
  ('ver_inventario',       'inventario'),
  ('ver_clientes',         'clientes'),
  ('ver_cotizaciones',     'cotizaciones'),
  ('ver_ventas',           'ventas'),
  ('ver_prospectos',       'prospectos'),
  ('ver_asesores',         'asesores'),
  ('ver_contratos',        'contratos'),
  ('ver_cobranzas',        'cobranzas'),
  ('ver_pagos',            'pagos'),
  ('ver_proyeccion',       'proyeccion'),
  ('ver_alertas',          'alertas'),
  ('ver_usuarios',         'usuarios'),
  ('ver_configuracion',    'configuracion'),
  -- Acciones que el catalogo 003 no tenia y que el frontend usa en botones.
  ('crear_cotizaciones',   'cotizaciones'),
  ('editar_cotizaciones',  'cotizaciones'),
  ('crear_prospectos',     'prospectos'),
  ('editar_prospectos',    'prospectos'),
  ('eliminar_prospectos',  'prospectos'),
  ('eliminar_lotes',       'lotes'),
  ('crear_usuarios',       'usuarios'),
  ('editar_usuarios',      'usuarios'),
  ('eliminar_usuarios',    'usuarios'),
  ('crear_etapas',         'etapas'),
  ('editar_etapas',        'etapas'),
  ('eliminar_etapas',      'etapas'),
  ('crear_manzanas',       'manzanas'),
  ('editar_manzanas',      'manzanas'),
  ('eliminar_manzanas',    'manzanas'),
  ('crear_mapas',          'mapas'),
  ('editar_mapas',         'mapas'),
  ('eliminar_mapas',       'mapas'),
  ('crear_inventario',     'inventario'),
  ('editar_inventario',    'inventario'),
  ('eliminar_inventario',  'inventario'),
  ('crear_asesores',       'asesores'),
  ('editar_asesores',      'asesores'),
  ('eliminar_asesores',    'asesores'),
  -- Alcance de datos: quien lo tiene ve todos los registros de la empresa;
  -- quien no, solo ve los suyos (los vinculados a su asesor).
  ('ver_registros_de_todos','general')
ON CONFLICT DO NOTHING;

-- 2) Administrador: todos los permisos (incluye los recien agregados).
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permiso p
WHERE r.nombre_rol = 'Administrador'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- 3) Gerente: supervision + operacion, pero NO administracion (usuarios y
--    configuracion) para distinguirlo del Administrador. Si tiene el
--    alcance amplio (ver_registros_de_todos).
DELETE FROM rol_permiso rp
USING roles r, permiso p
WHERE rp.id_rol = r.id_rol
  AND rp.id_permiso = p.id_permiso
  AND r.nombre_rol = 'Gerente'
  AND p.modulo IN ('usuarios', 'configuracion');

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permiso p
WHERE r.nombre_rol = 'Gerente'
  AND p.modulo NOT IN ('usuarios', 'configuracion')
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- 4) Vendedor: SOLO lo comercial y de ventas. Primero se limpia cualquier
--    permiso previo del rol para que el catalogo quede consistente, y luego
--    se otorgan unicamente los permisos de venta.
DELETE FROM rol_permiso rp
USING roles r
WHERE rp.id_rol = r.id_rol
  AND r.nombre_rol = 'Vendedor';

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
CROSS JOIN permiso p
WHERE r.nombre_rol = 'Vendedor'
  AND p.nombre_permiso IN (
    -- Navegacion basica
    'ver_dashboard',
    -- Comercial / ventas
    'ver_clientes',
    'crear_clientes',
    'editar_clientes',
    'ver_cotizaciones',
    'crear_cotizaciones',
    'editar_cotizaciones',
    'ver_ventas',
    'crear_ventas',
    'ver_prospectos',
    'crear_prospectos',
    'editar_prospectos',
    'eliminar_prospectos',
    'ver_contratos',
    -- Cobranza / pagos de sus ventas
    'ver_cobranzas',
    'registrar_pago',
    'ver_pagos',
    'ver_reportes'
    -- NOTE: NO recibe ver_registros_de_todos, por lo que el frontend le
    -- muestra solo los registros vinculados a su asesor.
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- 5) Mantener las secuencias despues de inserciones con IDs implicitos.
SELECT setval(
  pg_get_serial_sequence('permiso', 'id_permiso'),
  COALESCE((SELECT MAX(id_permiso) FROM permiso), 1),
  true
);
