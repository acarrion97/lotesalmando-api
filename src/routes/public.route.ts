// routes/public.route.ts
// Rutas PÚBLICAS (sin token): el mapa interactivo de lotesalmando.com, el
// registro de interés de visitantes y los planes visibles de la landing.

import express from 'express';
import { PublicController } from '../controllers/public.controller';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Público
 *   description: Endpoints sin autenticación (mapa interactivo y planes)
 */

/**
 * @swagger
 * /api/v1/publico/mapas/{slug}:
 *   get:
 *     summary: Datos del mapa público de un proyecto (plano, lotes y estadísticas)
 *     description: >
 *       Devuelve la vista pública del proyecto identificado por el `slug` de su
 *       mapa: imagen del plano, medios, estadísticas de disponibilidad y los
 *       lotes con su polígono. Implementado con la RPC `mapa_publico`.
 *     tags: [Público]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: ciudadela-san-lucas
 *     responses:
 *       200:
 *         description: Mapa público del proyecto
 *       404:
 *         description: No existe un mapa con ese slug
 */
router.get('/mapas/:slug', PublicController.getMapa);

/**
 * @swagger
 * /api/v1/publico/mapas/{slug}/interes:
 *   post:
 *     summary: Registra el interés de un visitante del mapa en un lote
 *     description: >
 *       Crea (o reutiliza) el prospecto, la oportunidad y la actividad de
 *       seguimiento mediante la RPC `mapa_publico_registrar_interes`.
 *     tags: [Público]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: ciudadela-san-lucas
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_lote, nombres, email]
 *             properties:
 *               id_lote: { type: integer, example: 45 }
 *               nombres: { type: string, example: María Pérez }
 *               email: { type: string, format: email, example: maria@correo.com }
 *               telefono: { type: string, example: "+593987654321" }
 *     responses:
 *       201:
 *         description: Interés registrado
 *       400:
 *         description: Datos inválidos
 */
router.post('/mapas/:slug/interes', PublicController.registrarInteres);

/**
 * @swagger
 * /api/v1/publico/planes:
 *   get:
 *     summary: Planes visibles con precio (para la landing de precios)
 *     tags: [Público]
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de planes activos con precio
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Plan' }
 */
router.get('/planes', PublicController.getPlanes);

export default router;
