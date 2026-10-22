-- ------------------------------------------------------------
-- 017: telefono del cliente
-- ------------------------------------------------------------
-- El prospecto lleva telefono pero el cliente no, asi que al convertir un
-- prospecto en reserva (o al dar de alta un cliente desde cualquier flujo)
-- ese dato se perdia. Columna opcional: los clientes existentes siguen
-- siendo validos sin ella.
-- Idempotente: se puede ejecutar mas de una vez en el SQL Editor.
--
-- Ejecutar en el SQL Editor de Supabase (igual que las demas migraciones).
-- ------------------------------------------------------------

ALTER TABLE cliente ADD COLUMN IF NOT EXISTS telefono VARCHAR(50);
