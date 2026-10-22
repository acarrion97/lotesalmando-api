// models/inventory/manzana.model.ts
// Tabla `manzana_bloque`: manzanas/bloques dentro de una etapa.
// (El nombre real de la tabla es `manzana_bloque`; el recurso REST es /manzanas.)

import { Etapa } from './etapa.model';

export interface Manzana {
  id_manzana: number;
  id_etapa: number;
  nombre_codigo: string | null;
}

/** MODELO DE VISUALIZACIÓN: la manzana con etapa y proyecto incrustados. */
export interface ManzanaView extends Manzana {
  etapa: (Etapa & { proyecto?: { id_proyecto: number; nombre: string; id_empresa: number } | null }) | null;
}
