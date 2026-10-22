// core/base.model.ts
// Contrato mínimo de los modelos con estado lógico.
// La mayoría de tablas de Lotes al Mando NO usan `estado` ni timestamps de
// edición: cada modelo declara sus propias columnas (snake_case, igual que la
// BD), y esta interfaz queda como referencia para las que sí lo tienen.

export interface BaseModel<T, E extends string = 'activo' | 'inactivo'> {
  estado: E;
  created_at?: string | null;
}
