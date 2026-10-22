// models/sales/cliente.model.ts
// Tabla `cliente`: compradores. `id_empresa` es nullable a propósito: los
// clientes creados antes de la migración 019 no tienen empresa asignada.

import { Empresa } from '../identity/empresa.model';

export interface Cliente {
  id_cliente: number;
  id_empresa?: number | null;
  nombres: string;
  cedula_ruc?: string | null;
  email?: string | null;
  telefono?: string | null;
  created_at?: string | null;
}

/** MODELO DE VISUALIZACIÓN: el cliente con su empresa incrustada. */
export interface ClienteView extends Cliente {
  empresa: Empresa | null;
}
