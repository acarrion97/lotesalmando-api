// models/inventory/lote.model.ts
// Tabla `lotes`: el corazón del inventario.
//   poligono → vértices normalizados [0,1] del plano (JSONB, migración 010)
//   codigo_catastral → índice único parcial (migración 014)
//
// El estado del lote se audita en la tabla `inventario` (estado_anterior →
// estado_nuevo) cada vez que cambia.

import { Manzana } from './manzana.model';

export type LoteEstado =
  | 'disponible'
  | 'reservado'
  | 'vendido'
  | 'en_negociacion'
  | 'bloqueado'
  | 'no_disponible';

/** Vértice del polígono del lote, normalizado a [0,1] sobre el plano. */
export type PuntoPlano = [number, number];

export interface Lote {
  id_lote: number;
  id_manzana: number;
  numero_lote: string;
  precio_lista: number | null;
  estado: LoteEstado;
  superficie_m2?: number | null;
  codigo_catastral?: string | null;
  /** ej. "8,00 x 18,00". */
  medidas?: string | null;
  poligono?: PuntoPlano[] | null;
}

/** MODELO DE VISUALIZACIÓN: el lote con manzana/etapa/proyecto incrustados. */
export interface LoteView extends Lote {
  manzana: (Manzana & { etapa?: { id_etapa: number; nombre: string; proyecto?: { id_proyecto: number; nombre: string; id_empresa: number } | null } | null }) | null;
}
