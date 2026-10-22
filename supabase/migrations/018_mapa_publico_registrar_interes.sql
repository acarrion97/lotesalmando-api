-- =============================================
-- 018: REGISTRO DE INTERES DESDE EL MAPA PUBLICO
-- Ejecutar en Supabase SQL Editor (igual que las demas migraciones).
-- Idempotente: se puede ejecutar mas de una vez.
--
-- El visitante de /mapa/:slug abre el modal de la calculadora y, si le
-- interesa el lote, deja su nombre, email y telefono. La funcion crea (o
-- reusa) el prospecto y arma la oportunidad prospecto<->lote en una sola
-- transaccion, sin sesion: es la puerta de escritura para el rol `anon`
-- del mapa publico, igual que `mapa_publico` lo es de lectura (010).
--
-- Reglas:
--   * el lote debe pertenecer al proyecto del slug (nada de ids a mano);
--   * se deduplica por email dentro de la empresa: si ya existe el
--     prospecto se reutiliza y no se pierde su lugar en el pipeline (salvo
--     "perdido", que se reactiva a "nuevo" porque hay interes fresco);
--   * no se duplica la oportunidad si ya existe para ese mismo lote;
--   * no toca el lote: registrar interes no reserva nada.
-- =============================================

CREATE OR REPLACE FUNCTION public.mapa_publico_registrar_interes(
    p_slug TEXT,
    p_id_lote INTEGER,
    p_nombres TEXT,
    p_email TEXT,
    p_telefono TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id_empresa INTEGER;
    v_id_proyecto INTEGER;
    v_nombre_proyecto TEXT;
    v_lote RECORD;
    v_prospecto RECORD;
    v_id_prospecto INTEGER;
    v_id_oportunidad INTEGER;
    v_reutilizado BOOLEAN := FALSE;
    v_nombres TEXT := COALESCE(trim(p_nombres), '');
    v_email TEXT := COALESCE(lower(trim(p_email)), '');
    v_telefono TEXT := COALESCE(trim(p_telefono), '');
BEGIN
    -- El proyecto (y por lo tanto la empresa) se resuelven por el slug
    -- publico: el navegador nunca recibe ni envia id_empresa.
    SELECT p.id_empresa, p.id_proyecto, p.nombre
      INTO v_id_empresa, v_id_proyecto, v_nombre_proyecto
      FROM mapas m
      JOIN proyectos p ON p.id_proyecto = m.id_proyecto
     WHERE m.slug IS NOT NULL
       AND lower(m.slug) = lower(COALESCE(p_slug, ''))
     LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El mapa solicitado no existe';
    END IF;

    IF length(v_nombres) < 2 THEN
        RAISE EXCEPTION 'Ingrese su nombre';
    END IF;
    IF v_email = '' OR position('@' IN v_email) = 0 THEN
        RAISE EXCEPTION 'Ingrese un email valido';
    END IF;
    IF length(v_telefono) < 5 THEN
        RAISE EXCEPTION 'Ingrese un telefono valido';
    END IF;

    -- El lote tiene que vivir en este proyecto: sin esto, cualquiera con la
    -- anon key podria colgar una oportunidad de un lote ajeno al slug.
    SELECT l.id_lote, l.numero_lote, l.precio_lista, l.estado
      INTO v_lote
      FROM lotes l
      JOIN manzana_bloque mb ON mb.id_manzana = l.id_manzana
      JOIN etapas e ON e.id_etapa = mb.id_etapa
     WHERE l.id_lote = p_id_lote
       AND e.id_proyecto = v_id_proyecto;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El lote no pertenece a este proyecto';
    END IF;

    -- Dedupe por email (case-insensitive) dentro de la empresa.
    SELECT id_prospecto, telefono, estado
      INTO v_prospecto
      FROM prospectos
     WHERE id_empresa = v_id_empresa
       AND lower(email) = v_email
     ORDER BY id_prospecto
     LIMIT 1;

    IF FOUND THEN
        v_id_prospecto := v_prospecto.id_prospecto;
        v_reutilizado := TRUE;

        IF COALESCE(v_prospecto.telefono, '') = '' THEN
            UPDATE prospectos
               SET telefono = v_telefono, updated_at = now()
             WHERE id_prospecto = v_id_prospecto;
        END IF;

        -- Un "perdido" que vuelve a escribirse desde el mapa esta tibio:
        -- se reactiva para que no se pierda en el pipeline.
        IF v_prospecto.estado = 'perdido' THEN
            UPDATE prospectos
               SET estado = 'nuevo', updated_at = now()
             WHERE id_prospecto = v_id_prospecto;
        END IF;
    ELSE
        INSERT INTO prospectos (id_empresa, id_asesor, nombres, email, telefono, origen, estado, notas)
        VALUES (v_id_empresa, NULL, v_nombres, trim(p_email), v_telefono, 'mapa publico', 'nuevo',
                'Registrado desde el mapa publico: ' || v_nombre_proyecto ||
                ' (lote ' || v_lote.numero_lote || ')')
        RETURNING id_prospecto INTO v_id_prospecto;
    END IF;

    -- Oportunidad prospecto<->lote; si ya existe la de este lote, se reusa.
    SELECT id_oportunidad
      INTO v_id_oportunidad
      FROM oportunidades
     WHERE id_empresa = v_id_empresa
       AND id_prospecto = v_id_prospecto
       AND id_lote = p_id_lote
     ORDER BY id_oportunidad
     LIMIT 1;

    IF NOT FOUND THEN
        INSERT INTO oportunidades (id_empresa, id_prospecto, id_lote, etapa, valor_estimado, notas)
        VALUES (v_id_empresa, v_id_prospecto, p_id_lote, 'interesado', v_lote.precio_lista,
                'Interes registrado desde el mapa publico')
        RETURNING id_oportunidad INTO v_id_oportunidad;
    END IF;

    RETURN json_build_object(
        'id_prospecto', v_id_prospecto,
        'id_oportunidad', v_id_oportunidad,
        'reutilizado', v_reutilizado
    );
END;
$$;

-- Permisos: el mapa publico opera con anon (sin sesion) y la app interna
-- con authenticated, igual que mapa_publico / aceptar_cotizacion.
REVOKE ALL ON FUNCTION public.mapa_publico_registrar_interes(TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mapa_publico_registrar_interes(TEXT, INTEGER, TEXT, TEXT, TEXT) TO anon, authenticated;
