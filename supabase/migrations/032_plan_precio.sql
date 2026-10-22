-- =============================================
-- 032: PRECIO EN PLANES (`plan.precio`)
-- Ejecutar en Supabase SQL Editor (igual que las demas migraciones).
-- Idempotente: se puede ejecutar mas de una vez.
--
-- La pagina de eleccion de plan (/registro/planes) muestra el precio
-- mensual de cada plan en USD. Si la columna ya existe (alta manual),
-- ADD COLUMN IF NOT EXISTS no la toca; abajo solo se rellena el precio
-- de los 3 planes conocidos cuando quedo vacio, sin pisar lo que el
-- superadmin haya configurado desde /planes.
-- =============================================

ALTER TABLE plan ADD COLUMN IF NOT EXISTS precio NUMERIC(10,2);

-- Precios vigentes en Hotmart (USD por mes).
UPDATE plan SET precio = 53  WHERE clave = 'basico'  AND precio IS NULL;
UPDATE plan SET precio = 89  WHERE clave = 'inicial' AND precio IS NULL;
UPDATE plan SET precio = 129 WHERE clave = 'avanzado' AND precio IS NULL;
