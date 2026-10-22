// models/inventory/etapa.model.ts
// Tabla `etapas`: etapas de un proyecto (id_etapa, id_proyecto, nombre, orden).

import { Proyecto } from './proyecto.model';

export interface Etapa {
  id_etapa: number;
  id_proyecto: number;
  nombre: string;
  orden: number | null;
}

/** MODELO DE VISUALIZACIÓN: la etapa con su proyecto incrustado. */
export interface EtapaView extends Etapa {
  proyecto: Proyecto | null;
}
