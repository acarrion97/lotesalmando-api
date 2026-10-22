-- =============================================
-- ROLLBACK DE EMERGENCIA: desactiva RLS temporalmente
-- Ejecutar en Supabase SQL Editor
--
-- CONTEXTO: al probar 006_row_level_security.sql en vivo se descubrio
-- que las politicas RLS no funcionan como deberian en este proyecto -
-- ni para lecturas ni para escrituras, con el rol `authenticated`,
-- incluso en una tabla de prueba nueva y descartable con una politica
-- trivial (`WITH CHECK (true)`). Se probo exhaustivamente: la politica
-- esta bien definida (confirmado via pg_policy), el rol cambia
-- correctamente (confirmado via current_user), la firma del JWT es
-- valida y coincide con la clave de firma actual del proyecto, no hay
-- triggers ni ambiguedad de schema de por medio. Con RLS desactivado
-- el INSERT funciona. Con RLS activado, SIEMPRE falla, incluso para un
-- usuario real logueado normalmente. Esto rompio la app entera para
-- cualquier usuario autenticado (dashboard vacio, no se pueden crear
-- proyectos, etc.) - mas grave que la vulnerabilidad original.
--
-- Esta migracion desactiva RLS en las mismas 22 tablas donde
-- 006_row_level_security.sql lo activo, PERO NO borra las policies
-- (quedan definidas, solo inactivas) - reactivar es tan simple como
-- volver a correr los `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
-- una vez resuelta la causa raiz (probablemente requiere soporte de
-- Supabase, dado que hasta una tabla de prueba nueva sin ninguna
-- relacion con el resto del schema reproduce el mismo error).
--
-- ADVERTENCIA: esto reabre la vulnerabilidad original (cualquiera con
-- la anon key puede leer/escribir cualquier fila de cualquier
-- empresa). Se acepta como mal menor frente a tener la app rota.
-- =============================================

ALTER TABLE empresa DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion DISABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos DISABLE ROW LEVEL SECURITY;
ALTER TABLE mapas DISABLE ROW LEVEL SECURITY;
ALTER TABLE etapas DISABLE ROW LEVEL SECURITY;
ALTER TABLE manzana_bloque DISABLE ROW LEVEL SECURITY;
ALTER TABLE lotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuario DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventario DISABLE ROW LEVEL SECURITY;
ALTER TABLE cotizador DISABLE ROW LEVEL SECURITY;
ALTER TABLE ventas DISABLE ROW LEVEL SECURITY;
ALTER TABLE contratos DISABLE ROW LEVEL SECURITY;
ALTER TABLE cobranzas DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos DISABLE ROW LEVEL SECURITY;
ALTER TABLE prospectos DISABLE ROW LEVEL SECURITY;
ALTER TABLE oportunidades DISABLE ROW LEVEL SECURITY;
ALTER TABLE actividades DISABLE ROW LEVEL SECURITY;
ALTER TABLE asesores DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE permiso DISABLE ROW LEVEL SECURITY;
ALTER TABLE rol_permiso DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_rol DISABLE ROW LEVEL SECURITY;
