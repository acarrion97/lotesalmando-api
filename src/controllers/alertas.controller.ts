// controllers/alertas.controller.ts
// Alertas operativas derivadas de los datos (el frontend las calcula en
// memoria con GenerarAlertasUseCase; aquí se exponen como endpoint).
//
// Tipos: inventario (disponibilidad), seguimiento (prospectos fríos),
// cartera (cuotas vencidas) y mora (mayor antigüedad de mora).
//
// Todas las consultas se acotan a la empresa activa del token.

import { Request, Response } from 'express';
import supabase from '../config/supabaseClient';
import { HttpError } from '../core/errors';

type Prioridad = 'alta' | 'media' | 'baja';

interface Alerta {
  id: string;
  tipo: 'inventario' | 'seguimiento' | 'cartera' | 'mora';
  prioridad: Prioridad;
  titulo: string;
  descripcion: string;
  detalle?: string[];
  created_at: string;
}

/** Días sin contacto a partir de los cuales un prospecto es "frío". */
const DIAS_SEGUIMIENTO = 3;

export class AlertasController {
  /** GET /api/v1/alertas — genera las alertas de la empresa activa. */
  static getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = Number(req.organizationId);
      const alertas: Alerta[] = [];
      const ahora = new Date();

      // ── 1) Inventario: lotes disponibles por proyecto ─────────────────────
      const { data: proyectos } = await supabase
        .from('proyectos')
        .select(
          'id_proyecto, nombre, etapas!inner(manzana_bloque!inner(lotes!inner(estado)))'
        )
        .eq('id_empresa', empresaId);

      for (const proyecto of proyectos ?? []) {
        const estados: string[] = [];
        for (const etapa of (proyecto.etapas as unknown as Array<{ manzana_bloque: Array<{ lotes: Array<{ estado: string }> }> }>) ?? []) {
          for (const manzana of etapa.manzana_bloque ?? []) {
            for (const lote of manzana.lotes ?? []) estados.push(lote.estado);
          }
        }
        const total = estados.length;
        const disponibles = estados.filter((estado) => estado === 'disponible').length;

        if (total > 0 && disponibles === 0) {
          alertas.push({
            id: `inventario-${proyecto.id_proyecto}`,
            tipo: 'inventario',
            prioridad: 'alta',
            titulo: `Sin disponibilidad: ${proyecto.nombre}`,
            descripcion: 'El proyecto no tiene lotes disponibles para vender.',
            created_at: ahora.toISOString(),
          });
        }
      }

      // ── 2) Seguimiento: prospectos sin contacto reciente ──────────────────
      const corte = new Date(ahora.getTime() - DIAS_SEGUIMIENTO * 24 * 60 * 60 * 1000).toISOString();
      const { data: prospectos } = await supabase
        .from('prospectos')
        .select('id_prospecto, nombres, estado, fecha_ultimo_seguimiento, created_at')
        .eq('id_empresa', empresaId)
        .in('estado', ['nuevo', 'contactado', 'interesado', 'negociacion']);

      const frios = (prospectos ?? []).filter((prospecto) => {
        const ultimo = prospecto.fecha_ultimo_seguimiento ?? prospecto.created_at;
        return !ultimo || new Date(ultimo) < new Date(corte);
      });

      if (frios.length > 0) {
        alertas.push({
          id: 'seguimiento-frios',
          tipo: 'seguimiento',
          prioridad: 'media',
          titulo: `${frios.length} prospecto(s) sin seguimiento`,
          descripcion: `No hay contacto registrado en los últimos ${DIAS_SEGUIMIENTO} días.`,
          detalle: frios.slice(0, 10).map((prospecto) => `${prospecto.nombres} (${prospecto.estado})`),
          created_at: ahora.toISOString(),
        });
      }

      // ── 3) Cartera / mora: cuotas vencidas de la empresa ──────────────────
      const { data: cobranzas } = await supabase
        .from('cobranzas')
        .select(
          'id_cobranza, monto_cuota, fecha_vencimiento, numero_cuota, ' +
            'contratos!inner(ventas!inner(lotes!inner(manzana_bloque!inner(etapas!inner(proyectos!inner(id_empresa))))))'
        )
        .eq('contratos.ventas.lotes.manzana_bloque.etapas.proyectos.id_empresa', empresaId)
        .eq('estado', 'pendiente')
        .lt('fecha_vencimiento', ahora.toISOString().slice(0, 10));

      const vencidas = (cobranzas ?? []) as unknown as Array<{
        numero_cuota: number;
        monto_cuota: number;
        fecha_vencimiento: string;
      }>;
      if (vencidas.length > 0) {
        const totalMora = vencidas.reduce((suma, cuota) => suma + Number(cuota.monto_cuota ?? 0), 0);

        alertas.push({
          id: 'cartera-vencidas',
          tipo: 'cartera',
          prioridad: 'alta',
          titulo: `${vencidas.length} cuota(s) vencidas`,
          descripcion: `Monto total vencido: $${totalMora.toFixed(2)}.`,
          detalle: vencidas.slice(0, 10).map((cuota) => `Cuota #${cuota.numero_cuota} — $${cuota.monto_cuota} (vence ${cuota.fecha_vencimiento})`),
          created_at: ahora.toISOString(),
        });

        alertas.push({
          id: 'mora-cartera',
          tipo: 'mora',
          prioridad: 'media',
          titulo: 'Cartera con mora',
          descripcion: 'Hay cuotas con más de un día de atraso: revisar cobranzas.',
          created_at: ahora.toISOString(),
        });
      }

      res.json(alertas);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ message: error.message, details: error.details });
        return;
      }
      res.status(500).json({ message: error instanceof Error ? error.message : 'Error al generar las alertas' });
    }
  };
}
