-- =============================================================
-- Cambio: aceptar-cotizacion-genera-venta
-- Migracion 011
--
-- Orden de aplicacion: correr esta migracion en el SQL Editor de
-- Supabase y desplegar la app enseguida. Entre que se aplica el
-- trigger y llega el deploy, el mapa publico con el codigo viejo
-- (que escribia estado='aceptada' directo) sera rechazado.
--
-- Bloque A = reconciliacion con el schema REAL de produccion
--            (columnas que ya existen alla y no estan en 001).
-- Bloque B = columnas y garantias del cambio.
-- Bloque C = trigger validador + RPC de aceptacion.
-- =============================================================


-- =============================================================
-- BLOQUE A: reconciliacion con produccion
-- Verificado por lectura directa el 30/09/2026: ventas y
-- contratos ya tienen created_at en la BD real; 001 no lo trae.
-- =============================================================

ALTER TABLE ventas    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

UPDATE ventas    SET created_at = now() WHERE created_at IS NULL;
UPDATE contratos SET created_at = now() WHERE created_at IS NULL;


-- =============================================================
-- BLOQUE B: columnas nuevas
-- =============================================================

-- Quien realizo la cotizacion. Anulable: solo es NULL cuando la
-- venta no la registra un asesor (mapa publico, administrador).
ALTER TABLE cotizador
    ADD COLUMN IF NOT EXISTS id_asesor INTEGER
        CONSTRAINT fk_cotizador_asesor REFERENCES asesores(id_asesor) ON DELETE SET NULL;

-- Condiciones de financiamiento capturadas al crear/editar la
-- cotizacion. Los DEFAULT hacen que las filas existentes queden
-- usables (entrada 0, 12 cuotas = la practica actual).
ALTER TABLE cotizador
    ADD COLUMN IF NOT EXISTS monto_entrada DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE cotizador
    ADD COLUMN IF NOT EXISTS num_cuotas INTEGER NOT NULL DEFAULT 12;

