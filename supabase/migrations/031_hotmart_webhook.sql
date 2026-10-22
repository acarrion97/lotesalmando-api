-- =============================================
-- 031: WEBHOOK DE HOTMART (estado de pago de la empresa)
-- Ejecutar en Supabase SQL Editor (igual que las demas migraciones).
-- Idempotente: se puede ejecutar mas de una vez.
--
-- El endpoint vive en Vercel (api/hotmart-webhook.ts) y se registra en
-- Hotmart como "URL para envio de datos". Cuando alguien paga la
-- suscripcion, Hotmart avisa a ese endpoint y aca se guarda el resultado:
--
--   empresa.estado_pago   'pendiente' -> 'pagado' (o 'cancelado' si baja)
--   empresa.pagado_en     cuando se confirmo el pago
--   empresa.transaccion   numero de transaccion de Hotmart
--
-- El registro de la empresa (elegir plan + llenar el formulario) ya guarda
-- la empresa con estado_pago = 'pendiente'; el webhook es quien la pasa a
-- 'pagado' cuando el pago se concreta.
--
-- Seguridad: el endpoint usa la SERVICE_ROLE_KEY (no la anon key), asi que
-- el RLS no lo frena. La bitacora queda sin politicas a proposito: no la
-- puede leer ni escribir nadie desde el navegador.
-- =============================================

-- -------------------------------------------------------------
-- 1) Estado de pago en empresa
-- -------------------------------------------------------------
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS estado_pago TEXT;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS pagado_en TIMESTAMPTZ;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS transaccion_id TEXT;

-- Las empresas que ya existen siguen operando normalmente: no se las marca
-- como deudoras. Solo las altas nuevas arrancan en 'pendiente' (lo define el
-- registro en el frontend). Si preferis marcarlas como pagadas a mano:
--   UPDATE empresa SET estado_pago = 'pagado' WHERE estado_pago IS NULL;
UPDATE empresa SET estado_pago = 'pagado' WHERE estado_pago IS NULL;

DO $$
BEGIN
  ALTER TABLE empresa ADD CONSTRAINT empresa_estado_pago_check
    CHECK (estado_pago IS NULL OR estado_pago IN ('pendiente', 'pagado', 'cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_empresa_estado_pago ON empresa(estado_pago);

-- -------------------------------------------------------------
-- 2) Bitacora de eventos (idempotencia + auditoria)
--    Hotmart puede reenviar el mismo evento: la PK sobre id_evento hace
--    que el segundo intento se descarte sin re-aplicar el cambio.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotmart_evento (
    id_evento TEXT PRIMARY KEY,
    evento TEXT,
    email_comprador TEXT,
    transaccion TEXT,
    resultado TEXT,
    payload JSONB,
    procesado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hotmart_evento ENABLE ROW LEVEL SECURITY;
-- Sin CREATE POLICY a proposito: solo el service_role la toca.

-- -------------------------------------------------------------
-- 3) RPC: encontrar la empresa por el email del comprador
--    El email vive en `usuario`, no en `empresa`, y puede llegar con
--    mayusculas mezcladas desde Hotmart: por eso lower(trim(...)).
--    SECURITY DEFINER: no expone la tabla; solo devuelve el id.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION buscar_empresa_por_email(p_email TEXT)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT u.id_empresa
    FROM usuario u
   WHERE lower(trim(u.email)) = lower(trim(coalesce(p_email, '')))
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION buscar_empresa_por_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION buscar_empresa_por_email(TEXT) TO service_role;
