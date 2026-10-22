-- =============================================
-- 020: PLAN DE PAGO DE LA EMPRESA
-- Ejecutar en Supabase SQL Editor (igual que las demas migraciones).
-- Idempotente: se puede ejecutar mas de una vez.
--
-- Al registrarse como empresa, el usuario elige uno de los planes de
-- pago (Hotmart) y esa eleccion se guarda en la empresa. Valores:
--   'basico' | 'inicial' | 'avanzado'  (NULL = aun no eligio plan)
--
-- Es solo registro de la eleccion: la verificacion del pago se hace en
-- Hotmart, no aca.
-- =============================================

ALTER TABLE empresa ADD COLUMN IF NOT EXISTS plan VARCHAR(50);
