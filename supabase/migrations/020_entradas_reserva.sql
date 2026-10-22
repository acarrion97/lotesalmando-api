-- ------------------------------------------------------------
-- 020: entrada (sena) cobrada al reservar un lote
-- ------------------------------------------------------------
-- Al confirmar la reserva de un lote ahora se puede cobrar una entrada
-- (pago real). La reserva no crea venta/contrato/cuota, asi que no puede
-- apuntar a una cobranza como los pagos normales: se registra aparte,
-- ligada al lote y al prospecto que reservo.
--
-- Columnas:
--   id_lote       lote reservado (obligatorio).
--   id_prospecto  prospecto que reservo; opcional por si la reserva se
--                 hiciera sin prospecto en el futuro.
--   id_empresa    denormalizado para poder filtrar por tenant sin recorrer
--                 la cadena lote->manzana->etapa->proyecto->empresa.
--   monto         importe cobrado, debe ser mayor a 0.
--
-- Idempotente: se puede ejecutar mas de una vez en el SQL Editor.
--
-- Ejecutar en el SQL Editor de Supabase (igual que las demas migraciones).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entradas_reserva (
  id_entrada   BIGSERIAL PRIMARY KEY,
  id_lote      BIGINT NOT NULL REFERENCES lotes(id_lote) ON DELETE CASCADE,
  id_prospecto BIGINT REFERENCES prospectos(id_prospecto) ON DELETE SET NULL,
  id_empresa   BIGINT REFERENCES empresa(id_empresa) ON DELETE SET NULL,
  id_usuario   BIGINT NOT NULL REFERENCES usuario(id_usuario),
  monto        NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha_pago   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Facilita el listado de entradas de un lote (p. ej. para reversar o auditar).
CREATE INDEX IF NOT EXISTS idx_entradas_reserva_lote ON entradas_reserva(id_lote);
-- Facilita el listado por tenant.
CREATE INDEX IF NOT EXISTS idx_entradas_reserva_empresa ON entradas_reserva(id_empresa);
