-- =============================================
-- Seed Data - Lotes al Mando
-- Ejecutar DESPUÉS del schema
-- =============================================

-- Empresa de prueba (id=1)
INSERT INTO empresa (razon_social, ruc, estado)
VALUES ('Constructora del Norte', '1792345678001', 'activo')
ON CONFLICT DO NOTHING;

-- Configuración de empresa
INSERT INTO configuracion (id_empresa, moneda, idioma)
VALUES (1, 'USD', 'es')
ON CONFLICT DO NOTHING;

-- Proyectos de prueba
INSERT INTO proyectos (id_empresa, nombre)
VALUES (1, 'Proyecto Valle Verde')
ON CONFLICT DO NOTHING;

INSERT INTO proyectos (id_empresa, nombre)
VALUES (1, 'Proyecto Los Pinos')
ON CONFLICT DO NOTHING;

-- Etapas para Valle Verde
INSERT INTO etapas (id_proyecto, nombre, orden)
VALUES (1, 'Etapa 1 - Residencial', 1)
ON CONFLICT DO NOTHING;

INSERT INTO etapas (id_proyecto, nombre, orden)
VALUES (1, 'Etapa 2 - Comercial', 2)
ON CONFLICT DO NOTHING;

-- Manzanas para Etapa 1
INSERT INTO manzana_bloque (id_etapa, nombre_codigo)
VALUES (1, 'MZA-A')
ON CONFLICT DO NOTHING;

INSERT INTO manzana_bloque (id_etapa, nombre_codigo)
VALUES (1, 'MZA-B')
ON CONFLICT DO NOTHING;

-- Lotes para Manzana A
INSERT INTO lotes (id_manzana, numero_lote, precio_lista, estado)
VALUES (1, 'L-001', 45000.00, 'disponible')
ON CONFLICT DO NOTHING;

INSERT INTO lotes (id_manzana, numero_lote, precio_lista, estado)
VALUES (1, 'L-002', 52000.00, 'reservado')
ON CONFLICT DO NOTHING;

INSERT INTO lotes (id_manzana, numero_lote, precio_lista, estado)
VALUES (1, 'L-003', 48000.00, 'vendido')
ON CONFLICT DO NOTHING;

INSERT INTO lotes (id_manzana, numero_lote, precio_lista, estado)
VALUES (1, 'L-004', 55000.00, 'disponible')
ON CONFLICT DO NOTHING;

INSERT INTO lotes (id_manzana, numero_lote, precio_lista, estado)
VALUES (1, 'L-005', 49000.00, 'disponible')
ON CONFLICT DO NOTHING;

-- Lotes para Manzana B
INSERT INTO lotes (id_manzana, numero_lote, precio_lista, estado)
VALUES (2, 'L-001', 62000.00, 'disponible')
ON CONFLICT DO NOTHING;

INSERT INTO lotes (id_manzana, numero_lote, precio_lista, estado)
VALUES (2, 'L-002', 58000.00, 'en_negociacion')
ON CONFLICT DO NOTHING;

INSERT INTO lotes (id_manzana, numero_lote, precio_lista, estado)
VALUES (2, 'L-003', 65000.00, 'disponible')
ON CONFLICT DO NOTHING;

-- =============================================
-- Para probar el login, crear usuario en Supabase Auth primero:
-- 1. Ve a Supabase > Authentication > Users
-- 2. Crea un usuario con email "admin@lotes.com" y contraseña "Admin123"
-- 3. Luego ejecuta esto para vincularlo a la empresa:
-- =============================================

-- Descomenta y ejecuta después de crear el usuario en Auth:
-- INSERT INTO usuario (id_empresa, nombres, email, estado)
-- VALUES (1, 'Administrador', 'admin@lotes.com', 'activo')
-- ON CONFLICT (id_empresa, email) DO NOTHING;
