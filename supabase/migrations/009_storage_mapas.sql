-- ============================================================
-- 009: STORAGE PARA PLANOS DE PROYECTOS (tabla `mapas`)
-- ============================================================
-- La app sube un plano/imagen por proyecto desde la pantalla de
-- Configuracion y guarda la URL publica en mapas.url_publica.
--
-- Ejecutar en el SQL Editor de Supabase (igual que las demas migraciones).
--
-- Nota: 008 desactivo RLS en las tablas, NO en storage.objects (otra
-- relacion). El bucket se crea publico (lectura por URL firmada con la
-- ruta) y se agregan politicas para que el rol `authenticated` pueda
-- subir, reemplazar y borrar sus propias imagenes.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mapas',
  'mapas',
  true,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura (el bucket es publico, esta politica es defensiva)
DROP POLICY IF EXISTS mapas_select ON storage.objects;
CREATE POLICY mapas_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'mapas');

-- Subida
DROP POLICY IF EXISTS mapas_insert ON storage.objects;
CREATE POLICY mapas_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mapas');

-- Reemplazo (upsert de un plano existente)
DROP POLICY IF EXISTS mapas_update ON storage.objects;
CREATE POLICY mapas_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mapas')
  WITH CHECK (bucket_id = 'mapas');

-- Borrado (al quitar o reemplazar un plano)
DROP POLICY IF EXISTS mapas_delete ON storage.objects;
CREATE POLICY mapas_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mapas');