-- La venta hereda el asesor de la cotizacion (metricas por asesor).
ALTER TABLE ventas
    ADD COLUMN IF NOT EXISTS id_asesor INTEGER
        CONSTRAINT fk_ventas_asesor REFERENCES asesores(id_asesor) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cotizador_monto_entrada') THEN
        ALTER TABLE cotizador ADD CONSTRAINT chk_cotizador_monto_entrada
            CHECK (monto_entrada >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cotizador_num_cuotas') THEN
        ALTER TABLE cotizador ADD CONSTRAINT chk_cotizador_num_cuotas
            CHECK (num_cuotas >= 1);
    END IF;
END $$;

-- Garantia: una sola venta por cotizacion (los NULL siguen
-- permitidos: las ventas manuales no vienen de cotizacion).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ventas_cotizacion ON ventas(id_cotizacion);

-- El filtro de fechas de Ventas ordena/filtra por esta columna.
CREATE INDEX IF NOT EXISTS idx_ventas_created_at ON ventas(created_at);


-- =============================================================
-- BLOQUE C: trigger validador + RPC de aceptacion
-- =============================================================

-- -------------------------------------------------------------
-- Guarda de integridad: ninguna cotizacion puede quedar en
-- 'aceptada' sin venta asociada, aunque la escritura venga de la
-- importacion masiva o de SQL directo.
-- Es CONSTRAINT + DEFERRED para que la RPC pueda poner el estado
-- y crear la venta en el mismo orden que le convenga: la
-- validacion ocurre al final de la transaccion.
-- -------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_cotizador_aceptada_requiere_venta ON cotizador;

CREATE OR REPLACE FUNCTION public.cotizacion_aceptada_requiere_venta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.estado = 'aceptada'
       AND NOT EXISTS (SELECT 1 FROM ventas v WHERE v.id_cotizacion = NEW.id_cotizacion) THEN
        RAISE EXCEPTION 'La cotizacion % quedo en estado "aceptada" sin venta asociada; use el flujo de aceptacion (rpc aceptar_cotizacion)', NEW.id_cotizacion;
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_cotizador_aceptada_requiere_venta
AFTER INSERT OR UPDATE ON cotizador
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.cotizacion_aceptada_requiere_venta();

-- -------------------------------------------------------------
-- Aceptacion de cotizacion: una sola transaccion que crea la
-- venta, mueve el lote, registra inventario, crea el contrato y
-- genera las cuotas del plan. Devuelve la venta, el contrato y
-- la cantidad de cuotas generadas.
--
-- Reglas del plan (practica actual, ver design.md D4):
--   financiado = precio_ofertado - monto_entrada   (sin interes)
--   cuota      = ceil(financiado / num_cuotas)
--   la ultima cuota absorbe el redondeo
--   primera cuota = hoy + 1 mes, luego mensualidades
-- -------------------------------------------------------------
DROP FUNCTION IF EXISTS public.aceptar_cotizacion(INTEGER, INTEGER);

CREATE FUNCTION public.aceptar_cotizacion(
    p_id_cotizacion INTEGER,
    p_id_usuario INTEGER
)
RETURNS TABLE (
    venta_id INTEGER,
    contrato_id INTEGER,
    cuotas_generadas INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cot RECORD;
    v_estado_anterior VARCHAR(50);
    v_id_venta INTEGER;
    v_id_contrato INTEGER;
    v_financiado DECIMAL(15,2);
    v_cuota DECIMAL(15,2);
    v_fecha_base DATE;
    v_i INTEGER;
BEGIN
    IF p_id_usuario IS NULL THEN
        RAISE EXCEPTION 'Debe indicarse el usuario que registra la venta';
    END IF;

    SELECT c.id_cliente,
           c.id_lote,
           c.precio_ofertado,
           c.monto_entrada,
           c.num_cuotas,
           c.id_asesor,
           c.estado
      INTO v_cot
      FROM cotizador c
     WHERE c.id_cotizacion = p_id_cotizacion
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cotizacion % no existe', p_id_cotizacion;
    END IF;

    IF v_cot.estado = 'aceptada' THEN
        RAISE EXCEPTION 'La cotizacion % ya fue aceptada', p_id_cotizacion;
    END IF;

    IF EXISTS (SELECT 1 FROM ventas v WHERE v.id_cotizacion = p_id_cotizacion) THEN
        RAISE EXCEPTION 'La cotizacion % ya tiene una venta asociada', p_id_cotizacion;
    END IF;

    IF v_cot.monto_entrada >= v_cot.precio_ofertado THEN
        RAISE EXCEPTION 'La entrada (%) debe ser menor al precio ofertado (%)', v_cot.monto_entrada, v_cot.precio_ofertado;
    END IF;

    IF v_cot.num_cuotas < 1 THEN
        RAISE EXCEPTION 'El numero de cuotas (%) debe ser al menos 1', v_cot.num_cuotas;
    END IF;

    SELECT l.estado
      INTO v_estado_anterior
      FROM lotes l
     WHERE l.id_lote = v_cot.id_lote
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El lote % no existe', v_cot.id_lote;
    END IF;

    -- 1. Venta (el asesor se hereda de la cotizacion).
    INSERT INTO ventas (id_cliente, id_lote, id_cotizacion, id_usuario, precio_final, estado, id_asesor)
    VALUES (v_cot.id_cliente, v_cot.id_lote, p_id_cotizacion, p_id_usuario,
            v_cot.precio_ofertado, 'completada', v_cot.id_asesor)
    RETURNING id_venta INTO v_id_venta;

    -- 2. Lote + traza de inventario.
    UPDATE lotes SET estado = 'vendido' WHERE id_lote = v_cot.id_lote;

    INSERT INTO inventario (id_lote, id_usuario, estado_anterior, estado_nuevo)
    VALUES (v_cot.id_lote, p_id_usuario, v_estado_anterior, 'vendido');

    -- 3. Contrato (numero con el mismo formato C-<epoch ms> que ya usan los datos existentes).
    INSERT INTO contratos (id_venta, numero_contrato, monto_total)
    VALUES (v_id_venta,
            'C-' || ((extract(epoch FROM now()) * 1000)::bigint)::text,
            v_cot.precio_ofertado)
    RETURNING id_contrato INTO v_id_contrato;

    -- 4. La cotizacion queda aceptada (el trigger diferido valida al commit,
    --    cuando la venta ya existe).
    UPDATE cotizador SET estado = 'aceptada' WHERE id_cotizacion = p_id_cotizacion;

    -- 5. Plan de cuotas.
    v_financiado := v_cot.precio_ofertado - v_cot.monto_entrada;
    v_cuota := ceil(v_financiado / v_cot.num_cuotas);
    v_fecha_base := CURRENT_DATE;

    FOR v_i IN 1..v_cot.num_cuotas LOOP
        INSERT INTO cobranzas (id_contrato, numero_cuota, monto_cuota, estado, fecha_vencimiento)
        VALUES (
            v_id_contrato,
            v_i,
            CASE WHEN v_i = v_cot.num_cuotas
                 THEN v_financiado - (v_cuota * (v_cot.num_cuotas - 1))
                 ELSE v_cuota
            END,
            'pendiente',
            (v_fecha_base + make_interval(months => v_i))::date
        );
    END LOOP;

    RETURN QUERY SELECT v_id_venta, v_id_contrato, v_cot.num_cuotas;
END;
$$;

-- -------------------------------------------------------------
-- Permisos: la app interna usa el rol authenticated (login con
-- password) y el mapa publico opera con anon, asi que ambos
-- necesitan EXECUTE, igual que mapa_publico/usuario_invitado.
-- -------------------------------------------------------------
REVOKE ALL ON FUNCTION public.aceptar_cotizacion(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aceptar_cotizacion(INTEGER, INTEGER) TO anon, authenticated;
