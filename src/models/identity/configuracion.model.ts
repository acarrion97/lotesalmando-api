// models/identity/configuracion.model.ts
// Tabla `configuracion`: ajustes por empresa (1:1, UNIQUE id_empresa).

export interface Configuracion {
  id_configuracion: number;
  id_empresa: number;
  moneda: string | null;
  idioma: string | null;
}
