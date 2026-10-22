// controllers/public.controller.ts
// Endpoints PÚBLICOS (sin autenticación): el mapa interactivo que se incrusta
// en lotesalmando.com y el registro de interés de visitantes.
//
// Se apoyan en las RPC del esquema:
//   mapa_publico                     → datos del plano + lotes + estadísticas
//   mapa_publico_registrar_interes   → crea prospecto + oportunidad + actividad

import { Request, Response } from 'express';
import supabase from '../config/supabaseClient';
import { HttpError, ValidationError } from '../core/errors';
import { mapaPublico, registrarInteresPublico } from '../services/rpc.service';
import { planResource } from '../resources/subscriptions.resource';

const send = (res: Response, error: unknown): void => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message, details: error.details });
    return;
  }
  res.status(500).json({ message: error instanceof Error ? error.message : 'Error interno del servidor' });
};

export class PublicController {
  /** GET /api/v1/publico/mapas/:slug — mapa público por slug. */
  static getMapa = async (req: Request, res: Response): Promise<void> => {
    try {
      const slug = String(req.params.slug ?? '').trim().toLowerCase();
      if (!slug) throw new ValidationError('Falta el slug del mapa');

      const datos = await mapaPublico(slug);
      if (!datos) {
        res.status(404).json({ message: 'No existe un mapa público con ese slug' });
        return;
      }
      res.json(datos);
    } catch (error) {
      send(res, error);
    }
  };

  /** POST /api/v1/publico/mapas/:slug/interes — registra el interés de un visitante. */
  static registrarInteres = async (req: Request, res: Response): Promise<void> => {
    try {
      const slug = String(req.params.slug ?? '').trim().toLowerCase();
      const { id_lote, nombres, email, telefono } = req.body as {
        id_lote?: number;
        nombres?: string;
        email?: string;
        telefono?: string;
      };

      if (!id_lote || !nombres?.trim() || !email?.trim()) {
        throw new ValidationError('Faltan campos obligatorios', [
          { field: 'id_lote', message: 'id_lote, nombres y email son requeridos' },
        ]);
      }

      const resultado = await registrarInteresPublico({
        slug,
        id_lote: Number(id_lote),
        nombres: nombres.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono?.trim() ?? '',
      });

      res.status(201).json({
        message: 'Interés registrado. Un asesor te contactará pronto.',
        ...resultado,
      });
    } catch (error) {
      send(res, error);
    }
  };

  /** GET /api/v1/publico/planes — planes visibles (para la landing). */
  static getPlanes = async (_req: Request, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('plan')
        .select('*')
        .eq('activo', true)
        .not('precio', 'is', null)
        .order('orden', { ascending: true });

      if (error) throw new HttpError(500, `No se pudieron leer los planes: ${error.message}`);
      res.json(planResource.formatMany(data ?? []));
    } catch (error) {
      send(res, error);
    }
  };
}
