// models/inventory/mapa.model.ts
// Tabla `mapas`: el plano interactivo público de un proyecto.
//   url_publica → imagen del plano en el bucket `mapas`
//   slug        → enlace público corto (índice único parcial por lower(slug))

import { Proyecto } from './proyecto.model';

export interface Mapa {
  id_mapa: number;
  id_proyecto: number;
  url_publica: string | null;
  slug?: string | null;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: el mapa con su proyecto incrustado. */
export interface MapaView extends Mapa {
  proyecto: Proyecto | null;
}

/** DTO público devuelto por la RPC `mapa_publico` (no es una tabla). */
export interface MapaPublicoMedio {
  url: string;
  tipo: 'imagen' | 'video';
}

export interface MapaPublicoEstadisticas {
  total: number;
  disponibles: number;
  reservados: number;
  vendidos: number;
}

export interface MapaPublico {
  proyecto: string;
  url_publica: string | null;
  moneda?: string;
  medios?: MapaPublicoMedio[];
  estadisticas?: MapaPublicoEstadisticas;
  lotes: unknown[];
}
