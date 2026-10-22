import dotenv from 'dotenv';
dotenv.config();

export const {
  PORT = '',
  ALLOWED_ORIGIN = 'http://localhost:5173',
  // URL pública base del API (sin barra final). Se usa en la documentación
  // Swagger como "server" por defecto. En producción (Render) apunta a
  // https://lotes-al-mando-api.onrender.com; en desarrollo se puede
  // sobreescribir con http://localhost:3100 en el .env local.
  API_URL = 'https://lotes-al-mando-api.onrender.com',
  SUPABASE_URL = '',
  SUPABASE_SERVICE_ROLE_KEY = '',
} = process.env;

export const config = {
  port: Number(PORT) || 3000,
  allowedOrigin: ALLOWED_ORIGIN.split(',').map((origin) => origin.trim()),
  // Se normaliza quitando la barra final para concatenar rutas sin "//".
  apiUrl: API_URL.replace(/\/+$/, ''),
  db: {
    url: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  },
};
