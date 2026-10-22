// routes/auth.route.ts
// Endpoints de autenticación (Supabase Auth) + Swagger.
//
// El registro crea la cuenta en Supabase Auth y, sobre el esquema de Lotes al
// Mando, la empresa (tenant), el usuario local y la asignación del rol
// Administrador. Acepta además un `codigo_partner` opcional.

import express from 'express';
import { AuthController } from '../controllers/auth.controller';
import { sessionAuth, orgContext } from '../middlewares/sessionAuth';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: Registro, inicio de sesión y perfil del usuario de Lotes al Mando
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Crea la cuenta (Supabase Auth), la empresa, el usuario local y el rol Administrador
 *     description: >
 *       El registro es el único endpoint abierto del API. Devuelve el `id_empresa`
 *       e `id_usuario` creados; la empresa queda como tenant del usuario. Los
 *       límites de plan no aplican en el alta inicial.
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, nombres, razon_social]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: gerente@ciudadelasanlucas.ec
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Str0ng-Pass!
 *               nombres:
 *                 type: string
 *                 example: Andrea Salazar
 *               razon_social:
 *                 type: string
 *                 description: Razón social de la empresa creada junto a la cuenta
 *                 example: Ciudadela San Lucas S.A.
 *               ruc:
 *                 type: string
 *                 description: RUC de 13 dígitos; puede completarse después
 *                 example: "1792345678001"
 *               codigo_partner:
 *                 type: string
 *                 description: Código de partnership opcional que vincula la empresa a un partner
 *                 example: PARTNER01
 *           example:
 *             email: gerente@ciudadelasanlucas.ec
 *             password: Str0ng-Pass!
 *             nombres: Andrea Salazar
 *             razon_social: Ciudadela San Lucas S.A.
 *             ruc: "1792345678001"
 *             codigo_partner: PARTNER01
 *     responses:
 *       201:
 *         description: Cuenta creada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Cuenta creada correctamente }
 *                 user_id: { type: string, format: uuid, example: 8f9a1c2e-5b7d-4f0a-9c3e-1d2e3f4a5b6c }
 *                 id_empresa: { type: integer, example: 1 }
 *                 id_usuario: { type: integer, example: 7 }
 *                 id_partner: { type: integer, nullable: true, example: 1 }
 *       400:
 *         description: Datos inválidos, email ya registrado o código de partner inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ya existe una cuenta de acceso para ese email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/register', AuthController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Inicia sesión y devuelve los tokens de acceso
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: gerente@ciudadelasanlucas.ec }
 *               password: { type: string, format: password, example: Str0ng-Pass! }
 *     responses:
 *       200:
 *         description: Sesión iniciada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token: { type: string, description: "Se envía como Authorization: Bearer <access_token>" }
 *                 refresh_token: { type: string }
 *                 user_id: { type: string, format: uuid }
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/login', AuthController.login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Perfil local del usuario autenticado, sus roles y permisos
 *     description: >
 *       Resuelve el usuario local (tabla `usuario`) a partir del token y
 *       devuelve su empresa activa más los roles asignados en `usuario_rol`
 *       con sus permisos (`rol_permiso` → `permiso`).
 *     tags: [Autenticación]
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema: { type: string }
 *         required: true
 *         description: "Bearer <access_token>"
 *       - in: header
 *         name: X-Empresa-Id
 *         schema: { type: integer }
 *         required: false
 *         description: Empresa a la que se quiere acceder (por defecto, la del usuario)
 *     responses:
 *       200:
 *         description: Usuario, empresa y roles con permisos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usuario: { $ref: '#/components/schemas/Usuario' }
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_rol: { type: integer, example: 1 }
 *                       nombre_rol: { type: string, example: Administrador }
 *                       permisos:
 *                         type: array
 *                         items: { type: string, example: crear_lotes }
 *       401:
 *         description: Sin token válido
 *       404:
 *         description: El usuario no tiene cuenta local registrada
 */
router.get('/me', sessionAuth, orgContext, AuthController.me);

export default router;
