-- ============================================================
-- 010: POLIGONOS DE LOTES SOBRE EL PLANO + MAPA PUBLICO
-- ============================================================
-- * lotes.poligono: contorno del lote sobre la imagen del plano del
--   proyecto, como JSON [[x, y], ...] con x/y normalizados a 0..1
--   (fraccion del ancho/alto de la imagen). Asi el dibujo sobrevive a
--   que se reemplace el plano por otra resolucion de la misma imagen.
-- * mapas.slug: si tiene valor, el plano se ve sin sesion en /mapa/<slug>.
-- * mapa_publico(slug): unica puerta de lectura para el rol `anon`.
--   SECURITY DEFINER y solo devuelve nombre del proyecto, URL del
--   plano y numero/estado/manzana/poligono de cada lote (sin precios
--   ni clientes).
--
-- Ejecutar en el SQL Editor de Supabase (igual que las demas migraciones).
-- ============================================================

ALTER TABLE lotes ADD COLUMN IF NOT EXISTS poligono JSONB;

ALTER TABLE mapas ADD COLUMN IF NOT EXISTS slug VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS mapas_slug_unique
  ON mapas (lower(slug))
  WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mapa_publico(p_slug TEXT)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'proyecto', p.nombre,
    'url_publica', m.url_publica,
    'lotes', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id_lote', l.id_lote,
          'id_manzana', l.id_manzana,
          'numero_lote', l.numero_lote,
          'estado', l.estado,
          'manzana', mb.nombre_codigo,
          'poligono', l.poligono
        )
        ORDER BY mb.nombre_codigo, l.numero_lote
      )
      FROM etapas e
      JOIN manzana_bloque mb ON mb.id_etapa = e.id_etapa
      JOIN lotes l ON l.id_manzana = mb.id_manzana
      WHERE e.id_proyecto = p.id_proyecto
        AND l.poligono IS NOT NULL
    ), '[]'::json)
  )
  FROM mapas m
  JOIN proyectos p ON p.id_proyecto = m.id_proyecto
  WHERE m.slug IS NOT NULL
    AND lower(m.slug) = lower(p_slug)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.mapa_publico(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mapa_publico(TEXT) TO anon, authenticated;

-- El bucket `mapas` (009) ya es publico: la imagen se sirve por URL
-- sin sesion, asi que el visitante anonimo puede ver el plano.
