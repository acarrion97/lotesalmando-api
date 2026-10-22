-- =============================================
-- Fix: cobranzas.fecha_vencimiento
-- Ejecutar en Supabase SQL Editor
--
-- Motivo: el motor de cartera/cobranzas (GenerarAlertasUseCase,
-- DetectarCuotasVencidasUseCase) no tenia ninguna columna de fecha
-- de vencimiento contra la cual comparar, asi que:
--   - la alerta "cartera por vencer" nunca se disparaba (comparaba
--     created_at, que siempre es pasado, contra una ventana futura)
--   - "Detectar vencidas" marcaba como vencida CUALQUIER cuota
--     pendiente, sin importar si en verdad ya vencio
--
-- IMPORTANTE: la tabla `cobranzas` no esta definida en las
-- migraciones trackeadas (se creo directo en el dashboard de
-- Supabase), asi que antes de correr el backfill confirma con
--   SELECT * FROM cobranzas LIMIT 1;
-- que la columna `created_at` existe tal como se espera.
-- =============================================

-- 1. Agregar la columna (nullable primero, para poder hacer backfill)
ALTER TABLE cobranzas ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- 2. Backfill de filas existentes (datos de demo reales, no se borran):
--    fecha_vencimiento = fecha de creacion de la cuota + numero_cuota meses
--    (aproximacion razonable: las 12 cuotas de un contrato se crean casi
--    al mismo tiempo que el contrato, en el mismo flujo de venta)
UPDATE cobranzas
SET fecha_vencimiento = (created_at::date + (numero_cuota || ' months')::interval)::date
WHERE fecha_vencimiento IS NULL;

-- 3. Una vez verificado el backfill, hacer la columna obligatoria
ALTER TABLE cobranzas ALTER COLUMN fecha_vencimiento SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cobranzas_fecha_vencimiento ON cobranzas(fecha_vencimiento);
