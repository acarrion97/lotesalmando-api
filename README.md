# Lotes al Mando API

Backend de la plataforma **Lotes al Mando** (lotesalmando.com): inventario de
lotes, CRM, ventas, cobranzas y suscripciones.

Arquitectura: **monolito modular Express + TypeScript** sobre el **mismo esquema
Supabase** que usa el frontend (clave de SERVICE ROLE, solo backend). Cada
módulo expone su CRUD genérico bajo `/api/v1`, generado por
`src/core/crud.factory.ts`:

| Módulo | Rutas |
|---|---|
| Autenticación | `/api/auth/register` · `/login` · `/me` |
| Identidad | `/api/v1/empresas` `/configuracion` `/usuarios` `/roles` `/permisos` `/roles-usuarios` `/roles-permisos` |
| Inventario | `/api/v1/proyectos` `/proyecto-medios` `/mapas` `/etapas` `/manzanas` `/lotes` `/inventario` |
| CRM | `/api/v1/prospectos` `/oportunidades` `/actividades` `/asesores` |
| Ventas | `/api/v1/clientes` `/cotizaciones` `/ventas` `/contratos` `/cobranzas` `/pagos` `/entradas-reserva` |
| Suscripciones | `/api/v1/planes` `/partnerships` |
| Público (sin token) | `/api/v1/publico/mapas/:slug` `/:slug/interes` `/planes` |
| Alertas | `/api/v1/alertas` |
| Documentación | `/documentacion` (Swagger UI) |

## Puesta en marcha

```bash
cp .env.example .env      # completa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev               # desarrollo (ts-node)
npm run build && npm start  # producción
```

