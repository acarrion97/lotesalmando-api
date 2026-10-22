-- =============================================
-- 019: CLIENTE PERTENECE A UNA EMPRESA
-- Ejecutar en Supabase SQL Editor (igual que las demas migraciones).
-- Idempotente: se puede ejecutar mas de una vez.
--
-- `cliente` nunca tuvo id_empresa: para saber de quien era un cliente se
-- miraban las ventas y cotizaciones de sus lotes, y por eso el selector de
-- cotizacion tenia que listar TODOS los clientes de TODAS las empresas (y un
-- cliente creado al reservar no aparecia en el modulo hasta que vendia).
--
-- Con la columna, el alcance por empresa es directo y los clientes creados
-- al reservar o desde el mapa ya nacen en la empresa correcta.
--
-- Backfill en tres pasadas (el orden importa):
--   1. clientes con ventas        -> empresa del lote vendido;
--   2. los que quedaron sin empresa y tienen cotizacion -> empresa del lote;
--   3. los que quedaron sin empresa y comparten email con un prospecto
--      (asi entran tambien los creados durante una reserva de prospecto).
-- Un cliente con actividad en dos empresas distintas queda con una de ellas
-- (la primera que matchee); es un caso borde sin historial real.
-- =============================================

ALTER TABLE cliente ADD COLUMN IF NOT EXISTS id_empresa INTEGER
    REFERENCES empresa(id_empresa);

CREATE INDEX IF NOT EXISTS idx_cliente_empresa ON cliente(id_empresa);

-- 1. Por ventas.
UPDATE cliente c
   SET id_empresa = p.id_empresa
  FROM ventas v
  JOIN lotes l ON l.id_lote = v.id_lote
  JOIN manzana_bloque mb ON mb.id_manzana = l.id_manzana
  JOIN etapas e ON e.id_etapa = mb.id_etapa
  JOIN proyectos p ON p.id_proyecto = e.id_proyecto
 WHERE c.id_cliente = v.id_cliente
   AND c.id_empresa IS NULL;

-- 2. Por cotizaciones.
UPDATE cliente c
   SET id_empresa = p.id_empresa
  FROM cotizador ct
  JOIN lotes l ON l.id_lote = ct.id_lote
  JOIN manzana_bloque mb ON mb.id_manzana = l.id_manzana
  JOIN etapas e ON e.id_etapa = mb.id_etapa
  JOIN proyectos p ON p.id_proyecto = e.id_proyecto
 WHERE c.id_cliente = ct.id_cliente
   AND c.id_empresa IS NULL;

-- 3. Por email compartido con un prospecto (reservas de prospectos).
UPDATE cliente c
   SET id_empresa = pr.id_empresa
  FROM prospectos pr
 WHERE c.id_empresa IS NULL
   AND c.email IS NOT NULL
   AND lower(c.email) = lower(pr.email);
