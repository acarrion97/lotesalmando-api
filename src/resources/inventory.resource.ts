// resources/inventory.resource.ts
// Vistas de respuesta del módulo Inventario: proyectos, medios, mapas, etapas,
// manzanas, lotes y bitácora de inventario.

import { BaseResource } from '../core/base.resource';
import { InventarioView } from '../models/inventory/inventario.model';
import { Lote, LoteView } from '../models/inventory/lote.model';
import { Manzana, ManzanaView } from '../models/inventory/manzana.model';
import { Mapa, MapaView } from '../models/inventory/mapa.model';
import { Etapa, EtapaView } from '../models/inventory/etapa.model';
import { Proyecto, ProyectoMedio, ProyectoMedioView } from '../models/inventory/proyecto.model';
import { usuarioPlanoResource } from './identity.resource';

export const proyectoResource = new BaseResource<any, Proyecto>((row) => ({
  id_proyecto: row.id_proyecto,
  id_empresa: row.id_empresa,
  nombre: row.nombre,
  created_at: row.created_at,
}));

export const proyectoConEmpresaResource = new BaseResource<any, Proyecto & { empresa: unknown }>((row) => ({
  ...proyectoResource.format(row),
  // La FK apunta a la tabla `empresa` (nombre singular): así llega incrustada.
  empresa: row.empresa ? { id_empresa: row.empresa.id_empresa, razon_social: row.empresa.razon_social } : null,
}));

export const proyectoMedioResource = new BaseResource<any, ProyectoMedio>((row) => ({
  id_proyecto_medio: row.id_proyecto_medio,
  id_proyecto: row.id_proyecto,
  tipo: row.tipo,
  url: row.url,
  orden: row.orden,
  created_at: row.created_at,
}));

export const proyectoMedioConProyectoResource = new BaseResource<any, ProyectoMedioView>((row) => ({
  ...proyectoMedioResource.format(row),
  proyecto: row.proyectos ? proyectoResource.format(row.proyectos) : null,
}));

export const mapaResource = new BaseResource<any, Mapa>((row) => ({
  id_mapa: row.id_mapa,
  id_proyecto: row.id_proyecto,
  url_publica: row.url_publica,
  slug: row.slug ?? null,
  created_at: row.created_at,
}));

export const mapaConProyectoResource = new BaseResource<any, MapaView>((row) => ({
  ...mapaResource.format(row),
  proyecto: row.proyectos ? proyectoResource.format(row.proyectos) : null,
}));

export const etapaResource = new BaseResource<any, Etapa>((row) => ({
  id_etapa: row.id_etapa,
  id_proyecto: row.id_proyecto,
  nombre: row.nombre,
  orden: row.orden,
}));

export const etapaConProyectoResource = new BaseResource<any, EtapaView>((row) => ({
  ...etapaResource.format(row),
  proyecto: row.proyectos
    ? { id_proyecto: row.proyectos.id_proyecto, nombre: row.proyectos.nombre, id_empresa: row.proyectos.id_empresa }
    : null,
}));

export const manzanaResource = new BaseResource<any, Manzana>((row) => ({
  id_manzana: row.id_manzana,
  id_etapa: row.id_etapa,
  nombre_codigo: row.nombre_codigo,
}));

export const manzanaConEtapaResource = new BaseResource<any, ManzanaView>((row) => ({
  ...manzanaResource.format(row),
  etapa: row.etapas
    ? {
        ...etapaResource.format(row.etapas),
        proyecto: row.etapas.proyectos
          ? {
              id_proyecto: row.etapas.proyectos.id_proyecto,
              nombre: row.etapas.proyectos.nombre,
              id_empresa: row.etapas.proyectos.id_empresa,
            }
          : null,
      }
    : null,
}));

export const loteResource = new BaseResource<any, Lote>((row) => ({
  id_lote: row.id_lote,
  id_manzana: row.id_manzana,
  numero_lote: row.numero_lote,
  precio_lista: row.precio_lista,
  estado: row.estado,
  superficie_m2: row.superficie_m2 ?? null,
  codigo_catastral: row.codigo_catastral ?? null,
  medidas: row.medidas ?? null,
  poligono: row.poligono ?? null,
}));

export const loteConManzanaResource = new BaseResource<any, LoteView>((row) => ({
  ...loteResource.format(row),
  manzana: row.manzana_bloque ? manzanaConEtapaResource.format(row.manzana_bloque) : null,
}));

export const inventarioResource = new BaseResource<any, InventarioView>((row) => ({
  id_inventario: row.id_inventario,
  id_lote: row.id_lote,
  id_usuario: row.id_usuario,
  estado_anterior: row.estado_anterior,
  estado_nuevo: row.estado_nuevo,
  created_at: row.created_at,
  lote: row.lotes ? loteResource.format(row.lotes) : null,
  usuario: row.usuario ? usuarioPlanoResource.format(row.usuario) : null,
}));
