-- =============================================
-- 033: BITACORA DE AUDITORIA (`audit_logs`)
-- Ejecutar en Supabase SQL Editor (igual que las demas migraciones).
-- Idempotente: se puede ejecutar mas de una vez.
--
-- Objeto AUXILIAR que la API del backend necesita y que no crean las
-- migraciones del frontend (el esquema de negocio —empresa, proyectos,
-- lotes, cotizador, ventas, cobranzas…— ya existe y NO se toca).
--
-- Mientras la tabla no exista, la API opera igual y solo omite el registro
-- de auditoria (services/audit.service.ts avisa UNA vez en consola).
-- =============================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id_audit_log  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  accion        text NOT NULL CHECK (accion IN ('CREATE', 'UPDATE', 'DELETE', 'REGISTER', 'LOGIN')),
  tabla         text NOT NULL,
  registro_id   text,
  auth_user_id  uuid,
  usuario_id    bigint,
  empresa_id    bigint,
  detalles      jsonb,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_empresa ON public.audit_logs (empresa_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tabla   ON public.audit_logs (tabla);
CREATE INDEX IF NOT EXISTS idx_audit_logs_creado  ON public.audit_logs (creado_en DESC);

-- La bitacora solo se escribe desde el backend (service role): sin politicas
-- RLS, el anon/authenticated no tiene acceso.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
