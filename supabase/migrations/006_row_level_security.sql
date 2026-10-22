-- =============================================
-- Row Level Security por empresa
-- Ejecutar en Supabase SQL Editor
--
-- CONTEXTO: se confirmo que ninguna tabla del schema tenia RLS
-- habilitado (pg_policies vacio, relrowsecurity=false en todas).
-- Con la anon key publica del frontend, cualquiera puede hoy leer o
-- escribir cualquier fila de cualquier empresa via la API REST, sin
-- login. Esta migracion cierra ese hueco.
--
-- IMPORTANTE - LEER ANTES DE CORRER:
-- 1. El login/registro (`AuthProvider.tsx`) vincula la sesion de
--    Supabase Auth a la tabla `usuario` por EMAIL (no hay columna
--    UUID). Las politicas de `usuario` estan escritas para no romper
--    ese flujo (bootstrap de auto-registro + alta manual de colegas).
-- 2. Las politicas apuntan a "TO authenticated" - un usuario anonimo
--    (sin login) no vera nada en ninguna tabla de negocio despues de
--    esto. Eso es intencional.
-- 3. Probar en este orden despues de correr:
--    a) Login con un usuario existente -> confirmar que el dashboard,
--       lotes, cobranzas, etc. siguen cargando datos.
--    b) Registrar una cuenta nueva (/registro) -> confirmar que se
--       crea su fila en `usuario` y puede loguearse despues.
--    c) Si tenes una segunda empresa+usuario, loguearse con ese y
--       confirmar que NO ve datos de la primera empresa.
-- 4. Rollback rapido si algo se rompe (correrlo tabla por tabla o
--    todas juntas): ALTER TABLE <tabla> DISABLE ROW LEVEL SECURITY;
--
-- LIMITACION CONOCIDA: `cliente` no tiene columna id_empresa en el
-- schema real (ver 001_initial_schema.sql), asi que no se puede
-- aislar por empresa sin antes agregar esa columna y decidir como
-- hacer el backfill (un cliente podria en teoria tener cotizaciones
-- con mas de una empresa). Se deja `cliente` sin RLS por ahora -
-- mismo comportamiento que tiene hoy, no es una regresion. Pendiente
-- de decision del usuario.
-- =============================================

-- =========================================================
-- FUNCIONES HELPER (SECURITY DEFINER para evitar recursion de RLS
-- al consultar `usuario` desde dentro de sus propias politicas)
-- =========================================================

