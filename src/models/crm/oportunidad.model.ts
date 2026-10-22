// models/crm/oportunidad.model.ts
// Tabla `oportunidades`: el pipeline comercial de cada prospecto
// (etapa: contactado → interesado → negociacion → reserva | perdido).

import { Prospecto } from './prospecto.model';
import { Lote } from '../inventory/lote.model';

export type OportunidadEtapa = 'contactado' | 'interesado' | 'negociacion' | 'reserva' | 'perdido';

export interface Oportunidad {
  id_oportunidad: number;
  id_empresa: number;
  id_prospecto: number;
  id_lote?: number | null;
  etapa: OportunidadEtapa;
  valor_estimado: number | null;
  notas?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: la oportunidad con prospecto y lote incrustados. */
export interface OportunidadView extends Oportunidad {
  prospecto: Prospecto | null;
  lote: Lote | null;
}
