-- ------------------------------------------------------------
-- 013: amplia el limite de video del bucket `medios` a 1 GB
-- ------------------------------------------------------------
-- Ejecutar en el SQL Editor. Ademas hay que subir el limite GLOBAL en
-- Dashboard > Storage > Settings > "Upload file size limit": el plan Free
-- lo topea en 50 MB y hace falta plan Pro o superior para pasar de ahi.
-- El limite del bucket nunca puede superar al global.

UPDATE storage.buckets
SET file_size_limit = 1073741824 -- 1 GB
WHERE id = 'medios';