CREATE OR REPLACE FUNCTION current_empresa_id()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id_empresa FROM usuario WHERE email = auth.email() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION usuario_empresa_id(p_id_usuario INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id_empresa FROM usuario WHERE id_usuario = p_id_usuario;
$$;

CREATE OR REPLACE FUNCTION proyecto_empresa_id(p_id_proyecto INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id_empresa FROM proyectos WHERE id_proyecto = p_id_proyecto;
$$;

CREATE OR REPLACE FUNCTION etapa_empresa_id(p_id_etapa INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id_empresa FROM etapas e JOIN proyectos p ON p.id_proyecto = e.id_proyecto
  WHERE e.id_etapa = p_id_etapa;
$$;

CREATE OR REPLACE FUNCTION manzana_empresa_id(p_id_manzana INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id_empresa
  FROM manzana_bloque mb
  JOIN etapas e ON e.id_etapa = mb.id_etapa
  JOIN proyectos p ON p.id_proyecto = e.id_proyecto
  WHERE mb.id_manzana = p_id_manzana;
$$;

CREATE OR REPLACE FUNCTION lote_empresa_id(p_id_lote INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id_empresa
  FROM lotes l
  JOIN manzana_bloque mb ON mb.id_manzana = l.id_manzana
  JOIN etapas e ON e.id_etapa = mb.id_etapa
  JOIN proyectos p ON p.id_proyecto = e.id_proyecto
  WHERE l.id_lote = p_id_lote;
$$;

CREATE OR REPLACE FUNCTION venta_empresa_id(p_id_venta INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT usuario_empresa_id(id_usuario) FROM ventas WHERE id_venta = p_id_venta;
$$;

CREATE OR REPLACE FUNCTION contrato_empresa_id(p_id_contrato INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT venta_empresa_id(id_venta) FROM contratos WHERE id_contrato = p_id_contrato;
$$;

CREATE OR REPLACE FUNCTION prospecto_empresa_id(p_id_prospecto INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id_empresa FROM prospectos WHERE id_prospecto = p_id_prospecto;
$$;

-- =========================================================
-- EMPRESA
-- =========================================================
ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY empresa_select ON empresa FOR SELECT TO authenticated
  USING (id_empresa = current_empresa_id());

-- Alta de una empresa nueva (self-service onboarding): se permite sin
-- restringir por current_empresa_id() porque quien crea una empresa
-- todavia no pertenece a ninguna.
CREATE POLICY empresa_insert ON empresa FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY empresa_update ON empresa FOR UPDATE TO authenticated
  USING (id_empresa = current_empresa_id())
  WITH CHECK (id_empresa = current_empresa_id());

CREATE POLICY empresa_delete ON empresa FOR DELETE TO authenticated
  USING (id_empresa = current_empresa_id());

-- =========================================================
-- CONFIGURACION
-- =========================================================
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY configuracion_all ON configuracion FOR ALL TO authenticated
  USING (id_empresa = current_empresa_id())
  WITH CHECK (id_empresa = current_empresa_id());

-- =========================================================
-- PROYECTOS
-- =========================================================
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY proyectos_all ON proyectos FOR ALL TO authenticated
  USING (id_empresa = current_empresa_id())
  WITH CHECK (id_empresa = current_empresa_id());

-- =========================================================
-- MAPAS
-- =========================================================
ALTER TABLE mapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY mapas_all ON mapas FOR ALL TO authenticated
  USING (proyecto_empresa_id(id_proyecto) = current_empresa_id())
  WITH CHECK (proyecto_empresa_id(id_proyecto) = current_empresa_id());

-- =========================================================
-- ETAPAS
-- =========================================================
ALTER TABLE etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY etapas_all ON etapas FOR ALL TO authenticated
  USING (proyecto_empresa_id(id_proyecto) = current_empresa_id())
  WITH CHECK (proyecto_empresa_id(id_proyecto) = current_empresa_id());

-- =========================================================
-- MANZANA_BLOQUE
-- =========================================================
ALTER TABLE manzana_bloque ENABLE ROW LEVEL SECURITY;

CREATE POLICY manzana_bloque_all ON manzana_bloque FOR ALL TO authenticated
  USING (etapa_empresa_id(id_etapa) = current_empresa_id())
  WITH CHECK (etapa_empresa_id(id_etapa) = current_empresa_id());

-- =========================================================
-- LOTES
-- =========================================================
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY lotes_all ON lotes FOR ALL TO authenticated
  USING (manzana_empresa_id(id_manzana) = current_empresa_id())
  WITH CHECK (manzana_empresa_id(id_manzana) = current_empresa_id());

-- =========================================================
-- USUARIO
-- Bootstrap: permite crear tu propia fila la primera vez que te
-- registras (email = tu propio email, y todavia no existe ninguna
-- fila con ese email), ademas de que un colega de tu misma empresa
-- te de de alta manualmente desde UsuariosPage.
-- =========================================================
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuario_select ON usuario FOR SELECT TO authenticated
  USING (id_empresa = current_empresa_id());

CREATE POLICY usuario_insert ON usuario FOR INSERT TO authenticated
  WITH CHECK (
    id_empresa = current_empresa_id()
    OR (
      email = auth.email()
      AND NOT EXISTS (SELECT 1 FROM usuario u2 WHERE u2.email = auth.email())
    )
  );

CREATE POLICY usuario_update ON usuario FOR UPDATE TO authenticated
  USING (id_empresa = current_empresa_id())
  WITH CHECK (id_empresa = current_empresa_id());

CREATE POLICY usuario_delete ON usuario FOR DELETE TO authenticated
  USING (id_empresa = current_empresa_id());

-- =========================================================
-- INVENTARIO (via id_usuario)
-- =========================================================
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventario_all ON inventario FOR ALL TO authenticated
  USING (usuario_empresa_id(id_usuario) = current_empresa_id())
  WITH CHECK (usuario_empresa_id(id_usuario) = current_empresa_id());

-- =========================================================
-- COTIZADOR (via cadena de lote; `cliente` no tiene empresa propia)
-- =========================================================
ALTER TABLE cotizador ENABLE ROW LEVEL SECURITY;

CREATE POLICY cotizador_all ON cotizador FOR ALL TO authenticated
  USING (lote_empresa_id(id_lote) = current_empresa_id())
  WITH CHECK (lote_empresa_id(id_lote) = current_empresa_id());

-- =========================================================
-- VENTAS (via id_usuario)
-- =========================================================
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY ventas_all ON ventas FOR ALL TO authenticated
  USING (usuario_empresa_id(id_usuario) = current_empresa_id())
  WITH CHECK (usuario_empresa_id(id_usuario) = current_empresa_id());

-- =========================================================
-- CONTRATOS (via venta -> usuario)
-- =========================================================
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY contratos_all ON contratos FOR ALL TO authenticated
  USING (venta_empresa_id(id_venta) = current_empresa_id())
  WITH CHECK (venta_empresa_id(id_venta) = current_empresa_id());

-- =========================================================
-- COBRANZAS (via contrato -> venta -> usuario)
-- =========================================================
ALTER TABLE cobranzas ENABLE ROW LEVEL SECURITY;

CREATE POLICY cobranzas_all ON cobranzas FOR ALL TO authenticated
  USING (contrato_empresa_id(id_contrato) = current_empresa_id())
  WITH CHECK (contrato_empresa_id(id_contrato) = current_empresa_id());

-- =========================================================
-- PAGOS (via id_usuario)
-- =========================================================
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY pagos_all ON pagos FOR ALL TO authenticated
  USING (usuario_empresa_id(id_usuario) = current_empresa_id())
  WITH CHECK (usuario_empresa_id(id_usuario) = current_empresa_id());

-- =========================================================
-- PROSPECTOS / OPORTUNIDADES / ACTIVIDADES / ASESORES
-- =========================================================
ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY prospectos_all ON prospectos FOR ALL TO authenticated
  USING (id_empresa = current_empresa_id())
  WITH CHECK (id_empresa = current_empresa_id());

ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY oportunidades_all ON oportunidades FOR ALL TO authenticated
  USING (id_empresa = current_empresa_id())
  WITH CHECK (id_empresa = current_empresa_id());

ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY actividades_all ON actividades FOR ALL TO authenticated
  USING (prospecto_empresa_id(id_prospecto) = current_empresa_id())
  WITH CHECK (prospecto_empresa_id(id_prospecto) = current_empresa_id());

ALTER TABLE asesores ENABLE ROW LEVEL SECURITY;

CREATE POLICY asesores_all ON asesores FOR ALL TO authenticated
  USING (id_empresa = current_empresa_id())
  WITH CHECK (id_empresa = current_empresa_id());

-- =========================================================
-- ROLES / PERMISO / ROL_PERMISO: catalogos globales, no son por
-- empresa. Se permite lectura a cualquier usuario logueado; no hay
-- politica de escritura (queda bloqueada por defecto - se administra
-- por dashboard/service role, no desde el cliente).
-- =========================================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_select ON roles FOR SELECT TO authenticated USING (true);

ALTER TABLE permiso ENABLE ROW LEVEL SECURITY;
CREATE POLICY permiso_select ON permiso FOR SELECT TO authenticated USING (true);

ALTER TABLE rol_permiso ENABLE ROW LEVEL SECURITY;
CREATE POLICY rol_permiso_select ON rol_permiso FOR SELECT TO authenticated USING (true);

-- =========================================================
-- USUARIO_ROL (via id_usuario) - lectura y escritura, usado por
-- AssignRolUseCase/RemoveRolUseCase para gestionar roles de colegas
-- de la propia empresa.
-- =========================================================
ALTER TABLE usuario_rol ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuario_rol_all ON usuario_rol FOR ALL TO authenticated
  USING (usuario_empresa_id(id_usuario) = current_empresa_id())
  WITH CHECK (usuario_empresa_id(id_usuario) = current_empresa_id());