Variables:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (por defecto 3000) |
| `ALLOWED_ORIGIN` | Orígenes CORS permitidos (coma separada) |
| `SUPABASE_URL` | URL del proyecto Supabase (el mismo del frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de SERVICE ROLE: **solo backend, jamás al navegador** |

### Migraciones

`supabase/migrations/` concentra el historial completo de la base: las
**001–032** son una copia exacta de las del frontend (`lotesalmando/supabase/migrations/`)
y la **033** es la aportada por esta API. Aplica las que falten en el SQL
Editor de Supabase (en orden) o con `supabase db push`. A partir de ahora,
añade aquí las nuevas migraciones numeradas consecutivamente.

### Bitácora de auditoría (opcional)

Las escrituras quedan registradas en `audit_logs` **si la tabla existe**; si
no, la API opera igual y omite el registro (avisa una sola vez en consola).
Para activarla, aplica la migración `supabase/migrations/033_audit_logs.sql`
en el SQL Editor de Supabase.

## Uso

1. `POST /api/auth/login` → devuelve `access_token`.
2. Envía `Authorization: Bearer <access_token>` en cada petición.
3. Header opcional `X-Empresa-Id`: permite operar en otra empresa si el
   usuario pertenece a varias.

## Convenciones

- **Errores**: siempre `{ "message": string, "details"?: [{ field, message }] }`.
- **Multi-empresa**: todas las lecturas se acotan a la empresa del token.
  - Tablas con `id_empresa` directo (empresa, proyectos, usuario, cliente,
    prospectos, oportunidades, asesores, entradas_reserva): filtro forzado.
  - Tablas sin `id_empresa` (etapas, manzanas, lotes, inventario, cotizador,
    ventas, contratos, cobranzas, pagos, mapas, proyecto_medios, actividades):
    el filtro recorre la cadena FK con joins `!inner` de PostgREST, p. ej.
    `lotes → manzana_bloque → etapas → proyectos → id_empresa`. Una lectura de
    otra empresa responde **404** (no filtra su existencia).
- **Filtros**: cualquier columna exacta por querystring
  (`?estado=disponible&codigo_catastral=SM-01-A-012`) + paginación
  `?limite=20&pagina=1`.
- **Auditoría**: las escrituras con sesión quedan en `audit_logs`.

## RBAC (permisos del esquema)

`Administrador` y `Superusuario` tienen acceso total. El resto de roles
(`Vendedor`, `Gerente` y los personalizados) necesitan el permiso asignado en
`usuario_rol → rol_permiso → permiso`:

| Acción | Permiso |
|---|---|
| Proyectos | `crear_proyectos` / `editar_proyectos` / `eliminar_proyectos` |
| Etapas / manzanas | `crear_etapas`, `crear_manzanas`, … |
| Lotes | `crear_lotes` / `editar_lotes` / `cambiar_estado_lotes` |
| Mapas | `crear_mapas` / `editar_mapas` |
| Prospectos y CRM | `crear_prospectos` / `editar_prospectos` / `eliminar_prospectos` |
| Asesores | `crear_asesores` / `editar_asesores` / `eliminar_asesores` |
| Clientes | `crear_clientes` / `editar_clientes` |
| Cotizaciones | `crear_cotizaciones` / `editar_cotizaciones` / `aprobar_ventas` |
| Ventas | `crear_ventas` / `aprobar_ventas` / `anular_ventas` |
| Cobranzas y pagos | `registrar_pago` |
| Usuarios y roles | `crear_usuarios` / `editar_usuarios` / `asignar_permisos` |
| Planes / partners | `crear_planes` / `crear_partnerships` |
| Alertas | `ver_alertas` |

## Endpoints de negocio (no son CRUD genérico)

| Endpoint | Qué hace |
|---|---|
| `POST /api/v1/cotizaciones/:id/aceptar` | Ejecuta la RPC `aceptar_cotizacion`: crea la venta, marca el lote `vendido` (+ `inventario`), genera el contrato y las cuotas (`cobranzas`). |
| `PUT /api/v1/lotes/:id/estado` | Cambia el estado del lote y registra el movimiento en `inventario`. |
| `PUT /api/v1/lotes/:id/poligono` | Guarda los vértices del lote sobre el plano. |
| `GET /api/v1/cobranzas/vencidas` | Cuotas vencidas (pendientes con fecha pasada) de la empresa. |
| `PATCH /api/v1/cobranzas/:id/estado` | Marca una cuota como pagada / vencida / pendiente. |
| `POST /api/v1/pagos/registrar` | Registra el pago y marca la cuota como pagada al saldarse. |
| `PUT /api/v1/configuracion/empresa/:id_empresa` | Upsert idempotente de la configuración (por `id_empresa`). |
| `POST /api/v1/usuarios/con-acceso` | Alta de usuario **con cuenta** en Supabase Auth (réplica de la RPC `crear_usuario_auth`). |
| `POST /api/v1/usuarios/:id/roles` | Reemplaza el conjunto de roles de un usuario. |
| `PUT /api/v1/mapas/:id/slug` | Cambia el enlace público (409 si el slug está en uso). |
| `GET /api/v1/publico/mapas/:slug` | Mapa público por slug (RPC `mapa_publico`). |
| `POST /api/v1/publico/mapas/:slug/interes` | Registra el interés de un visitante (RPC `mapa_publico_registrar_interes`). |
| `GET /api/v1/alertas` | Alertas derivadas: inventario, seguimiento, cartera y mora. |

## Estructura

```
src/
├── index.ts              Registro de rutas + Swagger
├── config/               Configuración y cliente Supabase (service role)
├── core/                 Núcleo MVC genérico (Service/Controller/Request/Resource + factory CRUD)
├── middlewares/          sessionAuth, orgContext, requirePermission, tenantScope, chain
├── services/             auth, rpc (aceptar_cotizacion, mapa_publico…), audit
├── models/               Interfaces por tabla (columnas exactas de la BD)
├── requests/             Validaciones Joi (create/update) por módulo
├── resources/            Vistas de respuesta (FK incrustadas renombradas)
├── controllers/          Módulos: identity, inventory, crm, sales, subscriptions, public, alertas
├── routes/               Express routers + documentación @swagger
└── docs/                 Especificación OpenAPI generada para los CRUDs
supabase/
└── migrations/           001–032 (esquema, iguales que las del frontend) + 033_audit_logs.sql
```

## Notas de implementación

- El registro (`/api/auth/register`) replica en TypeScript la RPC
  `crear_empresa_con_admin` (que exige sesión): crea auth user + empresa +
  usuario + rol Administrador, y admite `codigo_partner` opcional (RPC
  `validar_codigo_partner`).
- Los límites de plan (max_proyectos / max_lotes_por_proyecto / max_usuarios)
  **no se reimplementan**: los aplican los triggers de la migración 028
  directamente en la BD.
- Las operaciones de Supabase Auth (`signInWithPassword`, `auth.admin.*`) usan
  un cliente propio, `src/config/supabaseAuthClient.ts`. `signInWithPassword`
  guarda la sesión en memoria y, en un cliente compartido, haría que todas las
  consultas posteriores viajaran con el JWT del usuario (rol `authenticated`)
  en lugar de la service role key: las tablas con RLS (`audit_logs`) rechazarían
  la escritura con *"new row violates row-level security policy"*.
- El webhook de Hotmart **no** vive aquí: sigue en Vercel
  (`api/hotmart-webhook.ts` del frontend) y actualiza `empresa.estado_pago`.
