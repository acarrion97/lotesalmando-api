// routes/alertas.route.ts
// Ruta de alertas operativas derivadas de los datos (inventario, seguimiento,
// cartera y mora). Se acota a la empresa activa del token.

import express from 'express';
import { AlertasController } from '../controllers/alertas.controller';
import { requireOrg } from '../middlewares/sessionAuth';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

/**
 * @swagger
 * /api/v1/alertas:
 *   get:
 *     summary: Alertas operativas de la empresa (inventario, seguimiento, cartera y mora)
 *     description: >
 *       Derivadas de los datos en tiempo real: proyectos sin disponibilidad,
 *       prospectos sin contacto reciente, cuotas vencidas y estado de mora.
 *     tags: [Alertas]
 *     responses:
 *       200:
 *         description: Lista de alertas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, example: cartera-vencidas }
 *                   tipo: { type: string, enum: [inventario, seguimiento, cartera, mora] }
 *                   prioridad: { type: string, enum: [alta, media, baja] }
 *                   titulo: { type: string, example: "3 cuota(s) vencidas" }
 *                   descripcion: { type: string }
 *                   detalle: { type: array, items: { type: string } }
 *                   created_at: { type: string, format: date-time }
 */
router.get('/', ...requireOrg, requirePermission('ver_alertas'), AlertasController.getAll);

export default router;
