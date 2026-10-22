-- ------------------------------------------------------------
-- 015: mapa publico con superficie y medidas del lote
-- ------------------------------------------------------------
-- NO crea columnas ni indices: usa las columnas que ya existen en
-- `lotes` (superficie_m2, medidas). Solo reemplaza la funcion
-- mapa_publico para que devuelva esos dos campos por lote.
-- (El codigo catastral queda fuera del endpoint anonimo a proposito.)
-- Idempotente: se puede ejecutar mas de una vez en el SQL Editor.
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
    'moneda', COALESCE(c.moneda, 'USD'),
    'lotes', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id_lote', l.id_lote,
          'id_manzana', l.id_manzana,
          'numero_lote', l.numero_lote,
          'estado', l.estado,
          'manzana', mb.nombre_codigo,
          'precio_lista', l.precio_lista,
          'superficie_m2', l.superficie_m2,
          'medidas', l.medidas,
          'poligono', l.poligono
        )
        ORDER BY mb.nombre_codigo, l.numero_lote
      )
      FROM etapas e
      JOIN manzana_bloque mb ON mb.id_etapa = e.id_etapa
      JOIN lotes l ON l.id_manzana = mb.id_manzana
      WHERE e.id_proyecto = p.id_proyecto
    ), '[]'::json),
    'medios', COALESCE((
      SELECT json_agg(
        json_build_object('url', pm.url, 'tipo', pm.tipo)
        ORDER BY pm.orden DESC, pm.id_proyecto_medio DESC
      )
      FROM proyecto_medios pm
      WHERE pm.id_proyecto = p.id_proyecto
    ), '[]'::json),
    'estadisticas', (
      SELECT json_build_object(
        'total', count(*),
        'disponibles', count(*) FILTER (WHERE l.estado = 'disponible'),
        'reservados', count(*) FILTER (WHERE l.estado = 'reservado'),
        'vendidos', count(*) FILTER (WHERE l.estado = 'vendido')
      )
      FROM etapas e
      JOIN manzana_bloque mb ON mb.id_etapa = e.id_etapa
      JOIN lotes l ON l.id_manzana = mb.id_manzana
      WHERE e.id_proyecto = p.id_proyecto
    )
  )
  FROM mapas m
  JOIN proyectos p ON p.id_proyecto = m.id_proyecto
  LEFT JOIN configuracion c ON c.id_empresa = p.id_empresa
  WHERE m.slug IS NOT NULL
    AND lower(m.slug) = lower(p_slug)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.mapa_publico(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mapa_publico(TEXT) TO anon, authenticated;
