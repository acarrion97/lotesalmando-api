// models/inventory/proyecto.model.ts
// Tablas `proyectos` y `proyecto_medios`:
//   proyectos  (id_proyecto, id_empresa, nombre)
//   proyecto_medios (id_proyecto_medio, id_proyecto, tipo, url, orden)

import { Empresa } from '../identity/empresa.model';

export interface Proyecto {
  id_proyecto: number;
  id_empresa: number;
  nombre: string;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: el proyecto con su empresa incrustada. */
export interface ProyectoView extends Proyecto {
  empresa: Empresa | null;
}

export type ProyectoMedioTipo = 'imagen' | 'video';

export interface ProyectoMedio {
  id_proyecto_medio: number;
  id_proyecto: number;
  tipo: ProyectoMedioTipo;
  url: string;
  /** Contador MAX(orden)+1 (no es timestamp). */
  orden: number;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: el medio con su proyecto incrustado. */
export interface ProyectoMedioView extends ProyectoMedio {
  proyecto: Proyecto | null;
}
